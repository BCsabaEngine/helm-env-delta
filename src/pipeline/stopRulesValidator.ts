import type { RegexFileKeyRule, RegexFileRule, RegexRule, StopRule } from '../config';
import {
  loadRegexPatternArray,
  loadRegexPatternsFromKeys,
  validatePathlessRegex,
  validateTargetedRegex,
  validateVersionString
} from '../utils';
import { createErrorClass, createErrorTypeGuard } from '../utils/errors';
import { getValueAtPath, parseJsonPath } from '../utils/jsonPath';
import { globalMatcher } from '../utils/patternMatcher';
import type { ChangedFile, FileDiffResult } from './fileDiff';

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

export interface ValidationContext {
  rule: StopRule;
  oldData: unknown;
  updatedData: unknown;
  filePath: string;
  configDirectory?: string;
}

// ============================================================================
// Main Validation Function
// ============================================================================

export const validateStopRules = (
  diffResult: FileDiffResult,
  stopRulesConfig?: Record<string, StopRule[]>,
  configDirectory?: string,
  logger?: import('../logger').Logger
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
    const violation = validateRule({
      rule,
      oldData,
      updatedData,
      filePath: changedFile.path,
      configDirectory
    });

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

const validateRule = (context: ValidationContext): StopRuleViolation | undefined => {
  const { rule, oldData, updatedData, filePath, configDirectory } = context;
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
  return validateTargetedRegex({
    patterns: [rule.regex],
    filePath,
    rule,
    oldValue,
    updatedValue
  });
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
  return validatePathlessRegex({
    patterns: [rule.regex],
    filePath,
    rule,
    oldValue: undefined,
    updatedValue: undefined,
    oldData,
    updatedData
  });
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

  const patterns = loadRegexPatternArray(rule.file, configDirectory);
  return validateTargetedRegex({
    patterns,
    patternSource: rule.file,
    filePath,
    rule,
    oldValue,
    updatedValue
  });
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

  const patterns = loadRegexPatternArray(rule.file, configDirectory);
  return validatePathlessRegex({
    patterns,
    patternSource: rule.file,
    filePath,
    rule,
    oldValue: undefined,
    updatedValue: undefined,
    oldData,
    updatedData
  });
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

  const patterns = loadRegexPatternsFromKeys(rule.file, configDirectory);
  // Use custom message for transform key patterns
  const result = validateTargetedRegex({
    patterns,
    patternSource: rule.file,
    filePath,
    rule,
    oldValue,
    updatedValue
  });

  // Override message to indicate transform key pattern
  if (result) {
    const match = result.message.match(/pattern (.+?) from/);
    if (match) result.message = result.message.replace('forbidden pattern', 'transform key pattern');
  }

  return result;
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

  const patterns = loadRegexPatternsFromKeys(rule.file, configDirectory);
  // Use custom message for transform key patterns
  const result = validatePathlessRegex({
    patterns,
    patternSource: rule.file,
    filePath,
    rule,
    oldValue: undefined,
    updatedValue: undefined,
    oldData,
    updatedData
  });

  // Override message to indicate transform key pattern
  if (result) {
    const match = result.message.match(/pattern (.+?) from/);
    if (match) result.message = result.message.replace('forbidden pattern', 'transform key pattern');
  }

  return result;
};

// ============================================================================
// Helper Functions
// ============================================================================

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
