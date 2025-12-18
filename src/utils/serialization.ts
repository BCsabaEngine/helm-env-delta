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

// Normalizes values for deep comparison by sorting arrays and recursively processing objects
export const normalizeForComparison = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') return value;

  if (Array.isArray(value)) {
    const normalized = value.map((item) => normalizeForComparison(item));

    return normalized.toSorted((a, b) => {
      const stringA = YAML.stringify(a, { sortMapEntries: true });
      const stringB = YAML.stringify(b, { sortMapEntries: true });
      return stringA.localeCompare(stringB);
    });
  }

  if (typeof value === 'object') {
    const normalized: Record<string, unknown> = {};
    for (const [key, value_] of Object.entries(value)) normalized[key] = normalizeForComparison(value_);

    return normalized;
  }

  return value;
};
