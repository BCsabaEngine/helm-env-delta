// ============================================================================
// JSON Path Utilities
// ============================================================================

// Parses a JSON path string into array of parts
// Example: "$.secrets[*].password" -> ["$", "secrets", "*", "password"]
// Example: "spec.env[0].value" -> ["spec", "env", "0", "value"]
export const parseJsonPath = (path: string): string[] => {
  return path
    .replaceAll(/\[(\*|\d+)]/g, '.$1')
    .split('.')
    .filter((part: string) => part.length > 0);
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
