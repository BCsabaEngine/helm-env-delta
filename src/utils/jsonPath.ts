// ============================================================================
// JSON Path Utilities
// ============================================================================

// Cache for parsed JSONPath strings (memoization)
const pathCache = new Map<string, string[]>();

// Filter segment marker prefix for internal representation
const FILTER_PREFIX = 'filter:';

// Regex to match filter expressions: [propertyName=value] or [propertyName="quoted value"]
const FILTER_REGEX = /^\[([A-Z_a-z]\w*)=("([^"]*)"|([^\]]*))]/;

/**
 * Checks if a parsed path segment is a filter expression.
 */
export const isFilterSegment = (segment: string): boolean => segment.startsWith(FILTER_PREFIX);

/**
 * Parses a filter segment into property and value.
 * @param segment - Segment like 'filter:name=value'
 * @returns { property, value } or undefined if invalid
 */
export const parseFilterSegment = (segment: string): { property: string; value: string } | undefined => {
  if (!isFilterSegment(segment)) return undefined;

  const content = segment.slice(FILTER_PREFIX.length);
  const equalIndex = content.indexOf('=');
  if (equalIndex === -1) return undefined;

  return {
    property: content.slice(0, equalIndex),
    value: content.slice(equalIndex + 1)
  };
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

      // Try filter expression first: [prop=value] or [prop="value"]
      const filterMatch = FILTER_REGEX.exec(remaining);
      if (filterMatch) {
        const property = filterMatch[1];
        // filterMatch[3] is quoted content, filterMatch[4] is unquoted content
        const value = filterMatch[3] === undefined ? filterMatch[4] : filterMatch[3];
        result.push(`${FILTER_PREFIX}${property}=${value}`);
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
// Supports filter segments like 'filter:name=value' to match array items by property
export const getValueAtPath = (object: unknown, path: string[]): unknown => {
  let current = object;

  for (const part of path) {
    if (!current || typeof current !== 'object') return undefined;

    // Handle filter segment
    if (isFilterSegment(part)) {
      if (!Array.isArray(current)) return undefined;

      const filter = parseFilterSegment(part);
      if (!filter) return undefined;

      // Find first matching item
      const matched = current.find((item) => {
        if (!item || typeof item !== 'object') return false;
        const itemValue = (item as Record<string, unknown>)[filter.property];
        return String(itemValue) === filter.value;
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
