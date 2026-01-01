import { diffArrays, findArrayPaths, hasArrays } from '../arrayDiffer';
import { ChangedFile } from '../fileDiff';
import { deepEqual } from './deepEqual';
import { getValueAtPath } from './jsonPath';
import { normalizeForComparison } from './serialization';

/**
 * Represents a change detected in an array at a specific path
 */
export interface ArrayChange {
  /** JSONPath to the array (as segments) */
  path: string[];
  /** Items added to the array */
  added: unknown[];
  /** Items removed from the array */
  removed: unknown[];
  /** Items that remained unchanged */
  unchanged: unknown[];
}

/**
 * Information about all array changes detected in a file
 */
export interface ArrayChangeInfo {
  /** Whether the file contains any arrays */
  hasArrays: boolean;
  /** Whether any arrays have changes */
  hasChanges: boolean;
  /** All array paths found in the file */
  arrayPaths: string[][];
  /** Detailed changes for each modified array */
  changes: ArrayChange[];
}

/**
 * Detects and analyzes array changes between source and destination versions of a file.
 *
 * This function identifies all arrays in the source file, compares them with their
 * destination counterparts, and returns structured information about what changed.
 * The output is formatting-agnostic and can be used by different reporters.
 *
 * @param file - The changed file containing both source and destination data
 * @returns Structured information about array changes
 *
 * @example
 * ```typescript
 * const info = detectArrayChanges(changedFile);
 * if (info.hasChanges) {
 *   for (const change of info.changes) {
 *     console.log(`Array at ${change.path.join('.')} has ${change.added.length} additions`);
 *   }
 * }
 * ```
 */
export const detectArrayChanges = (file: ChangedFile): ArrayChangeInfo => {
  const hasArraysInFile = hasArrays(file.rawParsedSource) || hasArrays(file.rawParsedDest);

  if (!hasArraysInFile)
    return {
      hasArrays: false,
      hasChanges: false,
      arrayPaths: [],
      changes: []
    };

  const arrayPaths = findArrayPaths(file.rawParsedSource);
  const changes: ArrayChange[] = [];

  for (const path of arrayPaths) {
    const sourceArray = getValueAtPath(file.rawParsedSource, path);
    const destinationArray = getValueAtPath(file.rawParsedDest, path);

    if (!Array.isArray(sourceArray) || !Array.isArray(destinationArray)) continue;

    const normalizedSource = normalizeForComparison(sourceArray);
    const normalizedDestination = normalizeForComparison(destinationArray);

    if (deepEqual(normalizedSource, normalizedDestination)) continue;

    const diff = diffArrays(normalizedSource as unknown[], normalizedDestination as unknown[]);

    changes.push({
      path,
      added: diff.added,
      removed: diff.removed,
      unchanged: diff.unchanged
    });
  }

  return {
    hasArrays: true,
    hasChanges: changes.length > 0,
    arrayPaths,
    changes
  };
};
