import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { glob } from 'tinyglobby';

import type { TransformConfig } from '../config';
import { createErrorClass, createErrorTypeGuard } from '../utils/errors';
import { transformFilename, transformFilenameMap } from '../utils/filenameTransformer';
import { globalMatcher } from '../utils/patternMatcher';

// Types
export interface FileLoaderOptions {
  baseDirectory: string;
  include: string[];
  exclude: string[];
  transforms?: TransformConfig;
  skipExclude?: boolean;
}

export type FileMap = Map<string, string>;

export interface FileLoaderResult {
  fileMap: FileMap;
  originalPaths: Map<string, string>; // Map<transformedPath, originalPath> - only for transformed files
}

// Error Handling
const FileLoaderErrorClass = createErrorClass('File Loader Error', {
  ENOENT: 'File or directory not found',
  EACCES: 'Permission denied',
  EISDIR: 'Expected file but found directory',
  ENOTDIR: 'Expected directory but found file',
  EMFILE: 'Too many open files',
  ENOMEM: 'Out of memory',
  ENOTSUP: 'Binary files are not supported'
});

export class FileLoaderError extends FileLoaderErrorClass {}
export const isFileLoaderError = createErrorTypeGuard(FileLoaderError);

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

    if (!stats.isDirectory()) {
      const notDirectoryError = new FileLoaderError('Base path is not a directory', {
        code: 'ENOTDIR',
        path: absolutePath
      });

      notDirectoryError.message += '\n\n  Hint: The source path must be a directory, not a file:';
      notDirectoryError.message += `\n    - Current path: ${absolutePath}`;
      notDirectoryError.message += '\n    - Check your config source/destination paths';
      notDirectoryError.message += '\n    - Use the parent directory instead';

      throw notDirectoryError;
    }

    return absolutePath;
  } catch (error: unknown) {
    if (isFileLoaderError(error)) throw error;

    const nodeError = error as NodeJS.ErrnoException;
    const accessError = new FileLoaderError('Failed to access base directory', {
      code: nodeError.code,
      path: absolutePath,
      cause: nodeError
    });

    if (nodeError.code === 'ENOENT') {
      accessError.message += '\n\n  Hint: Directory not found:';
      accessError.message += '\n    - Check your config source/destination paths';
      accessError.message += `\n    - Verify directory exists: ls -la ${path.dirname(absolutePath)}`;
      accessError.message += '\n    - Use absolute paths to avoid ambiguity';
    } else if (nodeError.code === 'EACCES') {
      accessError.message += '\n\n  Hint: Permission denied:';
      accessError.message += `\n    - Check directory permissions: ls -la ${absolutePath}`;
      accessError.message += `\n    - Fix permissions: chmod 755 ${absolutePath}`;
    }

    throw accessError;
  }
};

const findMatchingFiles = async (
  baseDirectory: string,
  includePatterns: string[],
  excludePatterns: string[],
  transforms?: TransformConfig,
  skipExclude?: boolean
): Promise<string[]> => {
  try {
    if (!transforms) {
      const allPatterns = skipExclude
        ? [...includePatterns]
        : [...includePatterns, ...excludePatterns.map((pattern) => `!${pattern}`)];

      const matchedFiles = await glob(allPatterns, {
        cwd: baseDirectory,
        absolute: true,
        onlyFiles: true,
        dot: false,
        followSymbolicLinks: false
      });

      return matchedFiles;
    }

    const allFiles = await glob(['**/*'], {
      cwd: baseDirectory,
      absolute: true,
      onlyFiles: true,
      dot: false,
      followSymbolicLinks: false
    });

    const filtered: string[] = [];

    for (const absolutePath of allFiles) {
      const relativePath = path.relative(baseDirectory, absolutePath);
      const transformedPath = transformFilename(relativePath, transforms);

      const included = includePatterns.some((pattern) => globalMatcher.match(transformedPath, pattern));
      if (!included) continue;

      if (!skipExclude) {
        const excluded = excludePatterns.some((pattern) => globalMatcher.match(transformedPath, pattern));
        if (excluded) continue;
      }

      filtered.push(absolutePath);
    }

    return filtered;
  } catch (error: unknown) {
    throw new FileLoaderError('Failed to search for files using glob patterns', {
      path: baseDirectory,
      cause: error instanceof Error ? error : undefined
    });
  }
};

const readFilesIntoMap = async (baseDirectory: string, absoluteFilePaths: string[]): Promise<FileMap> => {
  const fileMap = new Map<string, string>();

  const readPromises = absoluteFilePaths.map(async (absolutePath) => {
    try {
      const content = await readFile(absolutePath, 'utf8');

      // Check only first 2KB for null bytes (binary files typically have them early)
      const sampleSize = Math.min(content.length, 2048);
      const sample = content.slice(0, sampleSize);
      if (sample.includes('\0')) {
        const binaryError = new FileLoaderError('Binary file detected', {
          code: 'ENOTSUP',
          path: absolutePath
        });

        binaryError.message += '\n\n  Hint: Binary files cannot be processed. Add to exclude:';
        binaryError.message += "\n    exclude: ['**/*.{png,jpg,pdf,zip,tar,gz,bin}']";
        binaryError.message += '\n    Or exclude this specific file pattern';

        throw binaryError;
      }

      const relativePath = path.relative(baseDirectory, absolutePath);

      return { relativePath, content };
    } catch (error: unknown) {
      if (isFileLoaderError(error)) throw error;

      const nodeError = error as NodeJS.ErrnoException;
      throw new FileLoaderError('Failed to read file', { code: nodeError.code, path: absolutePath, cause: nodeError });
    }
  });

  try {
    const results = await Promise.all(readPromises);

    for (const { relativePath, content } of results) fileMap.set(relativePath, content);

    return fileMap;
  } catch (error: unknown) {
    if (isFileLoaderError(error)) throw error;

    throw new FileLoaderError('Failed to read one or more files', {
      cause: error instanceof Error ? error : undefined
    });
  }
};

// Loads files from a directory based on include/exclude glob patterns.
export const loadFiles = async (
  options: FileLoaderOptions,
  logger?: import('../logger').Logger
): Promise<FileLoaderResult> => {
  const absoluteBaseDirectory = await validateAndResolveBaseDirectory(options.baseDirectory);

  const includePatterns = options.include ?? ['**/*'];
  const excludePatterns = options.exclude ?? [];

  const files = await findMatchingFiles(
    absoluteBaseDirectory,
    includePatterns,
    excludePatterns,
    options.transforms,
    options.skipExclude
  );

  if (logger?.shouldShow('debug')) {
    logger.debug('Glob matching:');
    logger.debug(`  Directory: ${absoluteBaseDirectory}`);
    logger.debug(`  Include patterns: ${includePatterns.join(', ')}`);
    logger.debug(`  Exclude patterns: ${excludePatterns.join(', ')}`);
    logger.debug(`  Matched: ${files.length} file(s)`);
  }

  const fileMap = await readFilesIntoMap(absoluteBaseDirectory, files);

  const transformResult = transformFilenameMap(fileMap, options.transforms);

  if (options.transforms && logger?.shouldShow('debug')) {
    logger.debug(`Filename transforms applied: ${fileMap.size} → ${transformResult.fileMap.size} files`);

    // Show up to 3 examples of transformations
    let exampleCount = 0;
    for (const [transformedPath, originalPath] of transformResult.originalPaths.entries()) {
      logger.debug(`  ${originalPath} → ${transformedPath}`);
      exampleCount++;
      if (exampleCount >= 3) break;
    }
  }

  return {
    fileMap: sortMapByKeys(transformResult.fileMap),
    originalPaths: transformResult.originalPaths
  };
};
