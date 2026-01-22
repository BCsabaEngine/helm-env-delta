import YAML from 'yaml';

import { Config, TransformConfig } from './configFile';
import { FileMap } from './fileLoader';
import { deepEqual } from './utils/deepEqual';
import { createErrorClass, createErrorTypeGuard } from './utils/errors';
import { isYamlFile } from './utils/fileType';
import { isFilterSegment, matchesFilter, parseFilterSegment, parseJsonPath } from './utils/jsonPath';
import { globalMatcher } from './utils/patternMatcher';
import { normalizeForComparison } from './utils/serialization';
import { applyTransforms } from './utils/transformer';

// Types
export interface FileDiffResult {
  addedFiles: string[];
  deletedFiles: string[];
  changedFiles: ChangedFile[];
  unchangedFiles: string[];
}

export interface ChangedFile {
  path: string;
  originalPath?: string; // Original filename before transform (only set if transformed)
  sourceContent: string;
  destinationContent: string;
  processedSourceContent: unknown;
  processedDestContent: unknown;
  rawParsedSource: unknown;
  rawParsedDest: unknown;
  skipPaths: string[];
  normalizedSource?: unknown;
  normalizedDest?: unknown;
  parsedSource?: unknown;
  parsedDest?: unknown;
}

export interface ProcessYamlOptions {
  filePath: string;
  sourceContent: string;
  destinationContent: string;
  skipPath?: Record<string, string[]>;
  transforms?: TransformConfig;
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

  // Handle filter expression with operator-aware matching
  if (isFilterSegment(currentPart)) {
    if (!Array.isArray(object)) return;

    const filter = parseFilterSegment(currentPart);
    if (!filter) return;

    if (index === parts.length - 1)
      // Last segment - remove matching items from array
      // Iterate backwards to maintain indices during removal
      for (let index_ = object.length - 1; index_ >= 0; index_--) {
        const item = object[index_];
        if (item && typeof item === 'object') {
          const itemValue = (item as Record<string, unknown>)[filter.property];
          if (matchesFilter(itemValue, filter)) object.splice(index_, 1);
        }
      }
    else
      // Middle of path - recurse into matching items
      for (const item of object)
        if (item && typeof item === 'object') {
          const itemValue = (item as Record<string, unknown>)[filter.property];
          if (matchesFilter(itemValue, filter)) deleteJsonPathRecursive(item, parts, index + 1);
        }

    return;
  }

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
  if (skipPaths.length === 0) return data; // Early return avoids expensive clone

  const cloned = structuredClone(data) as Record<string, unknown>;

  for (const path of skipPaths) deleteJsonPath(cloned, path);

  return cloned;
};

export const getSkipPathsForFile = (filePath: string, skipPath?: Record<string, string[]>): string[] => {
  if (!skipPath) return [];

  const pathsToSkip: string[] = [];

  for (const [pattern, paths] of Object.entries(skipPath))
    if (globalMatcher.match(filePath, pattern)) pathsToSkip.push(...paths);

  return pathsToSkip;
};

const processYamlFile = (options: ProcessYamlOptions): ChangedFile | undefined => {
  const { filePath, sourceContent, destinationContent, skipPath, transforms } = options;
  let sourceParsed: unknown;
  let destinationParsed: unknown;

  try {
    sourceParsed = YAML.parse(sourceContent);
  } catch (error) {
    const parseError = new FileDiffError('Failed to parse source YAML file', {
      code: 'YAML_PARSE_ERROR',
      path: filePath,
      cause: error instanceof Error ? error : undefined
    });

    const hints = [
      '\n\n  Hint: YAML syntax error in source file:',
      '\n    - Validate at: https://www.yamllint.com/',
      '\n    - Common issues: incorrect indentation, missing quotes, invalid characters'
    ].join('');
    parseError.message += hints;

    throw parseError;
  }

  try {
    destinationParsed = YAML.parse(destinationContent);
  } catch (error) {
    const parseError = new FileDiffError('Failed to parse destination YAML file', {
      code: 'YAML_PARSE_ERROR',
      path: filePath,
      cause: error instanceof Error ? error : undefined
    });

    const destinationHints = [
      '\n\n  Hint: YAML syntax error in destination file:',
      '\n    - Validate at: https://www.yamllint.com/',
      '\n    - Common issues: incorrect indentation, missing quotes, invalid characters'
    ].join('');
    parseError.message += destinationHints;

    throw parseError;
  }

  const sourceTransformed = applyTransforms(sourceParsed, filePath, transforms);

  const pathsToSkip = getSkipPathsForFile(filePath, skipPath);

  const sourceFiltered = pathsToSkip.length > 0 ? applySkipPaths(sourceTransformed, pathsToSkip) : sourceTransformed;

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
    skipPaths: pathsToSkip,
    normalizedSource,
    normalizedDest: normalizedDestination,
    parsedSource: sourceParsed,
    parsedDest: destinationParsed
  };
};

const processChangedFiles = (
  sourceFiles: FileMap,
  destinationFiles: FileMap,
  skipPath?: Record<string, string[]>,
  transforms?: TransformConfig,
  originalPaths?: Map<string, string>
): { changedFiles: ChangedFile[]; unchangedFiles: string[] } => {
  const changedFiles: ChangedFile[] = [];
  const unchangedFiles: string[] = [];

  for (const [path, sourceContent] of sourceFiles.entries()) {
    if (!destinationFiles.has(path)) continue;

    const destinationContent = destinationFiles.get(path)!;
    const originalPath = originalPaths?.get(path);

    const isYaml = isYamlFile(path);

    if (isYaml) {
      const changed = processYamlFile({
        filePath: path,
        sourceContent,
        destinationContent,
        skipPath,
        transforms
      });

      if (changed) {
        if (originalPath) changed.originalPath = originalPath;
        changedFiles.push(changed);
      } else unchangedFiles.push(path);
    } else if (sourceContent === destinationContent) unchangedFiles.push(path);
    else
      changedFiles.push({
        path,
        originalPath,
        sourceContent,
        destinationContent: destinationContent,
        processedSourceContent: sourceContent,
        processedDestContent: destinationContent,
        rawParsedSource: sourceContent,
        rawParsedDest: destinationContent,
        skipPaths: []
      });
  }

  return { changedFiles, unchangedFiles };
};

// Public API
export const computeFileDiff = (
  sourceFiles: FileMap,
  destinationFiles: FileMap,
  config: Config,
  logger?: import('./logger').Logger,
  originalPaths?: Map<string, string>
): FileDiffResult => {
  // Add verbose debug output
  if (logger?.shouldShow('debug')) {
    logger.debug('Computing file differences:');
    logger.debug(`  Source files: ${sourceFiles.size}`);
    logger.debug(`  Destination files: ${destinationFiles.size}`);

    const transformCount = Object.keys(config.transforms || {}).length;
    if (transformCount > 0) logger.debug(`  Content transform patterns: ${transformCount}`);

    const skipPathCount = Object.keys(config.skipPath || {}).length;
    if (skipPathCount > 0) logger.debug(`  SkipPath patterns: ${skipPathCount}`);
  }

  const addedFiles = detectAddedFiles(sourceFiles, destinationFiles);

  const deletedFiles = config.prune ? detectDeletedFiles(sourceFiles, destinationFiles) : [];

  const { changedFiles, unchangedFiles } = processChangedFiles(
    sourceFiles,
    destinationFiles,
    config.skipPath,
    config.transforms,
    originalPaths
  );

  return { addedFiles, deletedFiles, changedFiles, unchangedFiles };
};
