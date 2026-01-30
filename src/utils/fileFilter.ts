import type { FileMap } from '../fileLoader';

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
