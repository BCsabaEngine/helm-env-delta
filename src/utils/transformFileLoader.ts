import type { TransformRule } from '../config';
import { createErrorClass, createErrorTypeGuard } from './errors';
import { escapeRegex, isYamlFileLoaderError, loadYamlFile } from './yamlFileLoader';

// ============================================================================
// Error Handling
// ============================================================================

export const TransformFileLoaderError = createErrorClass('TransformFileLoaderError', {
  INVALID_FORMAT: 'Transform file must contain flat key:value pairs (strings only, no nested objects or arrays)'
});

export const isTransformFileLoaderError = createErrorTypeGuard(TransformFileLoaderError);

// ============================================================================
// Helper Functions
// ============================================================================

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
  let parsedData: unknown;

  try {
    parsedData = loadYamlFile(filePath, configDirectory, 'transform');
  } catch (error) {
    // Re-throw with TransformFileLoaderError for backward compatibility
    if (isYamlFileLoaderError(error))
      throw new TransformFileLoaderError(error.message, {
        code: 'INVALID_FORMAT',
        cause: error
      });
    throw error;
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
