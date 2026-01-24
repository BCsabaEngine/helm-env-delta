// ============================================================================
// Skip Selection File Loader
// ============================================================================

import { readFileSync } from 'node:fs';

import { createErrorClass, createErrorTypeGuard } from './errors';

// Types
export interface SelectionEntry {
  file: string;
  path: string;
  value?: unknown;
}

export interface SelectionFile {
  selections: SelectionEntry[];
}

// Error Handling
const SkipSelectionLoaderErrorClass = createErrorClass('Skip Selection Loader Error', {
  FILE_NOT_FOUND: 'Selection file not found',
  INVALID_JSON: 'Selection file contains invalid JSON',
  INVALID_FORMAT: 'Selection file has invalid format'
});

export class SkipSelectionLoaderError extends SkipSelectionLoaderErrorClass {}
export const isSkipSelectionLoaderError = createErrorTypeGuard(SkipSelectionLoaderError);

/**
 * Loads a skip-selection JSON file and converts it to skipPath config format.
 *
 * @param filePath - Path to the JSON selection file
 * @returns skipPath config object to merge with existing config
 *
 * @example
 * ```typescript
 * const skipPaths = loadSkipSelection('selections.json');
 * // Returns: { 'values-prod.yaml': ['image.tag', 'env[name=DEBUG].value'] }
 * ```
 */
export const loadSkipSelection = (filePath: string): Record<string, string[]> => {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new SkipSelectionLoaderError('Selection file not found: ' + filePath, {
      code: 'FILE_NOT_FOUND',
      path: filePath,
      cause: error instanceof Error ? error : undefined,
      hints: ['Check that the file path is correct', 'Export selections from the HTML report first']
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new SkipSelectionLoaderError('Selection file contains invalid JSON', {
      code: 'INVALID_JSON',
      path: filePath,
      cause: error instanceof Error ? error : undefined,
      hints: ['Ensure the file is valid JSON', 'Re-export selections from the HTML report']
    });
  }

  // Validate structure
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('selections' in parsed) ||
    !Array.isArray((parsed as SelectionFile).selections)
  )
    throw new SkipSelectionLoaderError('Selection file has invalid format', {
      code: 'INVALID_FORMAT',
      path: filePath,
      hints: [
        'Selection file must have a "selections" array',
        'Each selection must have "file" and "path" properties',
        'Re-export selections from the HTML report'
      ]
    });

  const selectionFile = parsed as SelectionFile;

  // Convert to skipPath format
  const skipPath: Record<string, string[]> = {};

  for (const selection of selectionFile.selections) {
    if (!selection.file || typeof selection.file !== 'string') continue;
    if (!selection.path || typeof selection.path !== 'string') continue;

    const filePaths = skipPath[selection.file] ?? (skipPath[selection.file] = []);
    if (!filePaths.includes(selection.path)) filePaths.push(selection.path);
  }

  return skipPath;
};

/**
 * Merges skip-selection paths into existing skipPath config.
 * Selection paths are added to any existing patterns.
 *
 * @param existingSkipPath - Current config's skipPath (or undefined)
 * @param selectionSkipPath - skipPath from selection file
 * @returns Merged skipPath config
 */
export const mergeSkipSelection = (
  existingSkipPath: Record<string, string[]> | undefined,
  selectionSkipPath: Record<string, string[]>
): Record<string, string[]> => {
  if (!existingSkipPath) return selectionSkipPath;

  const merged: Record<string, string[]> = {};

  // Deep copy existing skipPath arrays
  for (const [file, paths] of Object.entries(existingSkipPath)) merged[file] = [...paths];

  // Merge in selection paths
  for (const [file, paths] of Object.entries(selectionSkipPath)) {
    if (!merged[file]) merged[file] = [];

    for (const path of paths) if (!merged[file].includes(path)) merged[file].push(path);
  }

  return merged;
};
