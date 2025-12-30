import fs from 'node:fs';
import path from 'node:path';

import * as YAML from 'yaml';

import { createErrorClass, createErrorTypeGuard } from './errors';

// ============================================================================
// Error Handling
// ============================================================================

export const RegexPatternFileLoaderError = createErrorClass('RegexPatternFileLoaderError', {
  FILE_NOT_FOUND: 'Pattern file not found',
  ENOENT: 'Pattern file does not exist',
  PARSE_ERROR: 'Failed to parse YAML pattern file',
  INVALID_FORMAT_NOT_ARRAY: 'Pattern file must contain a YAML array of regex patterns',
  INVALID_FORMAT_NOT_OBJECT: 'Pattern file must contain a YAML object with keys',
  INVALID_REGEX: 'File contains invalid regular expression pattern'
});

export const isRegexPatternFileLoaderError = createErrorTypeGuard(RegexPatternFileLoaderError);

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates that a value is an array of strings.
 *
 * @param data - The parsed YAML data to validate
 * @returns The data cast as string[]
 * @throws {RegexPatternFileLoaderError} If not an array or contains non-string values
 */
const validateArrayFormat = (data: unknown): string[] => {
  if (!Array.isArray(data))
    throw new RegexPatternFileLoaderError('Pattern file must be a YAML array', {
      code: 'INVALID_FORMAT_NOT_ARRAY'
    });

  for (const [index, item] of data.entries())
    if (typeof item !== 'string')
      throw new RegexPatternFileLoaderError(`Array item at index ${index} must be a string, got ${typeof item}`, {
        code: 'INVALID_FORMAT_NOT_ARRAY'
      });

  return data as string[];
};

/**
 * Validates that a value is an object with string keys.
 *
 * @param data - The parsed YAML data to validate
 * @returns The data cast as Record<string, unknown>
 * @throws {RegexPatternFileLoaderError} If not an object or is an array
 */
const validateObjectFormat = (data: unknown): Record<string, unknown> => {
  if (typeof data !== 'object' || data === null || Array.isArray(data))
    throw new RegexPatternFileLoaderError('Pattern file must be a YAML object with keys', {
      code: 'INVALID_FORMAT_NOT_OBJECT'
    });

  return data as Record<string, unknown>;
};

/**
 * Validates that a regex pattern compiles correctly.
 *
 * @param pattern - The regex pattern to validate
 * @param source - Description of where the pattern came from (for error messages)
 * @throws {RegexPatternFileLoaderError} If pattern is invalid
 */
const validateRegexPattern = (pattern: string, source: string): void => {
  try {
    new RegExp(pattern);
  } catch (error) {
    throw new RegexPatternFileLoaderError(`Invalid regex pattern "${pattern}" ${source}`, {
      code: 'INVALID_REGEX',
      cause: error as Error
    });
  }
};

// ============================================================================
// File Loading Functions
// ============================================================================

/**
 * Loads regex patterns from a YAML array file.
 * Each array element should be a valid regex pattern string.
 * Empty files (null or empty array) return an empty array.
 *
 * @param filePath - Path to the pattern file (relative to config or absolute)
 * @param configDirectory - Directory of the config file (for resolving relative paths)
 * @returns Array of regex pattern strings
 * @throws {RegexPatternFileLoaderError} If file not found, invalid format, or invalid regex
 *
 * @example
 * // patterns/forbidden.yaml:
 * // - '^v0\.'
 * // - 'localhost'
 * // - '.*-debug$'
 *
 * loadRegexPatternArray('./patterns/forbidden.yaml', '/config')
 * // Returns: ['^v0\\.', 'localhost', '.*-debug$']
 */
export const loadRegexPatternArray = (filePath: string, configDirectory: string): string[] => {
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(configDirectory, filePath);

  // Read file
  let fileContent: string;
  try {
    fileContent = fs.readFileSync(resolvedPath, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'ENOENT' : 'FILE_NOT_FOUND';
    throw new RegexPatternFileLoaderError(`Cannot read pattern file`, {
      code,
      path: `${filePath} (resolved: ${resolvedPath})`,
      cause: error as Error
    });
  }

  // Parse YAML
  let parsedData: unknown;
  try {
    parsedData = YAML.parse(fileContent);
  } catch (error) {
    throw new RegexPatternFileLoaderError('Invalid YAML syntax', {
      code: 'PARSE_ERROR',
      path: resolvedPath,
      cause: error as Error
    });
  }

  // Handle empty file
  if (parsedData === null || parsedData === undefined) return [];

  // Validate format (must be array)
  const validatedData = validateArrayFormat(parsedData);

  // Validate each regex pattern
  for (const [index, pattern] of validatedData.entries()) validateRegexPattern(pattern, `at index ${index}`);

  return validatedData;
};

/**
 * Loads a transform file and extracts its keys as regex patterns.
 * This allows reusing transform file keys as patterns for stop rules.
 * Empty files return an empty array.
 *
 * @param filePath - Path to the transform file (relative to config or absolute)
 * @param configDirectory - Directory of the config file (for resolving relative paths)
 * @returns Array of keys from the transform file (as regex patterns)
 * @throws {RegexPatternFileLoaderError} If file not found, invalid format, or invalid regex
 *
 * @example
 * // transforms/uat-to-prod.yaml:
 * // uat-cluster: prod-cluster
 * // uat.internal.example.com: prod.internal.example.com
 *
 * loadRegexPatternsFromKeys('./transforms/uat-to-prod.yaml', '/config')
 * // Returns: ['uat-cluster', 'uat.internal.example.com']
 */
export const loadRegexPatternsFromKeys = (filePath: string, configDirectory: string): string[] => {
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(configDirectory, filePath);

  // Read file
  let fileContent: string;
  try {
    fileContent = fs.readFileSync(resolvedPath, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'ENOENT' : 'FILE_NOT_FOUND';
    throw new RegexPatternFileLoaderError(`Cannot read pattern file`, {
      code,
      path: `${filePath} (resolved: ${resolvedPath})`,
      cause: error as Error
    });
  }

  // Parse YAML
  let parsedData: unknown;
  try {
    parsedData = YAML.parse(fileContent);
  } catch (error) {
    throw new RegexPatternFileLoaderError('Invalid YAML syntax', {
      code: 'PARSE_ERROR',
      path: resolvedPath,
      cause: error as Error
    });
  }

  // Handle empty file
  if (parsedData === null || parsedData === undefined) return [];

  // Validate format (must be object with keys)
  const validatedData = validateObjectFormat(parsedData);

  // Extract keys
  const keys = Object.keys(validatedData);

  // Validate each key as a regex pattern
  for (const key of keys) validateRegexPattern(key, `(key: "${key}")`);

  return keys;
};
