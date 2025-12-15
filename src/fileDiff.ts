import { isMatch } from 'picomatch';
import YAML from 'yaml';

import { Config } from './configFile';
import { FileMap } from './fileLoader';

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
}

// Error Handling
export class FileDiffError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly path?: string,
    public override readonly cause?: Error
  ) {
    super(FileDiffError.formatMessage(message, code, path, cause));
    this.name = 'FileDiffError';
  }

  private static formatMessage = (message: string, code?: string, path?: string, cause?: Error): string => {
    let fullMessage = `File Diff Error: ${message}`;

    if (path) fullMessage += `\n  Path: ${path}`;

    if (code) {
      const codeExplanations: Record<string, string> = {
        YAML_PARSE_ERROR: 'YAML file could not be parsed'
      };

      const explanation = codeExplanations[code] || `Error (${code})`;
      fullMessage += `\n  Reason: ${explanation}`;
    }

    if (cause) fullMessage += `\n  Details: ${cause.message}`;

    return fullMessage;
  };
}

export const isFileDiffError = (error: unknown): error is FileDiffError => error instanceof FileDiffError;

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

const parseJsonPath = (path: string): string[] => {
  return path
    .replaceAll(/\[(\*|\d+)]/g, '.$1')
    .split('.')
    .filter((part: string) => part.length > 0);
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

const deepEqual = (a: unknown, b: unknown): boolean => {
  const normalizedA = YAML.stringify(a, {
    indent: 2,
    lineWidth: 0,
    sortMapEntries: true
  });

  const normalizedB = YAML.stringify(b, {
    indent: 2,
    lineWidth: 0,
    sortMapEntries: true
  });

  return normalizedA === normalizedB;
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
    throw new FileDiffError(
      'Failed to parse source YAML file',
      'YAML_PARSE_ERROR',
      filePath,
      error instanceof Error ? error : undefined
    );
  }

  try {
    destinationParsed = YAML.parse(destinationContent);
  } catch (error) {
    throw new FileDiffError(
      'Failed to parse destination YAML file',
      'YAML_PARSE_ERROR',
      filePath,
      error instanceof Error ? error : undefined
    );
  }

  const pathsToSkip = getSkipPathsForFile(filePath, skipPath);

  const sourceFiltered = pathsToSkip.length > 0 ? applySkipPaths(sourceParsed, pathsToSkip) : sourceParsed;

  const destinationFiltered =
    pathsToSkip.length > 0 ? applySkipPaths(destinationParsed, pathsToSkip) : destinationParsed;

  const areEqual = deepEqual(sourceFiltered, destinationFiltered);

  if (areEqual) return undefined;

  return {
    path: filePath,
    sourceContent,
    destinationContent: destinationContent,
    processedSourceContent: sourceFiltered,
    processedDestContent: destinationFiltered
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

    const isYaml = /\.ya?ml$/i.test(path);

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
        processedDestContent: destinationContent
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
