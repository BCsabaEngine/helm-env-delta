import fs from 'node:fs';
import path from 'node:path';

import * as YAML from 'yaml';

import { createErrorClass, createErrorTypeGuard } from './errors';

// ============================================================================
// Error Handling
// ============================================================================

export const YamlFileLoaderError = createErrorClass('YamlFileLoaderError', {
  FILE_NOT_FOUND: 'YAML file not found',
  ENOENT: 'YAML file does not exist',
  PARSE_ERROR: 'Failed to parse YAML file'
});

export const isYamlFileLoaderError = createErrorTypeGuard(YamlFileLoaderError);

// ============================================================================
// Core Utilities
// ============================================================================

/**
 * Loads and parses a YAML file with standardized error handling.
 * Returns null for empty files, parsed data otherwise.
 *
 * @param filePath - Path to the YAML file (relative to config or absolute)
 * @param configDirectory - Directory of the config file (for resolving relative paths)
 * @param fileType - Description of file type for error messages (e.g., 'transform', 'pattern')
 * @returns Parsed YAML data or null for empty files
 * @throws {YamlFileLoaderError} If file not found or parse error
 *
 * @example
 * const data = loadYamlFile('./config.yaml', '/app', 'configuration');
 */
export const loadYamlFile = (filePath: string, configDirectory: string, fileType: string): unknown => {
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(configDirectory, filePath);

  // Read file
  let fileContent: string;
  try {
    fileContent = fs.readFileSync(resolvedPath, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'ENOENT' : 'FILE_NOT_FOUND';
    throw new YamlFileLoaderError(`Cannot read ${fileType} file`, {
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
    throw new YamlFileLoaderError(`Invalid YAML syntax in ${fileType} file`, {
      code: 'PARSE_ERROR',
      path: resolvedPath,
      cause: error as Error
    });
  }

  return parsedData;
};

/**
 * Escapes special regex characters for literal string matching.
 * Converts a string into a regex pattern that matches it exactly.
 *
 * @param value - The string to escape
 * @returns Escaped string safe for use in RegExp constructor
 *
 * @example
 * escapeRegex('example.com') // 'example\\.com'
 * escapeRegex('10.0.0.1') // '10\\.0\\.0\\.1'
 * escapeRegex('[test]') // '\\[test\\]'
 */
export const escapeRegex = (value: string): string => value.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);
