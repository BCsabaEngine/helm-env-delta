import YAML, { Document, Pair, Scalar, YAMLMap, YAMLSeq } from 'yaml';

import { ArraySortRule, OutputFormat } from './configFile';
import { createErrorClass, createErrorTypeGuard } from './utils/errors';
import { parseJsonPath } from './utils/jsonPath';
import { globalMatcher } from './utils/patternMatcher';

// ============================================================================
// Error Handling
// ============================================================================

const YamlFormatterErrorClass = createErrorClass('YAML Formatter Error', {
  YAML_PARSE_ERROR: 'YAML file could not be parsed',
  YAML_FORMAT_ERROR: 'Failed to apply formatting',
  INVALID_JSON_PATH: 'Invalid JSON path pattern',
  PATTERN_MATCH_ERROR: 'File pattern matching failed'
});

export class YamlFormatterError extends YamlFormatterErrorClass {}
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

const preserveMultilineStrings = (document_: Document): void => {
  if (!document_.contents) return;

  const traverse = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;

    // Handle Scalar nodes
    if ('value' in node && !('items' in node)) {
      const scalar = node as Scalar;
      if (typeof scalar.value === 'string' && scalar.value.includes('\n')) scalar.type = 'BLOCK_LITERAL';

      return;
    }

    // Handle Maps and Sequences
    if ('items' in node && Array.isArray((node as YAMLMap | YAMLSeq).items)) {
      const items = (node as YAMLMap | YAMLSeq).items;

      if (items.length > 0 && items[0] && typeof items[0] === 'object' && 'key' in items[0]) {
        const map = node as YAMLMap;
        for (const item of map.items) if (item.value) traverse(item.value);
      } else {
        const seq = node as YAMLSeq;
        for (const item of seq.items) traverse(item);
      }
    }
  };

  traverse(document_.contents);
};

// ============================================================================
// Public API
// ============================================================================

export const formatYaml = (content: string, filePath: string, outputFormat?: OutputFormat): string => {
  if (!outputFormat) return content;
  if (!content || content.trim() === '') return content;

  try {
    const document_ = YAML.parseDocument(content);

    // Batch all pattern matching in a single pass for better performance
    const rules = getFormattingRules(filePath, outputFormat);

    // Apply formatting rules (only if they matched)
    if (rules.keyOrders.length > 0) applyKeyOrdering(document_, rules.keyOrders);
    if (rules.arraySort.length > 0) applyArraySorting(document_, rules.arraySort);
    if (rules.quoteValues.length > 0) applyValueQuoting(document_, rules.quoteValues);

    // Preserve literal block scalars for multi-line strings
    preserveMultilineStrings(document_);

    // Serialize with indent and disable line wrapping
    const indent = outputFormat.indent ?? 2;
    let result = document_.toString({ indent, lineWidth: 0 });

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

const applyKeyOrdering = (document_: Document, orderLists: string[][]): void => {
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

const applyValueQuoting = (document_: Document, quoteLists: string[][]): void => {
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
// Array Sorting
// ============================================================================

const applyArraySorting = (document_: Document, sortRules: ArraySortRule[][]): void => {
  if (sortRules.length === 0) return;

  const allRules = sortRules.flat();

  for (const rule of allRules) {
    const pathParts = parseJsonPath(rule.path);
    if (pathParts.length === 0) continue;

    if (document_.contents) traverseAndSort(document_.contents, [], pathParts, rule.sortBy, rule.order);
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
    if ('items' in node && Array.isArray((node as YAMLSeq).items)) {
      const seq = node as YAMLSeq;
      sortYamlSeq(seq, sortByField, order);
    }
    return;
  }

  // Continue traversing maps only
  if ('items' in node && Array.isArray((node as YAMLMap | YAMLSeq).items)) {
    const items = (node as YAMLMap | YAMLSeq).items;

    if (items.length > 0 && items[0] && typeof items[0] === 'object' && 'key' in items[0]) {
      const map = node as YAMLMap;

      for (const item of map.items) {
        const keyValue =
          item.key && typeof item.key === 'object' && 'value' in item.key ? String(item.key.value) : undefined;

        if (keyValue && item.value) {
          const childPath = [...currentPath, keyValue];
          if (isPotentialMatch(childPath, targetPath))
            traverseAndSort(item.value, childPath, targetPath, sortByField, order);
        }
      }
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
  if (!item || typeof item !== 'object') return undefined;
  if (!('items' in item) || !Array.isArray((item as YAMLMap).items)) return undefined;

  const map = item as YAMLMap;

  for (const pair of map.items) {
    const keyValue =
      pair.key && typeof pair.key === 'object' && 'value' in pair.key ? String(pair.key.value) : undefined;

    if (keyValue === sortByField) {
      if (pair.value && typeof pair.value === 'object' && 'value' in pair.value) {
        const scalar = pair.value as Scalar;
        const value = scalar.value;

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
    if (!line) continue;

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
