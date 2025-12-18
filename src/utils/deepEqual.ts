import { normalizeForComparison } from './serialization';

// ============================================================================
// Optimized Deep Equality Checker
// ============================================================================

// Deep equality check using structural comparison instead of string-based comparison
// This is significantly faster than YAML.stringify + string comparison
export const deepEqual = (a: unknown, b: unknown): boolean => {
  const normalizedA = normalizeForComparison(a);
  const normalizedB = normalizeForComparison(b);

  return deepEqualStructural(normalizedA, normalizedB);
};

// Structural deep equality - directly compares object structures
const deepEqualStructural = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;

  if (a === null || b === null) return a === b;
  if (a === undefined || b === undefined) return a === b;

  const typeA = typeof a;
  const typeB = typeof b;

  if (typeA !== typeB) return false;

  if (typeA === 'string' || typeA === 'number' || typeA === 'boolean') return a === b;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;

    for (let index = 0; index < a.length; index++) if (!deepEqualStructural(a[index], b[index])) return false;

    return true;
  }

  if (typeA === 'object' && typeB === 'object') {
    const objectA = a as Record<string, unknown>;
    const objectB = b as Record<string, unknown>;

    const keysA = Object.keys(objectA).toSorted();
    const keysB = Object.keys(objectB).toSorted();

    if (keysA.length !== keysB.length) return false;

    for (const [index, key] of keysA.entries()) {
      if (!key || key !== keysB[index]) return false;
      if (!deepEqualStructural(objectA[key], objectB[key])) return false;
    }

    return true;
  }

  return false;
};
