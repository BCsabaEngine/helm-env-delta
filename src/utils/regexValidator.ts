/**
 * Consolidated regex validation logic for stop rules.
 * Handles both targeted (with path) and global (pathless) validation modes.
 */

import type { StopRule } from '../config';

// ============================================================================
// Types
// ============================================================================

export interface StopRuleViolation {
  file: string;
  rule: StopRule;
  path: string;
  oldValue: unknown;
  updatedValue: unknown;
  message: string;
}

export interface RegexValidationOptions {
  /** Regex patterns to test against */
  patterns: string[];
  /** Source description for error messages (e.g., file path) */
  patternSource?: string;
  /** File path being validated */
  filePath: string;
  /** The stop rule being validated */
  rule: StopRule;
  /** Old value (before changes) */
  oldValue: unknown;
  /** Updated value (after changes) */
  updatedValue: unknown;
  /** Old data (for global scans) */
  oldData?: unknown;
  /** Updated data (for global scans) */
  updatedData?: unknown;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Recursively extracts all leaf values from a nested YAML structure.
 * Skips keys and only collects values (strings, numbers, booleans).
 * Used for pathless regex rules that scan entire file contents.
 *
 * @param data - The YAML data structure to scan
 * @returns Array of all leaf values found
 *
 * @example
 * getAllValuesRecursive({ a: 'foo', b: { c: 'bar', d: 123 } })
 * // Returns: ['foo', 'bar', 123]
 */
export const getAllValuesRecursive = (data: unknown): unknown[] => {
  const values: unknown[] = [];

  const traverse = (node: unknown): void => {
    if (node === null || node === undefined) return;

    if (typeof node === 'object')
      if (Array.isArray(node)) for (const item of node) traverse(item);
      else for (const value of Object.values(node)) traverse(value);
    else
      // Leaf value (string, number, boolean)
      values.push(node);
  };

  traverse(data);
  return values;
};

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates a value against multiple regex patterns (targeted mode with path).
 * Checks a specific value extracted from a JSONPath.
 */
export const validateTargetedRegex = (options: RegexValidationOptions): StopRuleViolation | undefined => {
  const valueToCheck = options.updatedValue === undefined ? options.oldValue : options.updatedValue;
  if (valueToCheck === undefined) return undefined;

  const stringValue = String(valueToCheck);

  for (const patternString of options.patterns) {
    const pattern = new RegExp(patternString);
    if (pattern.test(stringValue)) {
      const patternInfo = options.patternSource ? ` from ${options.patternSource}` : ` ${patternString}`;
      return {
        file: options.filePath,
        rule: options.rule,
        path: options.rule.path ?? '(unknown)',
        oldValue: options.oldValue,
        updatedValue: options.updatedValue,
        message: `Value "${stringValue}" matches forbidden pattern${patternInfo}`
      };
    }
  }

  return undefined;
};

/**
 * Validates data against multiple regex patterns (global mode without path).
 * Scans all values recursively in the YAML structure.
 */
export const validatePathlessRegex = (options: RegexValidationOptions): StopRuleViolation | undefined => {
  const dataToCheck = options.updatedData === undefined ? options.oldData : options.updatedData;
  if (dataToCheck === undefined) return undefined;

  const allValues = getAllValuesRecursive(dataToCheck);

  for (const value of allValues) {
    const stringValue = String(value);
    for (const patternString of options.patterns) {
      const pattern = new RegExp(patternString);
      if (pattern.test(stringValue)) {
        const patternInfo = options.patternSource
          ? ` ${patternString} from ${options.patternSource}`
          : ` ${patternString}`;
        return {
          file: options.filePath,
          rule: options.rule,
          path: '(global scan)',
          oldValue: options.oldData,
          updatedValue: options.updatedData,
          message: `Value "${stringValue}" matches forbidden pattern${patternInfo} (found during global scan)`
        };
      }
    }
  }

  return undefined;
};
