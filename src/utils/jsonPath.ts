// ============================================================================
// JSON Path Utilities
// ============================================================================

// Cache for parsed JSONPath strings (memoization)
const pathCache = new Map<string, string[]>();

// Filter segment marker prefix for internal representation
const FILTER_PREFIX = 'filter:';

// Filter operators: = (equals), ^= (startsWith), $= (endsWith), *= (contains)
export type FilterOperator = 'eq' | 'startsWith' | 'endsWith' | 'contains';

// Map from regex-captured operators to internal FilterOperator type
const OPERATOR_MAP: Record<string, FilterOperator> = {
  '=': 'eq',
  '^=': 'startsWith',
  '$=': 'endsWith',
  '*=': 'contains'
};

// Regex to match filter expressions with operators: [prop=value], [prop^=value], etc.
// Note: ^=, $=, *= must come before = to avoid partial matches
const FILTER_REGEX = /^\[([A-Z_a-z]\w*)(\^=|\$=|\*=|=)("([^"]*)"|([^\]]*))]/;

/**
 * Checks if a parsed path segment is a filter expression.
 */
export const isFilterSegment = (segment: string): boolean => segment.startsWith(FILTER_PREFIX);

/**
 * Parses a filter segment into property, value, and operator.
 * @param segment - Segment like 'filter:name:eq:value' or 'filter:name:startsWith:prefix'
 * @returns { property, value, operator } or undefined if invalid
 */
export const parseFilterSegment = (
  segment: string
): { property: string; value: string; operator: FilterOperator } | undefined => {
  if (!isFilterSegment(segment)) return undefined;

  const content = segment.slice(FILTER_PREFIX.length);
  // Internal format: property:operator:value
  const firstColon = content.indexOf(':');
  if (firstColon === -1) return undefined;

  const property = content.slice(0, firstColon);
  const rest = content.slice(firstColon + 1);

  const secondColon = rest.indexOf(':');
  if (secondColon === -1) return undefined;

  const operator = rest.slice(0, secondColon) as FilterOperator;
  const value = rest.slice(secondColon + 1);

  // Validate operator is valid
  if (!['eq', 'startsWith', 'endsWith', 'contains'].includes(operator)) return undefined;

  return { property, value, operator };
};

/**
 * Matches an item value against a filter expression.
 * @param itemValue - The value from the array item
 * @param filter - The parsed filter with property, value, and operator
 * @returns true if the item matches the filter
 */
export const matchesFilter = (
  itemValue: unknown,
  filter: { property: string; value: string; operator: FilterOperator }
): boolean => {
  const stringValue = String(itemValue);
  switch (filter.operator) {
    case 'eq':
      return stringValue === filter.value;
    case 'startsWith':
      return stringValue.startsWith(filter.value);
    case 'endsWith':
      return stringValue.endsWith(filter.value);
    case 'contains':
      return stringValue.includes(filter.value);
  }
};

// Parses a JSON path string into array of parts
// Example: "$.secrets[*].password" -> ["$", "secrets", "*", "password"]
// Example: "spec.env[0].value" -> ["spec", "env", "0", "value"]
// Example: "ENV[name=DEBUG]" -> ["ENV", "filter:name=DEBUG"]
// Results are cached to avoid repeated parsing of the same paths
export const parseJsonPath = (path: string): string[] => {
  const cached = pathCache.get(path);
  if (cached !== undefined) return cached;

  const result: string[] = [];
  let index = 0;
  let currentSegment = '';

  while (index < path.length) {
    const char = path[index];

    if (char === '.') {
      // Dot separator
      if (currentSegment) {
        result.push(currentSegment);
        currentSegment = '';
      }
      index++;
    } else if (char === '[') {
      // Bracket notation - could be index, wildcard, or filter
      if (currentSegment) {
        result.push(currentSegment);
        currentSegment = '';
      }

      const remaining = path.slice(index);

      // Try filter expression first: [prop=value], [prop^=value], [prop$=value], [prop*=value]
      const filterMatch = FILTER_REGEX.exec(remaining);
      if (filterMatch) {
        const property = filterMatch[1];
        const operatorString = filterMatch[2] as string;
        // filterMatch[4] is quoted content, filterMatch[5] is unquoted content
        const value = filterMatch[4] === undefined ? filterMatch[5] : filterMatch[4];
        const operator = OPERATOR_MAP[operatorString] ?? 'eq';
        // Internal format: filter:property:operator:value
        result.push(`${FILTER_PREFIX}${property}:${operator}:${value}`);
        index += filterMatch[0].length;
        continue;
      }

      // Try wildcard or numeric index: [*] or [0]
      const indexMatch = /^\[(\*|\d+)]/.exec(remaining);
      if (indexMatch?.[1]) {
        result.push(indexMatch[1]);
        index += indexMatch[0].length;
        continue;
      }

      // Unrecognized bracket notation - skip the bracket
      index++;
    } else {
      currentSegment += char;
      index++;
    }
  }

  if (currentSegment) result.push(currentSegment);

  // Filter out empty segments
  const parsed = result.filter((part) => part.length > 0);
  pathCache.set(path, parsed);
  return parsed;
};

// Clears the JSONPath cache (useful for testing)
export const clearJsonPathCache = (): void => {
  pathCache.clear();
};

// Gets value at specified path in an object
// Returns undefined if path doesn't exist or traversal fails
// Supports filter segments like 'filter:name:eq:value' to match array items by property
// Filter operators: eq (=), startsWith (^=), endsWith ($=), contains (*=)
export const getValueAtPath = (object: unknown, path: string[]): unknown => {
  let current = object;

  for (const part of path) {
    if (!current || typeof current !== 'object') return undefined;

    // Handle filter segment
    if (isFilterSegment(part)) {
      if (!Array.isArray(current)) return undefined;

      const filter = parseFilterSegment(part);
      if (!filter) return undefined;

      // Find first matching item using operator-aware comparison
      const matched = current.find((item) => {
        if (!item || typeof item !== 'object') return false;
        const itemValue = (item as Record<string, unknown>)[filter.property];
        return matchesFilter(itemValue, filter);
      });

      current = matched;
      continue;
    }

    if (Array.isArray(current)) {
      if (part === '*') return undefined;

      const index = Number(part);
      if (Number.isNaN(index)) return undefined;

      current = current[index];
    } else current = (current as Record<string, unknown>)[part];
  }

  return current;
};
