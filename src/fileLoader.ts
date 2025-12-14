import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { glob } from 'tinyglobby';

// Types
export interface FileLoaderOptions {
  baseDirectory: string;
  include: string[];
  exclude: string[];
}

export type FileMap = Map<string, string>;

// Error Handling
export class FileLoaderError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly path?: string,
    public readonly cause?: Error
  ) {
    super(FileLoaderError.formatMessage(message, code, path, cause));
    this.name = 'FileLoaderError';
  }

  private static formatMessage = (message: string, code?: string, path?: string, cause?: Error): string => {
    let fullMessage = `File Loader Error: ${message}`;

    if (path) fullMessage += `\n  Path: ${path}`;

    if (code) {
      const codeExplanations: Record<string, string> = {
        ENOENT: 'File or directory not found',
        EACCES: 'Permission denied',
        EISDIR: 'Expected file but found directory',
        ENOTDIR: 'Expected directory but found file',
        EMFILE: 'Too many open files',
        ENOMEM: 'Out of memory',
        ENOTSUP: 'Binary files are not supported'
      };

      const explanation = codeExplanations[code] || `System error (${code})`;
      fullMessage += `\n  Reason: ${explanation}`;
    }

    if (cause) fullMessage += `\n  Details: ${cause.message}`;

    return fullMessage;
  };
}

export const isFileLoaderError = (error: unknown): error is FileLoaderError => error instanceof FileLoaderError;

// Helper Functions
const sortMapByKeys = (map: FileMap): FileMap => {
  // eslint-disable-next-line unicorn/no-array-sort -- toSorted not available in ES2020, spread creates new array
  const sortedEntries = [...map.entries()].sort(([keyA], [keyB]: [string, string]) => keyA.localeCompare(keyB));

  return new Map(sortedEntries);
};

const validateAndResolveBaseDirectory = async (baseDirectory: string): Promise<string> => {
  const absolutePath = path.isAbsolute(baseDirectory) ? baseDirectory : path.resolve(process.cwd(), baseDirectory);

  try {
    const stats = await stat(absolutePath);

    if (!stats.isDirectory()) throw new FileLoaderError('Base path is not a directory', 'ENOTDIR', absolutePath);

    return absolutePath;
  } catch (error: unknown) {
    if (isFileLoaderError(error)) throw error;

    const nodeError = error as NodeJS.ErrnoException;
    throw new FileLoaderError('Failed to access base directory', nodeError.code, absolutePath, nodeError);
  }
};

const findMatchingFiles = async (
  baseDirectory: string,
  includePatterns: string[],
  excludePatterns: string[]
): Promise<string[]> => {
  try {
    const allPatterns = [...includePatterns, ...excludePatterns.map((pattern) => `!${pattern}`)];

    const matchedFiles = await glob(allPatterns, {
      cwd: baseDirectory,
      absolute: true,
      onlyFiles: true,
      dot: false,
      followSymbolicLinks: false
    });

    return matchedFiles;
  } catch (error: unknown) {
    throw new FileLoaderError(
      'Failed to search for files using glob patterns',
      undefined,
      baseDirectory,
      error instanceof Error ? error : undefined
    );
  }
};

const readFilesIntoMap = async (baseDirectory: string, absoluteFilePaths: string[]): Promise<FileMap> => {
  const fileMap = new Map<string, string>();

  const readPromises = absoluteFilePaths.map(async (absolutePath) => {
    try {
      const content = await readFile(absolutePath, 'utf8');

      if (content.includes('\0')) throw new FileLoaderError('Binary file detected', 'ENOTSUP', absolutePath);

      const relativePath = path.relative(baseDirectory, absolutePath);

      return { relativePath, content };
    } catch (error: unknown) {
      if (isFileLoaderError(error)) throw error;

      const nodeError = error as NodeJS.ErrnoException;
      throw new FileLoaderError('Failed to read file', nodeError.code, absolutePath, nodeError);
    }
  });

  try {
    const results = await Promise.all(readPromises);

    for (const { relativePath, content } of results) fileMap.set(relativePath, content);

    return fileMap;
  } catch (error: unknown) {
    if (isFileLoaderError(error)) throw error;

    throw new FileLoaderError(
      'Failed to read one or more files',
      undefined,
      undefined,
      error instanceof Error ? error : undefined
    );
  }
};

// Loads files from a directory based on include/exclude glob patterns.
export const loadFiles = async (options: FileLoaderOptions): Promise<FileMap> => {
  const absoluteBaseDirectory = await validateAndResolveBaseDirectory(options.baseDirectory);

  const includePatterns = options.include ?? ['**/*'];
  const excludePatterns = options.exclude ?? [];

  const files = await findMatchingFiles(absoluteBaseDirectory, includePatterns, excludePatterns);

  const fileMap = await readFilesIntoMap(absoluteBaseDirectory, files);

  return sortMapByKeys(fileMap);
};
