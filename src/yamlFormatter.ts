import YAML, { Document, Pair, Scalar, YAMLMap, YAMLSeq } from 'yaml';

import { ArraySortRule, OutputFormat } from './configFile';
import { YAML_DEFAULT_INDENT, YAML_LINE_WIDTH_UNLIMITED } from './constants';
import { isCommentOnlyContent } from './utils/commentOnlyDetector';
import { createErrorClass, createErrorTypeGuard } from './utils/errors';
import { parseJsonPath } from './utils/jsonPath';
import { globalMatcher } from './utils/patternMatcher';
import { extractKeyValue, isScalar, isYamlMap, isYamlSeq } from './utils/yamlTypeGuards';

// ============================================================================
// Error Handling
// ============================================================================

export const YamlFormatterError = createErrorClass('YAML Formatter Error', {
  YAML_PARSE_ERROR: 'YAML file could not be parsed',
  YAML_FORMAT_ERROR: 'Failed to apply formatting',
  INVALID_JSON_PATH: 'Invalid JSON path pattern',
  PATTERN_MATCH_ERROR: 'File pattern matching failed'
});

export const isYamlFormatterError = createErrorTypeGuard(YamlFormatterError);

// ============================================================================
// Helper Functions
// ============================================================================

// Batch all pattern matching in a single pass for better performance
const getFormattingRules = (
  filePath: string,
  outputFormat: OutputFormat
): {
  keyOrders: string[][];
  arraySort: ArraySortRule[][];
  quoteValues: string[][];
} => {
  const keyOrders: string[][] = [];
  const arraySort: ArraySortRule[][] = [];
  const quoteValues: string[][] = [];

  // Get all unique patterns from all three configs
  const allPatterns = new Set<string>();
  if (outputFormat?.keyOrders) for (const pattern of Object.keys(outputFormat.keyOrders)) allPatterns.add(pattern);
  if (outputFormat?.arraySort) for (const pattern of Object.keys(outputFormat.arraySort)) allPatterns.add(pattern);
  if (outputFormat?.quoteValues) for (const pattern of Object.keys(outputFormat.quoteValues)) allPatterns.add(pattern);

  // Single pass through all patterns
  for (const pattern of allPatterns) {
    if (!globalMatcher.match(filePath, pattern)) continue;

    const keyOrder = outputFormat?.keyOrders?.[pattern];
    if (keyOrder) keyOrders.push(keyOrder);

    const arrayRule = outputFormat?.arraySort?.[pattern];
    if (arrayRule) arraySort.push(arrayRule);

    const quoteValue = outputFormat?.quoteValues?.[pattern];
    if (quoteValue) quoteValues.push(quoteValue);
  }

  return { keyOrders, arraySort, quoteValues };
};

const preserveMultilineStrings = (yamlDocument: Document): void => {
  if (!yamlDocument.contents) return;

  const traverseNodes = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;

    // Handle Scalar nodes
    if (isScalar(node)) {
      if (typeof node.value === 'string' && node.value.includes('\n')) node.type = 'BLOCK_LITERAL';
      return;
    }

    // Handle Maps and Sequences
    if (isYamlMap(node)) {
      for (const item of node.items) if (item.value) traverseNodes(item.value);
    } else if (isYamlSeq(node)) for (const item of node.items) traverseNodes(item);
  };

  traverseNodes(yamlDocument.contents);
};

// ============================================================================
// Public API
// ============================================================================

export const formatYaml = (content: string, filePath: string, outputFormat?: OutputFormat): string => {
  if (!outputFormat) return content;
  if (!content || content.trim() === '') return content;
  if (isCommentOnlyContent(content)) return content;

  try {
    const yamlDocument = YAML.parseDocument(content);

    // Batch all pattern matching in a single pass for better performance
    const rules = getFormattingRules(filePath, outputFormat);

    // Apply formatting rules (only if they matched)
    if (rules.keyOrders.length > 0) applyKeyOrdering(yamlDocument, rules.keyOrders);
    if (rules.arraySort.length > 0) applyArraySorting(yamlDocument, rules.arraySort);
    if (rules.quoteValues.length > 0) applyValueQuoting(yamlDocument, rules.quoteValues);

    // Preserve literal block scalars for multi-line strings
    preserveMultilineStrings(yamlDocument);

    // Serialize with indent and disable line wrapping
    const indent = outputFormat.indent ?? YAML_DEFAULT_INDENT;
    let result = yamlDocument.toString({ indent, lineWidth: YAML_LINE_WIDTH_UNLIMITED });

    // Apply keySeparator
    if (outputFormat.keySeparator) result = applyKeySeparator(result, indent);

    // Ensure trailing newline
    if (!result.endsWith('\n')) result += '\n';

    return result;
  } catch (error) {
    const formatError = new YamlFormatterError('Failed to format YAML', {
      code: 'YAML_FORMAT_ERROR',
      path: filePath,
      cause: error instanceof Error ? error : undefined
    });

    formatError.message += '\n\n  Hint: Formatting failed. Options:';
    formatError.message += '\n    - Skip formatting: --skip-format';
    formatError.message += '\n    - Check keyOrders patterns match YAML structure';
    formatError.message += '\n    - Verify arraySort paths exist in files';

    throw formatError;
  }
};

// ============================================================================
// Key Ordering
// ============================================================================

const applyKeyOrdering = (yamlDocument: Document, orderLists: string[][]): void => {
  if (orderLists.length === 0) return;

  const allOrders = orderLists.flat();
  const orderHierarchy = parseOrderHierarchy(allOrders);

  if (yamlDocument.contents && typeof yamlDocument.contents === 'object' && 'items' in yamlDocument.contents)
    applyOrderingToMap(yamlDocument.contents as YAMLMap, [], orderHierarchy);
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

const applyValueQuoting = (yamlDocument: Document, quoteLists: string[][]): void => {
  if (quoteLists.length === 0) return;

  const allPaths = quoteLists.flat();
  const parsedPaths = allPaths.map((p) => parseJsonPath(p));

  if (yamlDocument.contents) traverseAndQuote(yamlDocument.contents, [], parsedPaths);
};

const traverseAndQuote = (node: unknown, currentPath: string[], pathsToQuote: string[][]): void => {
  if (!node || typeof node !== 'object') return;

  if (isYamlMap(node))
    for (const item of node.items) {
      const keyValue = extractKeyValue(item);

      if (keyValue) {
        const childPath = [...currentPath, keyValue];

        if (isScalar(item.value) && shouldQuoteValue(childPath, pathsToQuote)) quoteScalar(item.value);

        if (item.value) traverseAndQuote(item.value, childPath, pathsToQuote);
      }
    }
  else if (isYamlSeq(node))
    for (let index = 0; index < node.items.length; index++) {
      const item = node.items[index];
      const wildcardPath = [...currentPath, '*'];

      if (isScalar(item) && shouldQuoteValue(wildcardPath, pathsToQuote)) quoteScalar(item);

      if (item) traverseAndQuote(item, wildcardPath, pathsToQuote);
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
// Array Sorting
// ============================================================================

const applyArraySorting = (yamlDocument: Document, sortRules: ArraySortRule[][]): void => {
  if (sortRules.length === 0) return;

  const allRules = sortRules.flat();

  for (const rule of allRules) {
    const pathParts = parseJsonPath(rule.path);
    if (pathParts.length === 0) continue;

    if (yamlDocument.contents) traverseAndSort(yamlDocument.contents, [], pathParts, rule.sortBy, rule.order);
  }
};

const traverseAndSort = (
  node: unknown,
  currentPath: string[],
  targetPath: string[],
  sortByField: string,
  order: 'asc' | 'desc'
): void => {
  if (!node || typeof node !== 'object') return;

  // Match target path
  if (matchPath(currentPath, targetPath)) {
    if (isYamlSeq(node)) sortYamlSeq(node, sortByField, order);

    return;
  }

  // Continue traversing maps only
  if (isYamlMap(node))
    for (const item of node.items) {
      const keyValue = extractKeyValue(item);

      if (keyValue && item.value) {
        const childPath = [...currentPath, keyValue];
        if (isPotentialMatch(childPath, targetPath))
          traverseAndSort(item.value, childPath, targetPath, sortByField, order);
      }
    }
};

const isPotentialMatch = (currentPath: string[], targetPath: string[]): boolean => {
  if (currentPath.length > targetPath.length) return false;
  for (const [index, element] of currentPath.entries()) if (element !== targetPath[index]) return false;

  return true;
};

const sortYamlSeq = (seq: YAMLSeq, sortByField: string, order: 'asc' | 'desc'): void => {
  if (!seq.items || seq.items.length === 0) return;

  const itemsWithSortKeys: Array<{ item: unknown; sortKey: string | number | undefined }> = [];

  for (const item of seq.items) {
    const sortKey = extractSortKey(item, sortByField);
    itemsWithSortKeys.push({ item, sortKey });
  }

  const itemsWithKeys = itemsWithSortKeys.filter((entry) => entry.sortKey !== undefined);
  const itemsWithoutKeys = itemsWithSortKeys.filter((entry) => entry.sortKey === undefined);

  itemsWithKeys.sort((a, b) => compareSortKeys(a.sortKey, b.sortKey, order));

  seq.items = [...itemsWithKeys, ...itemsWithoutKeys].map((entry) => entry.item);
};

const extractSortKey = (item: unknown, sortByField: string): string | number | undefined => {
  if (!isYamlMap(item)) return undefined;

  for (const pair of item.items) {
    const keyValue = extractKeyValue(pair);

    if (keyValue === sortByField) {
      if (isScalar(pair.value)) {
        const value = pair.value.value;

        if (typeof value === 'string') return value;
        if (typeof value === 'number') return value;
      }
      return undefined;
    }
  }

  return undefined;
};

const compareSortKeys = (
  a: string | number | undefined,
  b: string | number | undefined,
  order: 'asc' | 'desc'
): number => {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;

  let result = 0;

  if (typeof a === 'string' && typeof b === 'string') result = a.toLowerCase().localeCompare(b.toLowerCase());
  else if (typeof a === 'number' && typeof b === 'number') result = a - b;
  else result = String(a).toLowerCase().localeCompare(String(b).toLowerCase());

  return order === 'asc' ? result : -result;
};

// ============================================================================
// keySeparator
// ============================================================================

const applyKeySeparator = (yamlString: string, indent: number): string => {
  const lines = yamlString.split('\n');
  const result: string[] = [];

  const topLevelKeys = countTopLevelKeys(yamlString);
  const baseIndent = ' '.repeat(indent);
  let hasSeenSecondLevelKey = false;

  for (const line of lines) {
    if (!line.trim()) continue;

    if (topLevelKeys > 1) {
      if (!line.startsWith(' ') && result.length > 0 && result.at(-1) !== '') result.push('');
    } else if (topLevelKeys === 1 && line.startsWith(baseIndent) && !line.startsWith(baseIndent + ' ')) {
      // Only add blank line if this is NOT the first second-level key
      if (hasSeenSecondLevelKey && result.length > 0 && result.at(-1) !== '') result.push('');

      hasSeenSecondLevelKey = true;
    }

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
