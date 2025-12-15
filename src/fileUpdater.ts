import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import YAML from 'yaml';

import { Config } from './configFile';
import { ChangedFile, FileDiffResult } from './fileDiff';
import { FileMap } from './fileLoader';
import { formatYaml } from './yamlFormatter';

// Types
export interface FileUpdateError {
  operation: 'add' | 'update' | 'delete';
  path: string;
  error: Error;
}

// Error Handling
export class FileUpdaterError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly path?: string,
    public override readonly cause?: Error
  ) {
    super(FileUpdaterError.formatMessage(message, code, path, cause));
    this.name = 'FileUpdaterError';
  }

  private static formatMessage = (message: string, code?: string, path?: string, cause?: Error): string => {
    let fullMessage = `File Updater Error: ${message}`;

    if (path) fullMessage += `\n  Path: ${path}`;

    if (code) {
      const codeExplanations: Record<string, string> = {
        WRITE_FAILED: 'File write operation failed',
        DELETE_FAILED: 'File deletion failed',
        MKDIR_FAILED: 'Directory creation failed',
        YAML_PARSE_ERROR: 'YAML file could not be parsed',
        YAML_MERGE_ERROR: 'YAML merge operation failed',
        YAML_SERIALIZE_ERROR: 'YAML serialization failed',
        UPDATE_FAILED: 'Failed to update one or more files'
      };

      const explanation = codeExplanations[code] || `Error (${code})`;
      fullMessage += `\n  Reason: ${explanation}`;
    }

    if (cause) fullMessage += `\n  Details: ${cause.message}`;

    return fullMessage;
  };
}

export const isFileUpdaterError = (error: unknown): error is FileUpdaterError => error instanceof FileUpdaterError;

// Helper Functions
const validateDestinationDirectory = async (destinationPath: string): Promise<string> => {
  const absolutePath = path.resolve(destinationPath);

  try {
    const stats = await stat(absolutePath);

    if (!stats.isDirectory())
      throw new FileUpdaterError('Destination path is not a directory', 'INVALID_DESTINATION', absolutePath);

    return absolutePath;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      throw new FileUpdaterError('Destination directory does not exist', 'ENOENT', absolutePath);

    if (error instanceof FileUpdaterError) throw error;

    throw new FileUpdaterError(
      'Failed to validate destination directory',
      (error as NodeJS.ErrnoException).code,
      absolutePath,
      error as Error
    );
  }
};

const ensureParentDirectory = async (filePath: string): Promise<void> => {
  const directory = path.dirname(filePath);

  try {
    await mkdir(directory, { recursive: true });
  } catch (error) {
    throw new FileUpdaterError('Failed to create parent directory', 'MKDIR_FAILED', directory, error as Error);
  }
};

const isYamlFile = (filePath: string): boolean => {
  return /\.ya?ml$/i.test(filePath);
};

const deepMerge = (target: unknown, source: unknown): unknown => {
  // Handle null/undefined cases
  if (source === null || source === undefined) return target;
  if (target === null || target === undefined) return source;

  // Type mismatch: replace with source
  if (typeof target !== typeof source) return source;

  // Arrays: Replace entirely (no element-by-element merge)
  if (Array.isArray(source)) return source;

  // Objects: Recursive merge
  if (typeof source === 'object' && typeof target === 'object') {
    const result = { ...target } as Record<string, unknown>;

    for (const [key, value] of Object.entries(source as Record<string, unknown>))
      result[key] = key in result ? deepMerge(result[key], value) : value;

    return result;
  }

  // Primitives: Replace
  return source;
};

const mergeYamlContent = (destinationContent: string, processedSourceContent: unknown, filePath: string): string => {
  // 1. Parse current destination (full, unfiltered)
  let destinationParsed: unknown;
  try {
    destinationParsed = YAML.parse(destinationContent);
  } catch (error) {
    throw new FileUpdaterError(
      'Failed to parse destination YAML for merge',
      'YAML_PARSE_ERROR',
      filePath,
      error instanceof Error ? error : undefined
    );
  }

  // 2. Deep merge source changes into destination
  let merged: unknown;
  try {
    merged = deepMerge(destinationParsed, processedSourceContent);
  } catch (error) {
    throw new FileUpdaterError(
      'Failed to merge YAML content',
      'YAML_MERGE_ERROR',
      filePath,
      error instanceof Error ? error : undefined
    );
  }

  // 3. Serialize back to YAML
  try {
    // TODO: Apply config.outputFormat (indent, quoteValues) when implemented
    // Current: Using YAML.stringify() with default options
    return YAML.stringify(merged);
  } catch (error) {
    throw new FileUpdaterError(
      'Failed to serialize merged YAML',
      'YAML_SERIALIZE_ERROR',
      filePath,
      error instanceof Error ? error : undefined
    );
  }
};

const addFile = async (
  relativePath: string,
  content: string,
  absoluteDestinationDirectory: string,
  config: Config,
  dryRun: boolean
): Promise<void> => {
  const absolutePath = path.join(absoluteDestinationDirectory, relativePath);

  if (dryRun) {
    console.log(`  [DRY RUN] Would add: ${relativePath}`);
    return;
  }

  let contentToWrite = content;
  if (isYamlFile(relativePath)) contentToWrite = formatYaml(content, relativePath, config.outputFormat);

  try {
    await ensureParentDirectory(absolutePath);
    await writeFile(absolutePath, contentToWrite, 'utf8');
    console.log(`  + ${relativePath}`);
  } catch (error) {
    throw new FileUpdaterError(
      'Failed to add file',
      (error as NodeJS.ErrnoException).code,
      absolutePath,
      error as Error
    );
  }
};

const updateFile = async (
  changedFile: ChangedFile,
  absoluteDestinationDirectory: string,
  config: Config,
  dryRun: boolean
): Promise<void> => {
  const absolutePath = path.join(absoluteDestinationDirectory, changedFile.path);

  if (dryRun) {
    console.log(`  [DRY RUN] Would update: ${changedFile.path}`);
    return;
  }

  let contentToWrite: string = isYamlFile(changedFile.path)
    ? mergeYamlContent(changedFile.destinationContent, changedFile.processedSourceContent, changedFile.path)
    : changedFile.sourceContent;

  if (isYamlFile(changedFile.path)) contentToWrite = formatYaml(contentToWrite, changedFile.path, config.outputFormat);

  try {
    await ensureParentDirectory(absolutePath);
    await writeFile(absolutePath, contentToWrite, 'utf8');
    console.log(`  ~ ${changedFile.path}`);
  } catch (error) {
    throw new FileUpdaterError(
      'Failed to update file',
      (error as NodeJS.ErrnoException).code,
      absolutePath,
      error as Error
    );
  }
};

const deleteFile = async (
  relativePath: string,
  absoluteDestinationDirectory: string,
  dryRun: boolean
): Promise<void> => {
  const absolutePath = path.join(absoluteDestinationDirectory, relativePath);

  if (dryRun) {
    console.log(`  [DRY RUN] Would delete: ${relativePath}`);
    return;
  }

  try {
    await unlink(absolutePath);
    console.log(`  - ${relativePath}`);
  } catch (error) {
    // Ignore if file doesn't exist (already deleted)
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log(`  - ${relativePath} (already deleted)`);
      return;
    }

    throw new FileUpdaterError(
      'Failed to delete file',
      (error as NodeJS.ErrnoException).code,
      absolutePath,
      error as Error
    );
  }
};

// Public API
export const updateFiles = async (
  diffResult: FileDiffResult,
  sourceFiles: FileMap,
  config: Config,
  dryRun: boolean
): Promise<string[]> => {
  console.log('\nUpdating files...');

  const absoluteDestinationDirectory = await validateDestinationDirectory(config.destination);
  const errors: FileUpdateError[] = [];

  // Stop rules validation is performed in src/index.ts before updateFiles is called
  // This function assumes validation has already passed or --force was used

  // Add new files
  for (const relativePath of diffResult.addedFiles)
    try {
      const content = sourceFiles.get(relativePath)!;
      await addFile(relativePath, content, absoluteDestinationDirectory, config, dryRun);
    } catch (error) {
      errors.push({ operation: 'add', path: relativePath, error: error as Error });
    }

  // Update changed files
  for (const changedFile of diffResult.changedFiles)
    try {
      await updateFile(changedFile, absoluteDestinationDirectory, config, dryRun);
    } catch (error) {
      errors.push({ operation: 'update', path: changedFile.path, error: error as Error });
    }

  // Format unchanged YAML files
  const formattedFiles: string[] = [];
  for (const relativePath of diffResult.unchangedFiles)
    if (isYamlFile(relativePath))
      try {
        const content = sourceFiles.get(relativePath)!;
        const formatted = formatYaml(content, relativePath, config.outputFormat);

        if (formatted !== content) {
          const absolutePath = path.join(absoluteDestinationDirectory, relativePath);

          if (dryRun) console.log(`  [DRY RUN] Would format: ${relativePath}`);
          else {
            await ensureParentDirectory(absolutePath);
            await writeFile(absolutePath, formatted, 'utf8');
            console.log(`  ≈ ${relativePath}`);
          }

          formattedFiles.push(relativePath);
        }
      } catch (error) {
        errors.push({ operation: 'update', path: relativePath, error: error as Error });
      }

  // Delete removed files
  for (const relativePath of diffResult.deletedFiles)
    try {
      await deleteFile(relativePath, absoluteDestinationDirectory, dryRun);
    } catch (error) {
      errors.push({ operation: 'delete', path: relativePath, error: error as Error });
    }

  // Report summary
  if (dryRun) {
    console.log('\n[DRY RUN] Would perform:');
    console.log(`  ${diffResult.addedFiles.length} files would be added`);
    console.log(`  ${diffResult.changedFiles.length} files would be updated`);
    console.log(`  ${formattedFiles.length} files would be formatted`);
    console.log(`  ${diffResult.deletedFiles.length} files would be deleted`);
  } else {
    console.log('\n✓ Files updated successfully:');
    console.log(`  ${diffResult.addedFiles.length} files added`);
    console.log(`  ${diffResult.changedFiles.length} files updated`);
    console.log(`  ${formattedFiles.length} files formatted`);
    console.log(`  ${diffResult.deletedFiles.length} files deleted`);
  }

  // Report errors if any occurred
  if (errors.length > 0) {
    console.error(`\n❌ Encountered ${errors.length} error(s):`);
    for (const { operation, path: errorPath, error } of errors)
      console.error(`  [${operation}] ${errorPath}: ${error.message}`);

    throw new FileUpdaterError(`Failed to update ${errors.length} file(s)`, 'UPDATE_FAILED');
  }

  return formattedFiles;
};
