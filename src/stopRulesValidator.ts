import type { RegexFileKeyRule, RegexFileRule, RegexRule, StopRule } from './configFile';
import type { ChangedFile, FileDiffResult } from './fileDiff';
import { loadRegexPatternArray, loadRegexPatternsFromKeys } from './utils';
import { createErrorClass, createErrorTypeGuard } from './utils/errors';
import { getValueAtPath, parseJsonPath } from './utils/jsonPath';
import { globalMatcher } from './utils/patternMatcher';

// ============================================================================
// Error Handling
// ============================================================================

const StopRulesValidatorErrorClass = createErrorClass('Stop Rules Validator Error', {}, (message, options) => {
  let fullMessage = `Stop Rules Validator Error: ${message}`;

  if (options.code) fullMessage += `\n  Code: ${options.code}`;

  if (options['violations'] && Array.isArray(options['violations']) && options['violations'].length > 0) {
    fullMessage += `\n  Violations (${options['violations'].length}):`;
    for (const v of options['violations'] as StopRuleViolation[])
      fullMessage += `\n    - ${v.file}:${v.path} (${v.rule.type})`;

    fullMessage += '\n\n  Hint: Review stop rule violations carefully:';
    fullMessage += '\n    - Preview changes: --dry-run --diff';
    fullMessage += '\n    - Override if safe: --force (use with caution!)';
    fullMessage += '\n    - Semver violations indicate major version changes';
    fullMessage += '\n    - Numeric violations may indicate unsafe scaling';
  }

  if (options.cause) fullMessage += `\n  Cause: ${options.cause.message}`;

  return fullMessage;
});

export class StopRulesValidatorError extends StopRulesValidatorErrorClass {}
export const isStopRulesValidatorError = createErrorTypeGuard(StopRulesValidatorError);

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

export interface ValidationResult {
  violations: StopRuleViolation[];
  isValid: boolean;
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
const getAllValuesRecursive = (data: unknown): unknown[] => {
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
// Main Validation Function
// ============================================================================

export const validateStopRules = (
  diffResult: FileDiffResult,
  stopRulesConfig?: Record<string, StopRule[]>,
  configDirectory?: string,
  logger?: import('./logger').Logger
): ValidationResult => {
  if (!stopRulesConfig) return { violations: [], isValid: true };

  // Add verbose debug output
  if (logger?.shouldShow('debug')) {
    const totalRules = Object.values(stopRulesConfig).reduce((sum, rules) => sum + rules.length, 0);
    logger.debug('Stop rule validation:');
    logger.debug(`  Total rules: ${totalRules}`);
    logger.debug(`  Files to check: ${diffResult.changedFiles.length}`);
  }

  const violations: StopRuleViolation[] = [];

  // Validate changed files
  for (const changedFile of diffResult.changedFiles) {
    const fileViolations = validateFileAgainstRules(changedFile, stopRulesConfig, configDirectory);
    violations.push(...fileViolations);
  }

  // Note: Added files are not validated as they don't have old values for comparison
  // Stop rules primarily apply to changes in existing files

  // Add verbose debug output for results
  if (logger?.shouldShow('debug')) logger.debug(`Stop rules: ${violations.length} violation(s) found`);

  return {
    violations,
    isValid: violations.length === 0
  };
};

// ============================================================================
// File Validation
// ============================================================================

const validateFileAgainstRules = (
  changedFile: ChangedFile,
  stopRulesConfig: Record<string, StopRule[]>,
  configDirectory?: string
): StopRuleViolation[] => {
  const violations: StopRuleViolation[] = [];

  const applicableRules = getApplicableRules(changedFile.path, stopRulesConfig);

  if (applicableRules.length === 0) return violations;

  const oldData = changedFile.processedDestContent;
  const updatedData = changedFile.processedSourceContent;

  for (const rule of applicableRules) {
    const violation = validateRule(rule, oldData, updatedData, changedFile.path, configDirectory);

    if (violation) violations.push(violation);
  }

  return violations;
};

// ============================================================================
// Rule Matching
// ============================================================================

const getApplicableRules = (filePath: string, stopRulesConfig: Record<string, StopRule[]>): StopRule[] => {
  const rules: StopRule[] = [];

  for (const [pattern, ruleList] of Object.entries(stopRulesConfig))
    if (globalMatcher.match(filePath, pattern)) rules.push(...ruleList);

  return rules;
};

// ============================================================================
// Rule Validation
// ============================================================================

const validateRule = (
  rule: StopRule,
  oldData: unknown,
  updatedData: unknown,
  filePath: string,
  configDirectory?: string
): StopRuleViolation | undefined => {
  // For regex rules with optional path, handle differently
  if (rule.type === 'regex' || rule.type === 'regexFile' || rule.type === 'regexFileKey')
    if (rule.path) {
      // Targeted mode: check specific path
      const pathParts = parseJsonPath(rule.path);
      const oldValue = oldData ? getValueAtPath(oldData, pathParts) : undefined;
      const updatedValue = updatedData ? getValueAtPath(updatedData, pathParts) : undefined;

      if (oldValue === undefined && updatedValue === undefined) return undefined;

      if (rule.type === 'regex') return validateRegex(rule, oldValue, updatedValue, filePath);
      if (rule.type === 'regexFile') return validateRegexFile(rule, oldValue, updatedValue, filePath, configDirectory);
      if (rule.type === 'regexFileKey')
        return validateRegexFileKey(rule, oldValue, updatedValue, filePath, configDirectory);
    } else {
      // Global mode: scan all values recursively
      if (rule.type === 'regex') return validateRegexGlobal(rule, oldData, updatedData, filePath);
      if (rule.type === 'regexFile')
        return validateRegexFileGlobal(rule, oldData, updatedData, filePath, configDirectory);
      if (rule.type === 'regexFileKey')
        return validateRegexFileKeyGlobal(rule, oldData, updatedData, filePath, configDirectory);
    }

  // For non-regex rules, path is required
  if (!rule.path) return undefined;

  const pathParts = parseJsonPath(rule.path);
  const oldValue = oldData ? getValueAtPath(oldData, pathParts) : undefined;
  const updatedValue = updatedData ? getValueAtPath(updatedData, pathParts) : undefined;

  if (oldValue === undefined && updatedValue === undefined) return undefined;

  switch (rule.type) {
    case 'semverMajorUpgrade':
      return validateSemverMajorUpgrade(rule, oldValue, updatedValue, filePath);
    case 'semverDowngrade':
      return validateSemverDowngrade(rule, oldValue, updatedValue, filePath);
    case 'numeric':
      return validateNumeric(rule, oldValue, updatedValue, filePath);
    case 'versionFormat':
      return validateVersionFormat(rule, oldValue, updatedValue, filePath);
    default:
      return undefined;
  }
};

const validateSemverMajorUpgrade = (
  rule: StopRule,
  oldValue: unknown,
  updatedValue: unknown,
  filePath: string
): StopRuleViolation | undefined => {
  if (oldValue === undefined || updatedValue === undefined) return undefined;

  const oldVersion = String(oldValue);
  const updatedVersion = String(updatedValue);

  const oldMajor = parseMajorVersion(oldVersion);
  const updatedMajor = parseMajorVersion(updatedVersion);

  if (oldMajor === undefined || updatedMajor === undefined) return undefined;

  if (updatedMajor > oldMajor)
    return {
      file: filePath,
      rule,
      path: rule.path ?? '(unknown)',
      oldValue,
      updatedValue,
      message: `Major version upgrade detected: ${oldVersion} → ${updatedVersion}`
    };

  return undefined;
};

const validateSemverDowngrade = (
  rule: StopRule,
  oldValue: unknown,
  updatedValue: unknown,
  filePath: string
): StopRuleViolation | undefined => {
  if (oldValue === undefined || updatedValue === undefined) return undefined;

  const oldVersion = String(oldValue);
  const updatedVersion = String(updatedValue);

  const oldParsed = parseSemver(oldVersion);
  const updatedParsed = parseSemver(updatedVersion);

  if (!oldParsed || !updatedParsed) return undefined;

  // Compare versions: major, then minor, then patch
  if (
    updatedParsed.major < oldParsed.major ||
    (updatedParsed.major === oldParsed.major && updatedParsed.minor < oldParsed.minor) ||
    (updatedParsed.major === oldParsed.major &&
      updatedParsed.minor === oldParsed.minor &&
      updatedParsed.patch < oldParsed.patch)
  )
    return {
      file: filePath,
      rule,
      path: rule.path ?? '(unknown)',
      oldValue,
      updatedValue,
      message: `Version downgrade detected: ${oldVersion} → ${updatedVersion}`
    };

  return undefined;
};

const validateNumeric = (
  rule: StopRule & { min?: number; max?: number },
  oldValue: unknown,
  updatedValue: unknown,
  filePath: string
): StopRuleViolation | undefined => {
  const valueToCheck = updatedValue === undefined ? oldValue : updatedValue;

  if (valueToCheck === undefined) return undefined;

  const numberValue = Number(valueToCheck);

  if (Number.isNaN(numberValue)) return undefined;

  if (rule.min !== undefined && numberValue < rule.min)
    return {
      file: filePath,
      rule,
      path: rule.path ?? '(unknown)',
      oldValue,
      updatedValue,
      message: `Value ${numberValue} is below minimum ${rule.min}`
    };

  if (rule.max !== undefined && numberValue > rule.max)
    return {
      file: filePath,
      rule,
      path: rule.path ?? '(unknown)',
      oldValue,
      updatedValue,
      message: `Value ${numberValue} exceeds maximum ${rule.max}`
    };

  return undefined;
};

const validateRegex = (
  rule: StopRule & { regex: string },
  oldValue: unknown,
  updatedValue: unknown,
  filePath: string
): StopRuleViolation | undefined => {
  const valueToCheck = updatedValue === undefined ? oldValue : updatedValue;

  if (valueToCheck === undefined) return undefined;

  const stringValue = String(valueToCheck);
  const pattern = new RegExp(rule.regex);

  if (pattern.test(stringValue))
    return {
      file: filePath,
      rule,
      path: rule.path ?? '(unknown)',
      oldValue,
      updatedValue,
      message: `Value "${stringValue}" matches forbidden pattern ${rule.regex}`
    };

  return undefined;
};

const validateVersionFormat = (
  rule: StopRule & { vPrefix: 'required' | 'allowed' | 'forbidden' },
  oldValue: unknown,
  updatedValue: unknown,
  filePath: string
): StopRuleViolation | undefined => {
  // Only validate the updated value (not old value)
  const valueToCheck = updatedValue === undefined ? oldValue : updatedValue;

  if (valueToCheck === undefined) return undefined;

  const stringValue = String(valueToCheck);
  const validationResult = validateVersionString(stringValue, rule.vPrefix);

  if (!validationResult.isValid)
    return {
      file: filePath,
      rule,
      path: rule.path ?? '(unknown)',
      oldValue,
      updatedValue,
      message: validationResult.message
    };

  return undefined;
};

/**
 * Validates pathless regex rule (global mode).
 * Scans all values recursively in the YAML file.
 */
const validateRegexGlobal = (
  rule: RegexRule,
  oldData: unknown,
  updatedData: unknown,
  filePath: string
): StopRuleViolation | undefined => {
  const dataToCheck = updatedData === undefined ? oldData : updatedData;
  if (dataToCheck === undefined) return undefined;

  const allValues = getAllValuesRecursive(dataToCheck);
  const pattern = new RegExp(rule.regex);

  for (const value of allValues) {
    const stringValue = String(value);
    if (pattern.test(stringValue))
      return {
        file: filePath,
        rule,
        path: '(global scan)',
        oldValue: oldData,
        updatedValue: updatedData,
        message: `Value "${stringValue}" matches forbidden pattern ${rule.regex} (found during global scan)`
      };
  }

  return undefined;
};

/**
 * Validates regexFile rule (targeted mode with path).
 * Loads patterns from array file and checks value at specific path.
 */
const validateRegexFile = (
  rule: RegexFileRule,
  oldValue: unknown,
  updatedValue: unknown,
  filePath: string,
  configDirectory?: string
): StopRuleViolation | undefined => {
  if (!configDirectory) return undefined;

  const valueToCheck = updatedValue === undefined ? oldValue : updatedValue;
  if (valueToCheck === undefined) return undefined;

  const patterns = loadRegexPatternArray(rule.file, configDirectory);
  const stringValue = String(valueToCheck);

  for (const patternString of patterns) {
    const pattern = new RegExp(patternString);
    if (pattern.test(stringValue))
      return {
        file: filePath,
        rule,
        path: rule.path ?? '(unknown)',
        oldValue,
        updatedValue,
        message: `Value "${stringValue}" matches forbidden pattern ${patternString} from ${rule.file}`
      };
  }

  return undefined;
};

/**
 * Validates regexFile rule (global mode without path).
 * Loads patterns from array file and scans all values recursively.
 */
const validateRegexFileGlobal = (
  rule: RegexFileRule,
  oldData: unknown,
  updatedData: unknown,
  filePath: string,
  configDirectory?: string
): StopRuleViolation | undefined => {
  if (!configDirectory) return undefined;

  const dataToCheck = updatedData === undefined ? oldData : updatedData;
  if (dataToCheck === undefined) return undefined;

  const patterns = loadRegexPatternArray(rule.file, configDirectory);
  const allValues = getAllValuesRecursive(dataToCheck);

  for (const value of allValues) {
    const stringValue = String(value);
    for (const patternString of patterns) {
      const pattern = new RegExp(patternString);
      if (pattern.test(stringValue))
        return {
          file: filePath,
          rule,
          path: '(global scan)',
          oldValue: oldData,
          updatedValue: updatedData,
          message: `Value "${stringValue}" matches forbidden pattern ${patternString} from ${rule.file} (found during global scan)`
        };
    }
  }

  return undefined;
};

/**
 * Validates regexFileKey rule (targeted mode with path).
 * Loads transform file keys as patterns and checks value at specific path.
 */
const validateRegexFileKey = (
  rule: RegexFileKeyRule,
  oldValue: unknown,
  updatedValue: unknown,
  filePath: string,
  configDirectory?: string
): StopRuleViolation | undefined => {
  if (!configDirectory) return undefined;

  const valueToCheck = updatedValue === undefined ? oldValue : updatedValue;
  if (valueToCheck === undefined) return undefined;

  const patterns = loadRegexPatternsFromKeys(rule.file, configDirectory);
  const stringValue = String(valueToCheck);

  for (const patternString of patterns) {
    const pattern = new RegExp(patternString);
    if (pattern.test(stringValue))
      return {
        file: filePath,
        rule,
        path: rule.path ?? '(unknown)',
        oldValue,
        updatedValue,
        message: `Value "${stringValue}" matches transform key pattern ${patternString} from ${rule.file}`
      };
  }

  return undefined;
};

/**
 * Validates regexFileKey rule (global mode without path).
 * Loads transform file keys as patterns and scans all values recursively.
 */
const validateRegexFileKeyGlobal = (
  rule: RegexFileKeyRule,
  oldData: unknown,
  updatedData: unknown,
  filePath: string,
  configDirectory?: string
): StopRuleViolation | undefined => {
  if (!configDirectory) return undefined;

  const dataToCheck = updatedData === undefined ? oldData : updatedData;
  if (dataToCheck === undefined) return undefined;

  const patterns = loadRegexPatternsFromKeys(rule.file, configDirectory);
  const allValues = getAllValuesRecursive(dataToCheck);

  for (const value of allValues) {
    const stringValue = String(value);
    for (const patternString of patterns) {
      const pattern = new RegExp(patternString);
      if (pattern.test(stringValue))
        return {
          file: filePath,
          rule,
          path: '(global scan)',
          oldValue: oldData,
          updatedValue: updatedData,
          message: `Value "${stringValue}" matches transform key pattern ${patternString} from ${rule.file} (found during global scan)`
        };
    }
  }

  return undefined;
};

// ============================================================================
// Helper Functions
// ============================================================================

interface VersionValidationResult {
  isValid: boolean;
  message: string;
}

const validateVersionString = (
  version: string,
  vPrefixMode: 'required' | 'allowed' | 'forbidden'
): VersionValidationResult => {
  const hasVPrefix = version.startsWith('v');
  const versionWithoutPrefix = hasVPrefix ? version.slice(1) : version;

  // Check v-prefix requirements
  if (vPrefixMode === 'required' && !hasVPrefix)
    return {
      isValid: false,
      message: `Version "${version}" must start with "v" prefix (e.g., "v1.2.3")`
    };

  if (vPrefixMode === 'forbidden' && hasVPrefix)
    return {
      isValid: false,
      message: `Version "${version}" must not have "v" prefix (use "1.2.3" instead of "v1.2.3")`
    };

  // Validate exact major.minor.patch format
  // Reject leading zeros: use [1-9]\d* for first digit, \d+ for rest
  // Pattern breakdown:
  // - (0|[1-9]\d*) = major: 0 OR (1-9 followed by any digits)
  // - Same for minor and patch
  const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  const match = versionPattern.exec(versionWithoutPrefix);

  if (!match) {
    // Determine specific error message
    const parts = versionWithoutPrefix.split('.');
    const partsCount = parts.length;

    if (partsCount < 3)
      return {
        isValid: false,
        message: `Version "${version}" is incomplete. Expected format: major.minor.patch (e.g., "1.2.3"), got only ${partsCount} part(s)`
      };

    if (partsCount > 3)
      return {
        isValid: false,
        message: `Version "${version}" has too many parts. Expected format: major.minor.patch (e.g., "1.2.3"), got ${partsCount} parts`
      };

    // Check for leading zeros
    const hasLeadingZeros = parts.some((part) => part.length > 1 && part.startsWith('0'));

    if (hasLeadingZeros)
      return {
        isValid: false,
        message: `Version "${version}" has leading zeros. Use canonical format (e.g., "1.2.3" instead of "1.02.3")`
      };

    // Check for pre-release suffix or build metadata
    const hasPreReleaseSuffix = /\d+\.\d+\.\d+[+-]/.test(versionWithoutPrefix);

    if (hasPreReleaseSuffix)
      return {
        isValid: false,
        message: `Version "${version}" contains pre-release identifier or build metadata. Only major.minor.patch format is allowed (e.g., "1.2.3")`
      };

    // Check for non-numeric parts
    const hasNonNumeric = parts.some((part) => !/^\d+$/.test(part));

    if (hasNonNumeric)
      return {
        isValid: false,
        message: `Version "${version}" has non-numeric parts. Expected format: major.minor.patch (e.g., "1.2.3")`
      };

    return {
      isValid: false,
      message: `Version "${version}" has invalid format. Expected: major.minor.patch (e.g., "1.2.3")`
    };
  }

  return {
    isValid: true,
    message: ''
  };
};

const parseMajorVersion = (version: string): number | undefined => {
  const cleaned = version.startsWith('v') ? version.slice(1) : version;

  const match = /^(\d+)/.exec(cleaned);

  if (!match || !match[1]) return undefined;

  return Number.parseInt(match[1], 10);
};

const parseSemver = (version: string): { major: number; minor: number; patch: number } | undefined => {
  const cleaned = version.startsWith('v') ? version.slice(1) : version;

  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(cleaned);

  if (!match || !match[1] || !match[2] || !match[3]) return undefined;

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10)
  };
};
