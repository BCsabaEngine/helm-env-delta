import fs from 'node:fs';
import path from 'node:path';

import * as YAML from 'yaml';

import type { TransformRule } from '../configFile';
import { createErrorClass, createErrorTypeGuard } from './errors';

// ============================================================================
// Error Handling
// ============================================================================

export const TransformFileLoaderError = createErrorClass('TransformFileLoaderError', {
  FILE_NOT_FOUND: 'Transform file not found',
  ENOENT: 'Transform file does not exist',
  PARSE_ERROR: 'Failed to parse YAML transform file',
  INVALID_FORMAT: 'Transform file must contain flat key:value pairs (strings only, no nested objects or arrays)'
});

export const isTransformFileLoaderError = createErrorTypeGuard(TransformFileLoaderError);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Escapes special regex characters for literal string matching.
 * Converts a string into a regex pattern that matches it exactly.
 *
 * @param str - The string to escape
 * @returns Escaped string safe for use in RegExp constructor
 *
 * @example
 * escapeRegex('example.com') // 'example\\.com'
 * escapeRegex('10.0.0.1') // '10\\.0\\.0\\.1'
 * escapeRegex('[test]') // '\\[test\\]'
 */
export const escapeRegex = (string_: string): string => string_.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);

/**
 * Validates that a value is a flat key:value object (Record<string, string>).
 * Rejects nested objects, arrays, and non-string values.
 *
 * @param data - The parsed YAML data to validate
 * @returns The data cast as Record<string, string>
 * @throws {TransformFileLoaderError} If format is invalid
 */
const validateTransformFileFormat = (data: unknown): Record<string, string> => {
  if (typeof data !== 'object' || data === null || Array.isArray(data))
    throw new TransformFileLoaderError('Transform file must be a YAML object with key:value pairs', {
      code: 'INVALID_FORMAT'
    });

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (typeof value !== 'string')
      throw new TransformFileLoaderError(`All values must be strings. Key "${key}" has value of type ${typeof value}`, {
        code: 'INVALID_FORMAT'
      });

    if (typeof value === 'object')
      throw new TransformFileLoaderError(`Nested objects not allowed. Key "${key}" contains an object`, {
        code: 'INVALID_FORMAT'
      });
  }

  return data as Record<string, string>;
};

// ============================================================================
// File Loading Functions
// ============================================================================

/**
 * Loads a single transform file and converts it to find/replace rules.
 * Transform files contain key:value pairs for literal string replacement.
 * Keys and values are escaped for regex safety (literal matching only).
 *
 * @param filePath - Path to the transform file (relative to config or absolute)
 * @param configDirectory - Directory of the config file (for resolving relative paths)
 * @returns Array of transform rules with escaped regex patterns
 * @throws {TransformFileLoaderError} If file not found, parse error, or invalid format
 *
 * @example
 * // transforms/uat-to-prod.yaml:
 * // uat-cluster: prod-cluster
 * // uat.internal.example.com: prod.internal.example.com
 *
 * loadTransformFile('./transforms/uat-to-prod.yaml', '/config')
 * // Returns: [
 * //   { find: 'uat-cluster', replace: 'prod-cluster' },
 * //   { find: 'uat\\.internal\\.example\\.com', replace: 'prod.internal.example.com' }
 * // ]
 */
export const loadTransformFile = (filePath: string, configDirectory: string): TransformRule[] => {
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(configDirectory, filePath);

  // Read file
  let fileContent: string;
  try {
    fileContent = fs.readFileSync(resolvedPath, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'ENOENT' : 'FILE_NOT_FOUND';
    throw new TransformFileLoaderError(`Cannot read transform file`, {
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
    throw new TransformFileLoaderError('Invalid YAML syntax', {
      code: 'PARSE_ERROR',
      path: resolvedPath,
      cause: error as Error
    });
  }

  // Handle empty file
  if (parsedData === null || parsedData === undefined) return [];

  // Validate format
  const validatedData = validateTransformFileFormat(parsedData);

  // Convert to transform rules with escaped regex patterns (literal matching)
  return Object.entries(validatedData).map(([key, value]) => ({
    find: escapeRegex(key),
    replace: value
  }));
};

/**
 * Loads multiple transform files and merges them into a single array.
 * Files are processed in order. Duplicate keys from later files override earlier ones
 * (last file wins).
 *
 * @param filePaths - Array of file paths or a single file path string
 * @param configDirectory - Directory of the config file (for resolving relative paths)
 * @returns Merged array of transform rules
 * @throws {TransformFileLoaderError} If any file fails to load
 *
 * @example
 * loadTransformFiles(['./common.yaml', './uat-to-prod.yaml'], '/config')
 * // Loads both files and merges results (later files override earlier ones)
 */
export const loadTransformFiles = (filePaths: string | string[], configDirectory: string): TransformRule[] => {
  const paths = Array.isArray(filePaths) ? filePaths : [filePaths];

  // Load all files and flatten
  const allRules: TransformRule[] = [];
  for (const filePath of paths) {
    const rules = loadTransformFile(filePath, configDirectory);
    allRules.push(...rules);
  }

  return allRules;
};
