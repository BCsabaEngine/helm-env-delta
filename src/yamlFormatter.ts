import { isMatch } from 'picomatch';
import YAML, { Document, Pair, Scalar, YAMLMap, YAMLSeq } from 'yaml';

import { OutputFormat } from './configFile';

// ============================================================================
// Error Handling
// ============================================================================

export class YamlFormatterError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly path?: string,
    public override readonly cause?: Error
  ) {
    super(YamlFormatterError.formatMessage(message, code, path, cause));
    this.name = 'YamlFormatterError';
  }

  private static formatMessage = (message: string, code?: string, path?: string, cause?: Error): string => {
    let fullMessage = `YAML Formatter Error: ${message}`;

    if (path) fullMessage += `\n  Path: ${path}`;

    if (code) {
      const codeExplanations: Record<string, string> = {
        YAML_PARSE_ERROR: 'YAML file could not be parsed',
        YAML_FORMAT_ERROR: 'Failed to apply formatting',
        INVALID_JSON_PATH: 'Invalid JSON path pattern',
        PATTERN_MATCH_ERROR: 'File pattern matching failed'
      };

      const explanation = codeExplanations[code] || `Error (${code})`;
      fullMessage += `\n  Reason: ${explanation}`;
    }

    if (cause) fullMessage += `\n  Details: ${cause.message}`;

    return fullMessage;
  };
}

export const isYamlFormatterError = (error: unknown): error is YamlFormatterError =>
  error instanceof YamlFormatterError;

// ============================================================================
// Helper Functions
// ============================================================================

const parseJsonPath = (path: string): string[] => {
  return path
    .replaceAll(/\[(\*|\d+)]/g, '.$1')
    .split('.')
    .filter((part: string) => part.length > 0);
};

const matchPatternConfig = <T>(filePath: string, patternConfig?: Record<string, T>): T[] => {
  if (!patternConfig) return [];

  const matched: T[] = [];

  for (const [pattern, value] of Object.entries(patternConfig)) if (isMatch(filePath, pattern)) matched.push(value);

  return matched;
};

// ============================================================================
// Public API
// ============================================================================

export const formatYaml = (content: string, filePath: string, outputFormat?: OutputFormat): string => {
  if (!outputFormat) return content;
  if (!content || content.trim() === '') return content;

  try {
    const document_ = YAML.parseDocument(content);

    // Apply key ordering
    if (outputFormat.keyOrders) applyKeyOrdering(document_, filePath, outputFormat.keyOrders);

    // Apply value quoting
    if (outputFormat.quoteValues) applyValueQuoting(document_, filePath, outputFormat.quoteValues);

    // Serialize with indent
    const indent = outputFormat.indent ?? 2;
    let result = document_.toString({ indent });

    // Apply keySeparator
    if (outputFormat.keySeparator) result = applyKeySeparator(result, indent);

    return result;
  } catch (error) {
    throw new YamlFormatterError(
      'Failed to format YAML',
      'YAML_FORMAT_ERROR',
      filePath,
      error instanceof Error ? error : undefined
    );
  }
};

// ============================================================================
// Key Ordering
// ============================================================================

const applyKeyOrdering = (document_: Document, filePath: string, keyOrdersConfig: Record<string, string[]>): void => {
  const orderLists = matchPatternConfig(filePath, keyOrdersConfig);
  if (orderLists.length === 0) return;

  const allOrders = orderLists.flat();
  const orderHierarchy = parseOrderHierarchy(allOrders);

  if (document_.contents && typeof document_.contents === 'object' && 'items' in document_.contents)
    applyOrderingToMap(document_.contents as YAMLMap, [], orderHierarchy);
};

const parseOrderHierarchy = (orders: string[]): Map<string, string[]> => {
  const hierarchy = new Map<string, string[]>();

  for (const order of orders) {
    const parts = parseJsonPath(order);

    if (parts.length === 0) continue;

    if (parts.length === 1) {
      const rootOrders = hierarchy.get('') || [];
      rootOrders.push(parts[0]!);
      hierarchy.set('', rootOrders);
    } else {
      const parentPath = parts.slice(0, -1).join('.');
      const key = parts.at(-1)!;
      const parentOrders = hierarchy.get(parentPath) || [];
      parentOrders.push(key);
      hierarchy.set(parentPath, parentOrders);
    }
  }

  return hierarchy;
};

const applyOrderingToMap = (map: YAMLMap, currentPath: string[], orderHierarchy: Map<string, string[]>): void => {
  const pathString = currentPath.join('.');
  const ordering = orderHierarchy.get(pathString);

  if (ordering && ordering.length > 0) {
    const items = [...map.items];
    const orderedItems: Pair[] = [];
    const unorderedItems: Pair[] = [];

    for (const item of items) {
      const keyValue = item.key && typeof item.key === 'object' && 'value' in item.key ? item.key.value : undefined;
      if (keyValue && ordering.includes(String(keyValue))) orderedItems.push(item);
      else unorderedItems.push(item);
    }

    orderedItems.sort((a, b) => {
      const aKey = a.key && typeof a.key === 'object' && 'value' in a.key ? String(a.key.value) : '';
      const bKey = b.key && typeof b.key === 'object' && 'value' in b.key ? String(b.key.value) : '';
      return ordering.indexOf(aKey) - ordering.indexOf(bKey);
    });

    unorderedItems.sort((a, b) => {
      const aKey = a.key && typeof a.key === 'object' && 'value' in a.key ? String(a.key.value) : '';
      const bKey = b.key && typeof b.key === 'object' && 'value' in b.key ? String(b.key.value) : '';
      return aKey.localeCompare(bKey);
    });

    map.items = [...orderedItems, ...unorderedItems];
  }

  for (const item of map.items) {
    const keyValue =
      item.key && typeof item.key === 'object' && 'value' in item.key ? String(item.key.value) : undefined;

    if (keyValue && item.value && typeof item.value === 'object' && 'items' in item.value) {
      const childPath = [...currentPath, keyValue];
      applyOrderingToMap(item.value as YAMLMap, childPath, orderHierarchy);
    }
  }
};

// ============================================================================
// Value Quoting
// ============================================================================

const applyValueQuoting = (
  document_: Document,
  filePath: string,
  quoteValuesConfig: Record<string, string[]>
): void => {
  const quoteLists = matchPatternConfig(filePath, quoteValuesConfig);
  if (quoteLists.length === 0) return;

  const allPaths = quoteLists.flat();
  const parsedPaths = allPaths.map((p) => parseJsonPath(p));

  if (document_.contents) traverseAndQuote(document_.contents, [], parsedPaths);
};

const traverseAndQuote = (node: unknown, currentPath: string[], pathsToQuote: string[][]): void => {
  if (!node || typeof node !== 'object') return;

  if ('items' in node && Array.isArray((node as YAMLMap | YAMLSeq).items)) {
    const items = (node as YAMLMap | YAMLSeq).items;

    if (items.length > 0 && items[0] && typeof items[0] === 'object' && 'key' in items[0]) {
      const map = node as YAMLMap;

      for (const item of map.items) {
        const keyValue =
          item.key && typeof item.key === 'object' && 'value' in item.key ? String(item.key.value) : undefined;

        if (keyValue) {
          const childPath = [...currentPath, keyValue];

          if (item.value && typeof item.value === 'object' && 'value' in item.value) {
            const scalar = item.value as Scalar;
            if (shouldQuoteValue(childPath, pathsToQuote)) quoteScalar(scalar);
          }

          if (item.value) traverseAndQuote(item.value, childPath, pathsToQuote);
        }
      }
    } else {
      const seq = node as YAMLSeq;

      for (let index = 0; index < seq.items.length; index++) {
        const item = seq.items[index];
        const wildcardPath = [...currentPath, '*'];

        if (item && typeof item === 'object' && 'value' in item && !('items' in item)) {
          const scalar = item as Scalar;
          if (shouldQuoteValue(wildcardPath, pathsToQuote)) quoteScalar(scalar);
        }

        if (item) traverseAndQuote(item, wildcardPath, pathsToQuote);
      }
    }
  }
};

const shouldQuoteValue = (currentPath: string[], pathsToQuote: string[][]): boolean => {
  for (const pathToQuote of pathsToQuote) if (matchPath(currentPath, pathToQuote)) return true;

  return false;
};

const matchPath = (currentPath: string[], targetPath: string[]): boolean => {
  if (targetPath.length !== currentPath.length) return false;

  for (let index = 0; index < targetPath.length; index++)
    if (targetPath[index] !== '*' && targetPath[index] !== currentPath[index]) return false;

  return true;
};

const quoteScalar = (scalar: Scalar): void => {
  scalar.value = String(scalar.value);
  scalar.type = 'QUOTE_DOUBLE';
};

// ============================================================================
// keySeparator
// ============================================================================

const applyKeySeparator = (yamlString: string, indent: number): string => {
  const lines = yamlString.split('\n');
  const result: string[] = [];

  const topLevelKeys = countTopLevelKeys(yamlString);
  const baseIndent = ' '.repeat(indent);

  for (const line of lines) {
    if (!line) continue;

    if (topLevelKeys > 1) {
      if (!line.startsWith(' ') && result.length > 0 && result.at(-1) !== '') result.push('');
    } else if (
      topLevelKeys === 1 &&
      line.startsWith(baseIndent) &&
      !line.startsWith(baseIndent + ' ') &&
      result.length > 0 &&
      result.at(-1) !== ''
    )
      result.push('');

    result.push(line);
  }

  return result.join('\n');
};

const countTopLevelKeys = (yamlString: string): number => {
  const lines = yamlString.split('\n');
  let count = 0;

  for (const line of lines) {
    if (!line.trim()) continue;

    if (!line.startsWith(' ') && line.includes(':')) count++;
  }

  return count;
};
