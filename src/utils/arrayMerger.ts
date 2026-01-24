// ============================================================================
// Array Merger Utilities
// Extracted from fileUpdater.ts for skipPath-aware array merging
// ============================================================================

import { isFilterSegment, matchesFilter, parseFilterSegment, parseJsonPath } from './jsonPath';

/**
 * Represents a filter that applies to array items during merge operations.
 * Contains the parsed filter condition and any remaining path segments.
 */
export interface ApplicableFilter {
  filter: { property: string; value: string; operator: 'eq' | 'startsWith' | 'endsWith' | 'contains' };
  remainingPath: string[];
}

/**
 * Identifies which skipPath filters apply to arrays at the current path.
 * Returns filters that have the current path as prefix and a filter segment as the next part.
 *
 * @param currentPath - The current JSONPath segments being processed
 * @param skipPaths - Array of skipPath patterns to check
 * @returns Array of applicable filters with their remaining path segments
 */
export const getApplicableArrayFilters = (currentPath: string[], skipPaths: string[]): ApplicableFilter[] => {
  const filters: ApplicableFilter[] = [];

  for (const skipPath of skipPaths) {
    const segments = parseJsonPath(skipPath);

    // Check if currentPath is a prefix of the skipPath
    if (segments.length <= currentPath.length) continue;

    let isPrefix = true;
    for (let index = 0; index < currentPath.length; index++)
      if (segments[index] !== currentPath[index]) {
        isPrefix = false;
        break;
      }

    if (!isPrefix) continue;

    // The next segment after currentPath should be a filter
    const nextSegment = segments[currentPath.length];
    if (!nextSegment || !isFilterSegment(nextSegment)) continue;

    const filter = parseFilterSegment(nextSegment);
    if (!filter) continue;

    // Remaining path after the filter segment (for nested skipPaths)
    const remainingPath = segments.slice(currentPath.length + 1);

    filters.push({ filter, remainingPath });
  }

  return filters;
};

/**
 * Checks if an item matches any of the applicable filters.
 *
 * @param item - The item to check
 * @param applicableFilters - Array of filters to match against
 * @returns Object with matches boolean and the matched filter if found
 */
export const itemMatchesAnyFilter = (
  item: unknown,
  applicableFilters: ApplicableFilter[]
): { matches: boolean; matchedFilter?: ApplicableFilter } => {
  if (!item || typeof item !== 'object') return { matches: false };

  const itemObject = item as Record<string, unknown>;

  for (const applicableFilter of applicableFilters) {
    const itemValue = itemObject[applicableFilter.filter.property];
    if (itemValue !== undefined && matchesFilter(itemValue, applicableFilter.filter))
      return { matches: true, matchedFilter: applicableFilter };
  }

  return { matches: false };
};

/**
 * Finds a matching item in fullTargetArray for a source item based on filter properties.
 *
 * @param sourceItem - The source item to find a match for
 * @param fullTargetArray - The target array to search in
 * @param applicableFilters - Filters defining which properties to match on
 * @returns The matching target item or undefined if not found
 */
export const findMatchingTargetItem = (
  sourceItem: unknown,
  fullTargetArray: unknown[],
  applicableFilters: ApplicableFilter[]
): unknown | undefined => {
  if (!sourceItem || typeof sourceItem !== 'object') return undefined;

  const sourceObject = sourceItem as Record<string, unknown>;

  for (const targetItem of fullTargetArray) {
    if (!targetItem || typeof targetItem !== 'object') continue;
    const targetObject = targetItem as Record<string, unknown>;

    // Check if items match on any filter property
    for (const { filter } of applicableFilters)
      if (sourceObject[filter.property] === targetObject[filter.property]) return targetItem;
  }

  return undefined;
};

/**
 * Determines if an array item should be preserved from fullTarget.
 * An item should be preserved if it matches any applicable filter AND
 * is not already present in the result array.
 *
 * @param item - The item to check for preservation
 * @param applicableFilters - Filters that determine if item should be preserved
 * @param existingResult - The current result array to check for duplicates
 * @returns True if the item should be preserved, false otherwise
 */
export const shouldPreserveItem = (
  item: unknown,
  applicableFilters: ApplicableFilter[],
  existingResult: unknown[]
): boolean => {
  if (!item || typeof item !== 'object') return false;

  const itemObject = item as Record<string, unknown>;

  // Check if item matches any applicable filter
  const { matches } = itemMatchesAnyFilter(item, applicableFilters);
  if (!matches) return false;

  // Check if item is already in the result (avoid duplicates)
  // We compare by the filter property values to detect duplicates
  for (const existingItem of existingResult) {
    if (!existingItem || typeof existingItem !== 'object') continue;
    const existingObject = existingItem as Record<string, unknown>;

    // Check if all filter properties match between items
    let isDuplicate = true;
    for (const { filter } of applicableFilters)
      if (existingObject[filter.property] !== itemObject[filter.property]) {
        isDuplicate = false;
        break;
      }

    if (isDuplicate) return false;
  }

  return true;
};
