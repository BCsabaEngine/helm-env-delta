// ============================================================================
// YAML Line-to-JSONPath Mapping Utility
// ============================================================================

import { isMap, isSeq, parseDocument, Scalar, YAMLMap, YAMLSeq } from 'yaml';

// Types
export interface LinePathInfo {
  path: string; // JSONPath like "image.tag" or "env[name=DEBUG].value"
  value: unknown; // The actual value at this path
}

export interface LineMapping {
  lineToPath: Map<number, LinePathInfo>;
  pathToLine: Map<string, number>;
}

// Helper to find the key field in an array item (common identifiers)
const KEY_FIELDS = ['name', 'id', 'key', 'path'];

const findKeyField = (item: YAMLMap): { field: string; value: string } | undefined => {
  for (const field of KEY_FIELDS) {
    const value = item.get(field);
    if (value !== undefined && value !== null) {
      const stringValue = String(value);
      // Only use simple values as keys
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        return { field, value: stringValue };
    }
  }
  return undefined;
};

// Convert character offset to line number (1-indexed)
const offsetToLine = (content: string, offset: number): number => {
  let line = 1;
  for (let index = 0; index < offset && index < content.length; index++) if (content[index] === '\n') line++;

  return line;
};

// Get the value from a YAML node
const getNodeValue = (node: unknown): unknown => {
  if (node instanceof Scalar) return node.value;
  if (isMap(node)) {
    const result: Record<string, unknown> = {};
    for (const pair of node.items)
      if (pair.key instanceof Scalar) result[String(pair.key.value)] = getNodeValue(pair.value);

    return result;
  }
  if (isSeq(node)) return node.items.map((item) => getNodeValue(item));

  return node;
};

// Traverse YAML AST and build line mappings
const traverseNode = (
  node: unknown,
  currentPath: string[],
  content: string,
  lineToPath: Map<number, LinePathInfo>,
  pathToLine: Map<string, number>
): void => {
  if (!node) return;

  if (isMap(node))
    for (const pair of node.items) {
      if (!(pair.key instanceof Scalar)) continue;

      const key = String(pair.key.value);
      const extendedPath = [...currentPath, key];
      const pathString = extendedPath.join('.');

      // Get line number from key position
      const keyRange = pair.key.range;
      if (keyRange) {
        const line = offsetToLine(content, keyRange[0]);
        const value = getNodeValue(pair.value);
        lineToPath.set(line, { path: pathString, value });
        pathToLine.set(pathString, line);
      }

      // Recurse into value
      traverseNode(pair.value, extendedPath, content, lineToPath, pathToLine);
    }
  else if (isSeq(node)) {
    const arrayNode = node as YAMLSeq;
    for (let index = 0; index < arrayNode.items.length; index++) {
      const item = arrayNode.items[index];

      // Try to use a key field for filter-style path
      let itemPath: string[];
      let keyInfo: { field: string; value: string } | undefined;

      if (isMap(item)) {
        keyInfo = findKeyField(item as YAMLMap);
        if (keyInfo) {
          // Use filter notation: array[name=value]
          const filterSegment = `${currentPath.at(-1) ?? ''}[${keyInfo.field}=${keyInfo.value}]`;
          itemPath = [...currentPath.slice(0, -1), filterSegment];
        } else
          // Fall back to numeric index
          itemPath = [...currentPath, String(index)];
      } else
        // Scalar or other - use numeric index
        itemPath = [...currentPath, String(index)];

      // Get line number from item position
      if (item && typeof item === 'object' && 'range' in item && item.range) {
        const range = item.range as [number, number, number];
        const line = offsetToLine(content, range[0]);
        const pathString = itemPath.join('.');
        const value = getNodeValue(item);
        lineToPath.set(line, { path: pathString, value });
        pathToLine.set(pathString, line);
      }

      // Recurse into item
      traverseNode(item, itemPath, content, lineToPath, pathToLine);
    }
  }
};

/**
 * Computes a mapping from YAML line numbers to JSONPaths.
 *
 * Uses YAML AST to traverse the document and calculate line numbers
 * from character offsets. For array items with identifiable key fields
 * (name, id, key, path), uses filter notation like `env[name=DEBUG]`.
 *
 * @param content - Raw YAML content string
 * @returns Map of line numbers to path info, and reverse map
 *
 * @example
 * ```typescript
 * const mapping = computeLineToJsonPath(`
 * image:
 *   tag: v1.0.0
 * env:
 *   - name: DEBUG
 *     value: true
 * `);
 * // mapping.lineToPath.get(3) -> { path: 'image.tag', value: 'v1.0.0' }
 * // mapping.lineToPath.get(5) -> { path: 'env[name=DEBUG]', value: { name: 'DEBUG', value: true } }
 * ```
 */
export const computeLineToJsonPath = (content: string): LineMapping => {
  const lineToPath = new Map<number, LinePathInfo>();
  const pathToLine = new Map<string, number>();

  try {
    const document = parseDocument(content, { keepSourceTokens: true });
    const root = document.contents;

    if (root) traverseNode(root, [], content, lineToPath, pathToLine);
  } catch {
    // If parsing fails, return empty mappings
    // This is graceful degradation - selection will just not work for invalid YAML
  }

  return { lineToPath, pathToLine };
};

/**
 * Converts line mapping to a serializable object for embedding in HTML.
 *
 * @param mapping - The LineMapping from computeLineToJsonPath
 * @returns Object suitable for JSON.stringify
 */
export const serializeLineMapping = (mapping: LineMapping): Record<number, LinePathInfo> => {
  const result: Record<number, LinePathInfo> = {};
  for (const [line, info] of mapping.lineToPath) result[line] = info;

  return result;
};
