// ============================================================================
// Fixed Values Utilities
// ============================================================================

import type { FixedValueConfig, FixedValueRule } from '../configFile';
import { isFilterSegment, matchesFilter, parseFilterSegment, parseJsonPath } from './jsonPath';
import { globalMatcher } from './patternMatcher';

/**
 * Gets fixed value rules that apply to a specific file path.
 * @param filePath - Relative file path to match
 * @param fixedValues - Fixed values config (glob pattern -> rules)
 * @returns Array of rules that apply to this file
 */
export const getFixedValuesForFile = (filePath: string, fixedValues?: FixedValueConfig): FixedValueRule[] => {
  if (!fixedValues) return [];

  const rules: FixedValueRule[] = [];

  for (const [pattern, patternRules] of Object.entries(fixedValues))
    if (globalMatcher.match(filePath, pattern)) rules.push(...patternRules);

  return rules;
};

/**
 * Sets a value at a JSONPath in an object, handling filter segments.
 * Modifies the object in-place.
 *
 * @param object - The object to modify
 * @param pathParts - Parsed JSONPath segments
 * @param value - The value to set
 * @returns true if value was set, false if path doesn't exist
 */
export const setValueAtPath = (object: unknown, pathParts: string[], value: unknown): boolean => {
  if (pathParts.length === 0) return false;
  if (!object || typeof object !== 'object') return false;

  let current: unknown = object;
  const lastIndex = pathParts.length - 1;

  // Navigate to parent of target
  for (let index = 0; index < lastIndex; index++) {
    const part = pathParts[index] as string;

    if (!current || typeof current !== 'object') return false;

    if (isFilterSegment(part)) {
      if (!Array.isArray(current)) return false;

      const filter = parseFilterSegment(part);
      if (!filter) return false;

      // Find first matching item
      const matched = current.find((item) => {
        if (!item || typeof item !== 'object') return false;
        const itemValue = (item as Record<string, unknown>)[filter.property];
        return matchesFilter(itemValue, filter);
      });

      if (!matched) return false;
      current = matched;
      continue;
    }

    if (Array.isArray(current)) {
      const arrayIndex = Number(part);
      if (Number.isNaN(arrayIndex) || arrayIndex < 0 || arrayIndex >= current.length) return false;
      current = current[arrayIndex];
    } else {
      const objectCurrent = current as Record<string, unknown>;
      if (!(part in objectCurrent)) return false;
      current = objectCurrent[part];
    }
  }

  // Set value at final segment
  const finalPart = pathParts[lastIndex] as string;

  if (!current || typeof current !== 'object') return false;

  if (isFilterSegment(finalPart)) {
    // Final segment is a filter - replace the matching array item
    if (!Array.isArray(current)) return false;

    const filter = parseFilterSegment(finalPart);
    if (!filter) return false;

    const matchedIndex = current.findIndex((item) => {
      if (!item || typeof item !== 'object') return false;
      const itemValue = (item as Record<string, unknown>)[filter.property];
      return matchesFilter(itemValue, filter);
    });

    if (matchedIndex === -1) return false;
    current[matchedIndex] = value;
    return true;
  }

  if (Array.isArray(current)) {
    const arrayIndex = Number(finalPart);
    if (Number.isNaN(arrayIndex) || arrayIndex < 0 || arrayIndex >= current.length) return false;
    current[arrayIndex] = value;
    return true;
  }

  // Set property on object
  const objectCurrent = current as Record<string, unknown>;
  objectCurrent[finalPart] = value;
  return true;
};

/**
 * Applies fixed value rules to a parsed YAML object.
 * Modifies the object in-place.
 *
 * @param data - The parsed YAML object to modify
 * @param rules - Array of fixed value rules to apply
 */
export const applyFixedValues = (data: unknown, rules: FixedValueRule[]): void => {
  for (const rule of rules) {
    const pathParts = parseJsonPath(rule.path);
    // Silently skip if path doesn't exist (as per design)
    setValueAtPath(data, pathParts, rule.value);
  }
};
