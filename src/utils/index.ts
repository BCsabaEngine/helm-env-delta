// ============================================================================
// Barrel Exports for Utils
// ============================================================================

// Error utilities
export type { ErrorOptions } from './errors';
export { createErrorClass, createErrorTypeGuard } from './errors';

// Comparison utilities
export { deepEqual } from './deepEqual';
export { normalizeForComparison, serializeForDiff } from './serialization';

// Path utilities
export { clearJsonPathCache, getValueAtPath, isFilterSegment, parseFilterSegment, parseJsonPath } from './jsonPath';

// File utilities
export { isYamlFile } from './fileType';

// Pattern matching utilities
export { globalMatcher, PatternMatcher } from './patternMatcher';

// Diff utilities
export { generateUnifiedDiff } from './diffGenerator';

// Array diff processing utilities
export { type ArrayChange, type ArrayChangeInfo, detectArrayChanges } from './arrayDiffProcessor';

// Version checking utilities
export { checkForUpdates, isVersionCheckerError, VersionCheckerError } from './versionChecker';

// YAML file loading utilities
export { escapeRegex, isYamlFileLoaderError, loadYamlFile, YamlFileLoaderError } from './yamlFileLoader';

// Transform file loading utilities
export {
  isTransformFileLoaderError,
  loadTransformFile,
  loadTransformFiles,
  TransformFileLoaderError
} from './transformFileLoader';

// Regex pattern file loading utilities
export {
  isRegexPatternFileLoaderError,
  loadRegexPatternArray,
  loadRegexPatternsFromKeys,
  RegexPatternFileLoaderError
} from './regexPatternFileLoader';

// Regex validation utilities
export {
  getAllValuesRecursive,
  type RegexValidationOptions,
  type StopRuleViolation,
  validatePathlessRegex,
  validateTargetedRegex
} from './regexValidator';

// Regex transformation utilities
export { applyRegexRulesSequentially } from './regexTransform';

// Version validation utilities
export { validateVersionString, type VersionValidationResult, type VPrefixMode } from './versionValidator';

// YAML type guards and helpers
export {
  extractKeyValue,
  extractScalarValue,
  isScalar,
  isYamlCollection,
  isYamlMap,
  isYamlSeq
} from './yamlTypeGuards';

// Suggestion engine constants
export {
  ANTONYM_PAIRS,
  ARRAY_KEY_FIELDS,
  CONFIDENCE_DEFAULTS,
  CONSTRAINT_FIELD_NAMES,
  FILTER_THRESHOLDS,
  ISO_TIMESTAMP_PATTERN,
  MAX_EXAMPLES_PER_SUGGESTION,
  NUMERIC_MIN_FLOOR,
  NUMERIC_MIN_MULTIPLIER,
  PROBLEMATIC_REGEX_CHARS,
  SEMANTIC_KEYWORDS,
  SEMANTIC_PATTERNS,
  SEMVER_PATTERN,
  UUID_PATTERN
} from './suggestionConstants';
