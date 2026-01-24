import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import YAML from 'yaml';

import { Config } from './configFile';
import { formatProgressMessage } from './consoleFormatter';
import { ChangedFile, FileDiffResult } from './fileDiff';
import { FileMap } from './fileLoader';
import { Logger } from './logger';
import {
  findMatchingTargetItem,
  getApplicableArrayFilters,
  itemMatchesAnyFilter,
  shouldPreserveItem
} from './utils/arrayMerger';
import { createErrorClass, createErrorTypeGuard } from './utils/errors';
import { isYamlFile } from './utils/fileType';
import { applyFixedValues, getFixedValuesForFile } from './utils/fixedValues';
import { applyTransforms } from './utils/transformer';
import { formatYaml } from './yamlFormatter';

// Types
export interface FileUpdateError {
  operation: 'add' | 'update' | 'delete';
  path: string;
  error: Error;
}

export interface FileOperationOptions {
  relativePath: string;
  content: string;
  absoluteDestinationDirectory: string;
  config: Config;
  dryRun: boolean;
  skipFormat: boolean;
  logger: Logger;
}

export interface UpdateFileOptions {
  changedFile: ChangedFile;
  absoluteDestinationDirectory: string;
  config: Config;
  dryRun: boolean;
  skipFormat: boolean;
  logger: Logger;
}

interface OperationContext {
  absoluteDestinationDirectory: string;
  config: Config;
  dryRun: boolean;
  skipFormat: boolean;
  logger: Logger;
  errors: FileUpdateError[];
}

// Error Handling
const FileUpdaterErrorClass = createErrorClass('File Updater Error', {
  WRITE_FAILED: 'File write operation failed',
  DELETE_FAILED: 'File deletion failed',
  MKDIR_FAILED: 'Directory creation failed',
  YAML_PARSE_ERROR: 'YAML file could not be parsed',
  YAML_MERGE_ERROR: 'YAML merge operation failed',
  YAML_SERIALIZE_ERROR: 'YAML serialization failed',
  UPDATE_FAILED: 'Failed to update one or more files'
});

export class FileUpdaterError extends FileUpdaterErrorClass {}
export const isFileUpdaterError = createErrorTypeGuard(FileUpdaterError);

// Helper Functions
const validateDestinationDirectory = async (destinationPath: string): Promise<string> => {
  const absolutePath = path.resolve(destinationPath);

  try {
    const stats = await stat(absolutePath);

    if (!stats.isDirectory())
      throw new FileUpdaterError('Destination path is not a directory', {
        code: 'INVALID_DESTINATION',
        path: absolutePath
      });

    return absolutePath;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      throw new FileUpdaterError('Destination directory does not exist', { code: 'ENOENT', path: absolutePath });

    if (error instanceof FileUpdaterError) throw error;

    throw new FileUpdaterError('Failed to validate destination directory', {
      code: (error as NodeJS.ErrnoException).code,
      path: absolutePath,
      cause: error as Error
    });
  }
};

const ensureParentDirectory = async (filePath: string): Promise<void> => {
  const directory = path.dirname(filePath);

  try {
    await mkdir(directory, { recursive: true });
  } catch (error) {
    throw new FileUpdaterError('Failed to create parent directory', {
      code: 'MKDIR_FAILED',
      path: directory,
      cause: error as Error
    });
  }
};

const deepMerge = (
  fullTarget: unknown,
  filteredSource: unknown,
  filteredTarget: unknown,
  currentPath: string[] = [],
  skipPaths: string[] = []
): unknown => {
  // Handle null/undefined cases
  if (filteredSource === null || filteredSource === undefined) return fullTarget;
  if (fullTarget === null || fullTarget === undefined) return filteredSource;

  // Type mismatch: replace with source
  if (typeof fullTarget !== typeof filteredSource) return filteredSource;

  // Arrays: Merge with skipPath-aware preservation
  if (Array.isArray(filteredSource)) {
    const fullTargetArray = Array.isArray(fullTarget) ? (fullTarget as unknown[]) : [];
    const filteredTargetArray = Array.isArray(filteredTarget) ? (filteredTarget as unknown[]) : [];
    const applicableFilters = getApplicableArrayFilters(currentPath, skipPaths);

    // No applicable filters - replace entirely
    if (applicableFilters.length === 0) return filteredSource;

    // Check if any filter has remaining path (nested skipPath like `env[name=DEBUG].value`)
    const hasNestedFilters = applicableFilters.some((f) => f.remainingPath.length > 0);

    // Process source items - merge with fullTarget items to preserve nested skipped fields
    const result: unknown[] = [];
    for (const sourceItem of filteredSource) {
      if (hasNestedFilters && sourceItem && typeof sourceItem === 'object') {
        const { matches, matchedFilter } = itemMatchesAnyFilter(sourceItem, applicableFilters);
        if (matches && matchedFilter && matchedFilter.remainingPath.length > 0) {
          // Find the matching item in fullTarget to merge nested fields
          const matchingTargetItem = findMatchingTargetItem(sourceItem, fullTargetArray, applicableFilters);
          const matchingFilteredTargetItem = findMatchingTargetItem(sourceItem, filteredTargetArray, applicableFilters);
          if (matchingTargetItem) {
            // Recursively merge to preserve nested skipped fields
            result.push(deepMerge(matchingTargetItem, sourceItem, matchingFilteredTargetItem, currentPath, skipPaths));
            continue;
          }
        }
      }
      result.push(sourceItem);
    }

    // Add back items from fullTarget that match skipPath filters but aren't in source
    for (const item of fullTargetArray) if (shouldPreserveItem(item, applicableFilters, result)) result.push(item);

    return result;
  }

  // Objects: Merge with skipPath preservation
  if (typeof filteredSource === 'object' && typeof fullTarget === 'object') {
    const sourceObject = filteredSource as Record<string, unknown>;
    const fullTargetObject = fullTarget as Record<string, unknown>;
    const filteredTargetObject = (filteredTarget as Record<string, unknown>) || {};
    const result = { ...sourceObject } as Record<string, unknown>;

    // Add skipPath fields from full target (fields that were filtered out)
    for (const [key, value] of Object.entries(fullTargetObject))
      if (!(key in filteredTargetObject) && !(key in sourceObject)) result[key] = value;

    // Recursively merge fields that exist in source
    for (const [key, value] of Object.entries(sourceObject))
      if (key in fullTargetObject)
        result[key] = deepMerge(
          fullTargetObject[key],
          value,
          filteredTargetObject[key],
          [...currentPath, key],
          skipPaths
        );

    return result;
  }

  // Primitives: Replace
  return filteredSource;
};

const mergeYamlContent = (
  destinationContent: string,
  processedSourceContent: unknown,
  filteredDestinationContent: unknown,
  filePath: string,
  skipPaths: string[] = []
): string => {
  // 1. Parse current destination (full, unfiltered)
  let destinationParsed: unknown;
  try {
    destinationParsed = YAML.parse(destinationContent);
  } catch (error) {
    const parseError = new FileUpdaterError('Failed to parse destination YAML for merge', {
      code: 'YAML_PARSE_ERROR',
      path: filePath,
      cause: error instanceof Error ? error : undefined
    });

    parseError.message += '\n\n  Hint: YAML syntax error in destination file:';
    parseError.message += '\n    - Validate at: https://www.yamllint.com/';
    parseError.message += '\n    - Common issues: incorrect indentation, missing quotes';
    parseError.message += '\n    - Try --skip-format flag if formatting is the issue';

    throw parseError;
  }

  // 2. Deep merge source changes into destination
  let merged: unknown;
  try {
    merged = deepMerge(destinationParsed, processedSourceContent, filteredDestinationContent, [], skipPaths);
  } catch (error) {
    throw new FileUpdaterError('Failed to merge YAML content', {
      code: 'YAML_MERGE_ERROR',
      path: filePath,
      cause: error instanceof Error ? error : undefined
    });
  }

  // 3. Serialize back to YAML
  try {
    return YAML.stringify(merged);
  } catch (error) {
    throw new FileUpdaterError('Failed to serialize merged YAML', {
      code: 'YAML_SERIALIZE_ERROR',
      path: filePath,
      cause: error instanceof Error ? error : undefined
    });
  }
};

const addFile = async (options: FileOperationOptions): Promise<void> => {
  const { relativePath, content, absoluteDestinationDirectory, config, dryRun, skipFormat, logger } = options;
  const absolutePath = path.join(absoluteDestinationDirectory, relativePath);

  if (dryRun) {
    logger.fileOp('add', relativePath, true);
    return;
  }

  let contentToWrite = content;

  // Apply transforms, fixed values, and formatting for YAML files
  if (isYamlFile(relativePath))
    try {
      // Parse YAML
      const parsed = YAML.parse(content);

      // Apply transforms
      const transformed = applyTransforms(parsed, relativePath, config.transforms);

      // Apply fixed values
      const fixedValueRules = getFixedValuesForFile(relativePath, config.fixedValues);
      if (fixedValueRules.length > 0) applyFixedValues(transformed, fixedValueRules);

      // Serialize back to YAML
      contentToWrite = YAML.stringify(transformed);

      // Apply formatting
      const effectiveOutputFormat = skipFormat ? undefined : config.outputFormat;
      contentToWrite = formatYaml(contentToWrite, relativePath, effectiveOutputFormat);
    } catch (error) {
      throw new FileUpdaterError('Failed to process YAML file for adding', {
        code: 'YAML_PARSE_ERROR',
        path: relativePath,
        cause: error instanceof Error ? error : undefined
      });
    }

  try {
    await ensureParentDirectory(absolutePath);
    await writeFile(absolutePath, contentToWrite, 'utf8');
    logger.fileOp('add', relativePath, false);
  } catch (error) {
    throw new FileUpdaterError('Failed to add file', {
      code: (error as NodeJS.ErrnoException).code,
      path: absolutePath,
      cause: error as Error
    });
  }
};

const updateFile = async (options: UpdateFileOptions): Promise<void> => {
  const { changedFile, absoluteDestinationDirectory, config, dryRun, skipFormat, logger } = options;
  const absolutePath = path.join(absoluteDestinationDirectory, changedFile.path);

  if (dryRun) {
    logger.fileOp('update', changedFile.path, true);
    return;
  }

  let contentToWrite: string = isYamlFile(changedFile.path)
    ? mergeYamlContent(
        changedFile.destinationContent,
        changedFile.rawParsedSource,
        changedFile.rawParsedDest,
        changedFile.path,
        changedFile.skipPaths
      )
    : changedFile.sourceContent;

  if (isYamlFile(changedFile.path)) {
    // Apply fixed values after merge, before formatting
    const fixedValueRules = getFixedValuesForFile(changedFile.path, config.fixedValues);
    if (fixedValueRules.length > 0) {
      const parsed = YAML.parse(contentToWrite);
      applyFixedValues(parsed, fixedValueRules);
      contentToWrite = YAML.stringify(parsed);
    }

    const effectiveOutputFormat = skipFormat ? undefined : config.outputFormat;
    contentToWrite = formatYaml(contentToWrite, changedFile.path, effectiveOutputFormat);
  }

  try {
    await ensureParentDirectory(absolutePath);
    await writeFile(absolutePath, contentToWrite, 'utf8');
    logger.fileOp('update', changedFile.path, false);
  } catch (error) {
    throw new FileUpdaterError('Failed to update file', {
      code: (error as NodeJS.ErrnoException).code,
      path: absolutePath,
      cause: error as Error
    });
  }
};

const deleteFile = async (
  relativePath: string,
  absoluteDestinationDirectory: string,
  dryRun: boolean,
  logger: Logger
): Promise<void> => {
  const absolutePath = path.join(absoluteDestinationDirectory, relativePath);

  if (dryRun) {
    logger.fileOp('delete', relativePath, true);
    return;
  }

  try {
    await unlink(absolutePath);
    logger.fileOp('delete', relativePath, false);
  } catch (error) {
    // Ignore if file doesn't exist (already deleted)
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.fileOp('delete', relativePath, false, true);
      return;
    }

    throw new FileUpdaterError('Failed to delete file', {
      code: (error as NodeJS.ErrnoException).code,
      path: absolutePath,
      cause: error as Error
    });
  }
};

// Helper functions for file operations
const addNewFiles = async (files: string[], sourceFiles: FileMap, context: OperationContext): Promise<void> => {
  if (context.logger.shouldShow('debug')) context.logger.debug(`Processing ${files.length} new files`);

  for (const relativePath of files)
    try {
      const content = sourceFiles.get(relativePath)!;
      await addFile({
        relativePath,
        content,
        absoluteDestinationDirectory: context.absoluteDestinationDirectory,
        config: context.config,
        dryRun: context.dryRun,
        skipFormat: context.skipFormat,
        logger: context.logger
      });
    } catch (error) {
      context.errors.push({ operation: 'add', path: relativePath, error: error as Error });
    }
};

const updateChangedFiles = async (files: ChangedFile[], context: OperationContext): Promise<void> => {
  if (context.logger.shouldShow('debug')) context.logger.debug(`Updating ${files.length} changed files`);

  for (const changedFile of files)
    try {
      await updateFile({
        changedFile,
        absoluteDestinationDirectory: context.absoluteDestinationDirectory,
        config: context.config,
        dryRun: context.dryRun,
        skipFormat: context.skipFormat,
        logger: context.logger
      });
    } catch (error) {
      context.errors.push({ operation: 'update', path: changedFile.path, error: error as Error });
    }
};

const formatUnchangedFiles = async (
  files: string[],
  destinationFiles: FileMap,
  context: OperationContext
): Promise<string[]> => {
  const formattedFiles: string[] = [];

  for (const relativePath of files)
    if (isYamlFile(relativePath))
      try {
        const content = destinationFiles.get(relativePath)!;
        const effectiveOutputFormat = context.skipFormat ? undefined : context.config.outputFormat;
        const formatted = formatYaml(content, relativePath, effectiveOutputFormat);

        if (formatted !== content) {
          const absolutePath = path.join(context.absoluteDestinationDirectory, relativePath);

          if (context.dryRun) context.logger.fileOp('format', relativePath, true);
          else {
            await ensureParentDirectory(absolutePath);
            await writeFile(absolutePath, formatted, 'utf8');
            context.logger.fileOp('format', relativePath, false);
          }

          formattedFiles.push(relativePath);
        }
      } catch (error) {
        context.errors.push({ operation: 'update', path: relativePath, error: error as Error });
      }

  return formattedFiles;
};

const deleteRemovedFiles = async (files: string[], context: OperationContext): Promise<void> => {
  for (const relativePath of files)
    try {
      await deleteFile(relativePath, context.absoluteDestinationDirectory, context.dryRun, context.logger);
    } catch (error) {
      context.errors.push({ operation: 'delete', path: relativePath, error: error as Error });
    }
};

// Public API
export const updateFiles = async (
  diffResult: FileDiffResult,
  sourceFiles: FileMap,
  destinationFiles: FileMap,
  config: Config,
  dryRun: boolean,
  skipFormat: boolean,
  logger: Logger
): Promise<string[]> => {
  logger.log('\n' + formatProgressMessage('Updating files...', 'info'));

  const absoluteDestinationDirectory = await validateDestinationDirectory(config.destination);
  const errors: FileUpdateError[] = [];

  // Stop rules validation is performed in src/index.ts before updateFiles is called
  // This function assumes validation has already passed or --force was used

  const context: OperationContext = {
    absoluteDestinationDirectory,
    config,
    dryRun,
    skipFormat,
    logger,
    errors
  };

  // Perform file operations
  await addNewFiles(diffResult.addedFiles, sourceFiles, context);
  await updateChangedFiles(diffResult.changedFiles, context);
  const formattedFiles = await formatUnchangedFiles(diffResult.unchangedFiles, destinationFiles, context);
  await deleteRemovedFiles(diffResult.deletedFiles, context);

  // Report summary
  if (dryRun) {
    logger.log('\n[DRY RUN] Would perform:');
    logger.log(`  ${diffResult.addedFiles.length} files would be added`);
    logger.log(`  ${diffResult.changedFiles.length} files would be updated`);
    logger.log(`  ${formattedFiles.length} files would be formatted`);
    logger.log(`  ${diffResult.deletedFiles.length} files would be deleted`);
  } else {
    logger.log('\n✓ Files updated successfully:');
    logger.log(`  ${diffResult.addedFiles.length} files added`);
    logger.log(`  ${diffResult.changedFiles.length} files updated`);
    logger.log(`  ${formattedFiles.length} files formatted`);
    logger.log(`  ${diffResult.deletedFiles.length} files deleted`);
  }

  // Report errors if any occurred
  if (errors.length > 0) {
    logger.error(`\n❌ Encountered ${errors.length} error(s):`, 'critical');
    for (const { operation, path: errorPath, error } of errors)
      logger.error(`  [${operation}] ${errorPath}: ${error.message}`, 'critical');

    throw new FileUpdaterError(`Failed to update ${errors.length} file(s)`, { code: 'UPDATE_FAILED' });
  }

  return formattedFiles;
};
