import YAML from 'yaml';

// ============================================================================
// YAML Serialization Utilities
// ============================================================================

// Serializes content for diffing with consistent formatting
export const serializeForDiff = (content: unknown, isYaml: boolean): string => {
  if (!isYaml) return String(content);

  return YAML.stringify(content, {
    indent: 2,
    lineWidth: 0,
    sortMapEntries: true
  });
};

/**
 * Recursively sorts all object keys alphabetically so that JSON.stringify
 * produces a stable, canonical string regardless of insertion order.
 * Used as a lightweight alternative to YAML.stringify for sort-key generation.
 */
const deepSortKeys = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => deepSortKeys(item));
  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).toSorted())
      sorted[key] = deepSortKeys((value as Record<string, unknown>)[key]);
    return sorted;
  }
  return value;
};

// Normalizes values for deep comparison by sorting arrays and recursively processing objects
export const normalizeForComparison = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') return value;

  if (Array.isArray(value)) {
    const normalized = value.map((item) => normalizeForComparison(item));

    // Use JSON.stringify with sorted keys as sort key — ~3-5x faster than YAML.stringify
    const serializedItems = normalized.map((item) => ({
      item,
      serialized: JSON.stringify(deepSortKeys(item)) ?? ''
    }));

    return serializedItems.toSorted((a, b) => a.serialized.localeCompare(b.serialized)).map(({ item }) => item);
  }

  if (typeof value === 'object') {
    const normalized: Record<string, unknown> = {};
    for (const [key, value_] of Object.entries(value)) normalized[key] = normalizeForComparison(value_);

    return normalized;
  }

  return value;
};
