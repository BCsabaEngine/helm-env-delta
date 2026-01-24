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
 * Modifies the object in-place. When a filter matches multiple items,
 * the value is set for ALL matching items.
 *
 * @param object - The object to modify
 * @param pathParts - Parsed JSONPath segments
 * @param value - The value to set
 * @returns true if value was set, false if path doesn't exist
 */
export const setValueAtPath = (object: unknown, pathParts: string[], value: unknown): boolean => {
  if (pathParts.length === 0) return false;
  if (!object || typeof object !== 'object') return false;

  const [currentPart, ...remainingParts] = pathParts;
  if (!currentPart) return false;

  // Final segment - set the value
  if (remainingParts.length === 0) {
    if (isFilterSegment(currentPart)) {
      // Final segment is a filter - replace ALL matching array items
      if (!Array.isArray(object)) return false;

      const filter = parseFilterSegment(currentPart);
      if (!filter) return false;

      let updated = false;
      for (let index = 0; index < object.length; index++) {
        const item = object[index];
        if (!item || typeof item !== 'object') continue;
        const itemValue = (item as Record<string, unknown>)[filter.property];
        if (matchesFilter(itemValue, filter)) {
          object[index] = value;
          updated = true;
        }
      }
      return updated;
    }

    if (Array.isArray(object)) {
      const arrayIndex = Number(currentPart);
      if (Number.isNaN(arrayIndex) || arrayIndex < 0 || arrayIndex >= object.length) return false;
      object[arrayIndex] = value;
      return true;
    }

    // Set property on object
    const objectCurrent = object as Record<string, unknown>;
    objectCurrent[currentPart] = value;
    return true;
  }

  // Navigate deeper - handle filter segments specially to update ALL matching items
  if (isFilterSegment(currentPart)) {
    if (!Array.isArray(object)) return false;

    const filter = parseFilterSegment(currentPart);
    if (!filter) return false;

    // Recursively apply to ALL matching items
    let updated = false;
    for (const item of object) {
      if (!item || typeof item !== 'object') continue;
      const itemValue = (item as Record<string, unknown>)[filter.property];
      if (matchesFilter(itemValue, filter) && setValueAtPath(item, remainingParts, value)) updated = true;
    }
    return updated;
  }

  if (Array.isArray(object)) {
    const arrayIndex = Number(currentPart);
    if (Number.isNaN(arrayIndex) || arrayIndex < 0 || arrayIndex >= object.length) return false;
    return setValueAtPath(object[arrayIndex], remainingParts, value);
  }

  const objectCurrent = object as Record<string, unknown>;
  if (!(currentPart in objectCurrent)) return false;
  return setValueAtPath(objectCurrent[currentPart], remainingParts, value);
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
