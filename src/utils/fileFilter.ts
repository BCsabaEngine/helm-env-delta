import type { FileDiffResult } from '../fileDiff';
import type { FileMap } from '../fileLoader';

export type ChangeMode = 'new' | 'modified' | 'deleted' | 'all';

/**
 * Filters a FileDiffResult by change type mode.
 * Returns only the changes matching the specified mode.
 */
export const filterDiffResultByMode = (diffResult: FileDiffResult, mode: ChangeMode): FileDiffResult => {
  if (mode === 'all') return diffResult;

  return {
    addedFiles: mode === 'new' ? diffResult.addedFiles : [],
    deletedFiles: mode === 'deleted' ? diffResult.deletedFiles : [],
    changedFiles: mode === 'modified' ? diffResult.changedFiles : [],
    unchangedFiles: diffResult.unchangedFiles
  };
};

/**
 * Filters a FileMap by filename or content match (case-insensitive).
 * A file matches if EITHER:
 *   1. The filename includes the filter text
 *   2. The file content includes the filter text
 */
export const filterFileMap = (fileMap: FileMap, filter: string | undefined): FileMap => {
  if (!filter) return fileMap;

  const lowerFilter = filter.toLowerCase();
  const filteredMap = new Map<string, string>();

  for (const [filePath, content] of fileMap) {
    const filenameMatches = filePath.toLowerCase().includes(lowerFilter);
    const contentMatches = content.toLowerCase().includes(lowerFilter);

    if (filenameMatches || contentMatches) filteredMap.set(filePath, content);
  }

  return filteredMap;
};

/**
 * Filters two FileMaps together by filename or content match (case-insensitive).
 * A file is included if its path matches in EITHER map (by filename or content).
 * This ensures files that exist in both maps stay in both filtered outputs,
 * preventing "changed" files from incorrectly appearing as "added".
 */
export const filterFileMaps = (
  sourceFiles: FileMap,
  destinationFiles: FileMap,
  filter: string | undefined
): { sourceFiles: FileMap; destinationFiles: FileMap } => {
  if (!filter) return { sourceFiles, destinationFiles };

  const lowerFilter = filter.toLowerCase();
  const matchingPaths = new Set<string>();

  // Collect matching paths from source
  for (const [filePath, content] of sourceFiles)
    if (filePath.toLowerCase().includes(lowerFilter) || content.toLowerCase().includes(lowerFilter))
      matchingPaths.add(filePath);

  // Collect matching paths from destination
  for (const [filePath, content] of destinationFiles)
    if (filePath.toLowerCase().includes(lowerFilter) || content.toLowerCase().includes(lowerFilter))
      matchingPaths.add(filePath);

  // Filter both maps to include only matching paths
  const filteredSource = new Map<string, string>();
  const filteredDestination = new Map<string, string>();

  for (const [filePath, content] of sourceFiles) if (matchingPaths.has(filePath)) filteredSource.set(filePath, content);

  for (const [filePath, content] of destinationFiles)
    if (matchingPaths.has(filePath)) filteredDestination.set(filePath, content);

  return { sourceFiles: filteredSource, destinationFiles: filteredDestination };
};
