import { isMatch } from 'picomatch';
import YAML from 'yaml';

import { Config } from './configFile';
import { FileMap } from './fileLoader';
import { deepEqual } from './utils/deepEqual';
import { createErrorClass, createErrorTypeGuard } from './utils/errors';
import { isYamlFile } from './utils/fileType';
import { parseJsonPath } from './utils/jsonPath';
import { normalizeForComparison } from './utils/serialization';

// Types
export interface FileDiffResult {
  addedFiles: string[];
  deletedFiles: string[];
  changedFiles: ChangedFile[];
  unchangedFiles: string[];
}

export interface ChangedFile {
  path: string;
  sourceContent: string;
  destinationContent: string;
  processedSourceContent: unknown;
  processedDestContent: unknown;
  rawParsedSource: unknown;
  rawParsedDest: unknown;
  normalizedSource?: unknown;
  normalizedDest?: unknown;
  parsedSource?: unknown;
  parsedDest?: unknown;
}

// Error Handling
const FileDiffErrorClass = createErrorClass('File Diff Error', {
  YAML_PARSE_ERROR: 'YAML file could not be parsed'
});

export class FileDiffError extends FileDiffErrorClass {}
export const isFileDiffError = createErrorTypeGuard(FileDiffError);

// Helper Functions
const detectAddedFiles = (sourceFiles: FileMap, destinationFiles: FileMap): string[] => {
  const addedFiles: string[] = [];

  for (const path of sourceFiles.keys()) if (!destinationFiles.has(path)) addedFiles.push(path);

  return addedFiles;
};

const detectDeletedFiles = (sourceFiles: FileMap, destinationFiles: FileMap): string[] => {
  const deletedFiles: string[] = [];

  for (const path of destinationFiles.keys()) if (!sourceFiles.has(path)) deletedFiles.push(path);

  return deletedFiles;
};

const deleteJsonPathRecursive = (object: unknown, parts: string[], index: number): void => {
  // Base case: reached end of path
  if (index >= parts.length) return;

  // Not an object - cannot navigate further
  if (!object || typeof object !== 'object') return;

  const currentPart = parts[index];
  if (!currentPart) return;

  // Last part of path - perform deletion
  if (index === parts.length - 1) {
    if (currentPart === '*' && Array.isArray(object))
      // Delete entire array
      (object as unknown[]).length = 0;
    else
      // Delete specific key
      delete (object as Record<string, unknown>)[currentPart];

    return;
  }

  // Wildcard in middle of path - recurse into all array items
  if (currentPart === '*' && Array.isArray(object)) {
    for (const item of object) deleteJsonPathRecursive(item, parts, index + 1);
    return;
  }

  // Normal key - navigate deeper
  const nextObject = (object as Record<string, unknown>)[currentPart];
  deleteJsonPathRecursive(nextObject, parts, index + 1);
};

const deleteJsonPath = (object: Record<string, unknown>, path: string): void => {
  const parts = parseJsonPath(path);
  deleteJsonPathRecursive(object, parts, 0);
};

const applySkipPaths = (data: unknown, skipPaths: string[]): unknown => {
  if (!data || typeof data !== 'object') return data;

  const cloned = structuredClone(data) as Record<string, unknown>;

  for (const path of skipPaths) deleteJsonPath(cloned, path);

  return cloned;
};

export const getSkipPathsForFile = (filePath: string, skipPath?: Record<string, string[]>): string[] => {
  if (!skipPath) return [];

  const pathsToSkip: string[] = [];

  for (const [pattern, paths] of Object.entries(skipPath)) if (isMatch(filePath, pattern)) pathsToSkip.push(...paths);

  return pathsToSkip;
};

const processYamlFile = (
  filePath: string,
  sourceContent: string,
  destinationContent: string,
  skipPath?: Record<string, string[]>
): ChangedFile | undefined => {
  let sourceParsed: unknown;
  let destinationParsed: unknown;

  try {
    sourceParsed = YAML.parse(sourceContent);
  } catch (error) {
    throw new FileDiffError('Failed to parse source YAML file', {
      code: 'YAML_PARSE_ERROR',
      path: filePath,
      cause: error instanceof Error ? error : undefined
    });
  }

  try {
    destinationParsed = YAML.parse(destinationContent);
  } catch (error) {
    throw new FileDiffError('Failed to parse destination YAML file', {
      code: 'YAML_PARSE_ERROR',
      path: filePath,
      cause: error instanceof Error ? error : undefined
    });
  }

  const pathsToSkip = getSkipPathsForFile(filePath, skipPath);

  const sourceFiltered = pathsToSkip.length > 0 ? applySkipPaths(sourceParsed, pathsToSkip) : sourceParsed;

  const destinationFiltered =
    pathsToSkip.length > 0 ? applySkipPaths(destinationParsed, pathsToSkip) : destinationParsed;

  const normalizedSource = normalizeForComparison(sourceFiltered);
  const normalizedDestination = normalizeForComparison(destinationFiltered);

  const areEqual = deepEqual(normalizedSource, normalizedDestination);

  if (areEqual) return undefined;

  return {
    path: filePath,
    sourceContent,
    destinationContent: destinationContent,
    processedSourceContent: normalizedSource,
    processedDestContent: normalizedDestination,
    rawParsedSource: sourceFiltered,
    rawParsedDest: destinationFiltered,
    normalizedSource,
    normalizedDest: normalizedDestination,
    parsedSource: sourceParsed,
    parsedDest: destinationParsed
  };
};

const processChangedFiles = (
  sourceFiles: FileMap,
  destinationFiles: FileMap,
  skipPath?: Record<string, string[]>
): { changedFiles: ChangedFile[]; unchangedFiles: string[] } => {
  const changedFiles: ChangedFile[] = [];
  const unchangedFiles: string[] = [];

  for (const [path, sourceContent] of sourceFiles.entries()) {
    if (!destinationFiles.has(path)) continue;

    const destinationContent = destinationFiles.get(path)!;

    const isYaml = isYamlFile(path);

    if (isYaml) {
      const changed = processYamlFile(path, sourceContent, destinationContent, skipPath);

      if (changed) changedFiles.push(changed);
      else unchangedFiles.push(path);
    } else if (sourceContent === destinationContent) unchangedFiles.push(path);
    else
      changedFiles.push({
        path,
        sourceContent,
        destinationContent: destinationContent,
        processedSourceContent: sourceContent,
        processedDestContent: destinationContent,
        rawParsedSource: sourceContent,
        rawParsedDest: destinationContent
      });
  }

  return { changedFiles, unchangedFiles };
};

// Public API
export const computeFileDiff = (sourceFiles: FileMap, destinationFiles: FileMap, config: Config): FileDiffResult => {
  const addedFiles = detectAddedFiles(sourceFiles, destinationFiles);

  const deletedFiles = config.prune ? detectDeletedFiles(sourceFiles, destinationFiles) : [];

  const { changedFiles, unchangedFiles } = processChangedFiles(sourceFiles, destinationFiles, config.skipPath);

  return { addedFiles, deletedFiles, changedFiles, unchangedFiles };
};
