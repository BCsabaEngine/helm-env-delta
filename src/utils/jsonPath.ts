// ============================================================================
// JSON Path Utilities
// ============================================================================

// Cache for parsed JSONPath strings (memoization)
const pathCache = new Map<string, string[]>();

// Parses a JSON path string into array of parts
// Example: "$.secrets[*].password" -> ["$", "secrets", "*", "password"]
// Example: "spec.env[0].value" -> ["spec", "env", "0", "value"]
// Results are cached to avoid repeated parsing of the same paths
export const parseJsonPath = (path: string): string[] => {
  const cached = pathCache.get(path);
  if (cached !== undefined) return cached;

  const parsed = path
    .replaceAll(/\[(\*|\d+)]/g, '.$1')
    .split('.')
    .filter((part: string) => part.length > 0);

  pathCache.set(path, parsed);
  return parsed;
};

// Clears the JSONPath cache (useful for testing)
export const clearJsonPathCache = (): void => {
  pathCache.clear();
};

// Gets value at specified path in an object
// Returns undefined if path doesn't exist or traversal fails
export const getValueAtPath = (object: unknown, path: string[]): unknown => {
  let current = object;

  for (const part of path) {
    if (!current || typeof current !== 'object') return undefined;

    if (Array.isArray(current)) {
      if (part === '*') return undefined;

      const index = Number(part);
      if (Number.isNaN(index)) return undefined;

      current = current[index];
    } else current = (current as Record<string, unknown>)[part];
  }

  return current;
};
