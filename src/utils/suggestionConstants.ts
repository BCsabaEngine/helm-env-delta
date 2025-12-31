/**
 * Shared constants for suggestion engine pattern detection.
 * Centralizes magic numbers and patterns used across suggestion analysis.
 */

// ============================================================================
// Confidence Thresholds
// ============================================================================

export const CONFIDENCE_DEFAULTS = {
  /** Default minimum confidence threshold for suggestions */
  DEFAULT_THRESHOLD: 0.3,
  /** Single file, few occurrences */
  SINGLE_FILE_LOW: 0.3,
  /** Single file, multiple occurrences (≥3) */
  SINGLE_FILE_HIGH: 0.5,
  /** 2-3 files */
  MULTI_FILE_LOW: 0.6,
  /** 4+ files */
  MULTI_FILE_HIGH: 0.85,
  /** Semantic keyword boost */
  SEMANTIC_BOOST: 0.05,
  /** Max confidence (capped) */
  MAX_CONFIDENCE: 0.95,
  /** Semver detection - single file */
  SEMVER_SINGLE_FILE: 0.7,
  /** Semver detection - multiple files */
  SEMVER_MULTI_FILE: 0.95,
  /** Version format consistency */
  VERSION_FORMAT_HIGH: 0.95,
  /** Version format mixed (2:1 ratio) */
  VERSION_FORMAT_MEDIUM: 0.6,
  /** Numeric constraint - single file */
  NUMERIC_SINGLE_FILE: 0.5,
  /** Numeric constraint - multiple files */
  NUMERIC_MULTI_FILE: 0.7
} as const;

// ============================================================================
// Pattern Matching
// ============================================================================

/** Environment transition keywords for semantic pattern detection */
export const SEMANTIC_PATTERNS = [
  { old: 'uat', target: 'prod' },
  { old: 'UAT', target: 'PROD' },
  { old: 'staging', target: 'production' },
  { old: 'stg', target: 'prd' },
  { old: 'dev', target: 'prod' },
  { old: 'test', target: 'prod' }
] as const;

/** Keywords indicating semantic environment transitions */
export const SEMANTIC_KEYWORDS = ['uat', 'prod', 'staging', 'production', 'dev', 'test', 'stg', 'prd'] as const;

/** Common antonym pairs that should not be suggested as patterns */
export const ANTONYM_PAIRS = [
  ['enable', 'disable'],
  ['enabled', 'disabled'],
  ['true', 'false'],
  ['on', 'off'],
  ['yes', 'no'],
  ['active', 'inactive'],
  ['start', 'stop']
] as const;

// ============================================================================
// Array Key Field Detection
// ============================================================================

/** Candidate field names for array item identification */
export const ARRAY_KEY_FIELDS = ['name', 'id', 'key', 'identifier', 'uid', 'ref'] as const;

// ============================================================================
// Validation Patterns
// ============================================================================

/** Regex for detecting UUID values (should be filtered) */
export const UUID_PATTERN = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

/** Regex for detecting ISO timestamp values (should be filtered) */
export const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/** Regex for detecting semver patterns */
export const SEMVER_PATTERN = /^v?\d+\.\d+\.\d+/;

/** Regex special characters that may indicate non-pattern values */
export const PROBLEMATIC_REGEX_CHARS = /[$()*+.?[\\\]^{|}]/;

// ============================================================================
// Filtering Thresholds
// ============================================================================

export const FILTER_THRESHOLDS = {
  /** Maximum string length to consider for pattern detection */
  MAX_STRING_LENGTH: 100,
  /** Maximum edit distance for single-character changes */
  MAX_EDIT_DISTANCE: 1,
  /** Minimum occurrences required for a pattern */
  MIN_OCCURRENCES: 2,
  /** Minimum occurrences in single file for higher confidence */
  MIN_SINGLE_FILE_OCCURRENCES: 3
} as const;

// ============================================================================
// Stop Rule Detection
// ============================================================================

/** Field names that indicate numeric constraints should be applied */
export const CONSTRAINT_FIELD_NAMES = ['replicas', 'replica', 'count', 'port', 'timeout', 'limit'] as const;

/** Minimum value multiplier for suggesting numeric constraints */
export const NUMERIC_MIN_MULTIPLIER = 0.5;

/** Minimum numeric constraint value (floor) */
export const NUMERIC_MIN_FLOOR = 1;

// ============================================================================
// Output Formatting
// ============================================================================

/** Maximum number of examples to include per suggestion */
export const MAX_EXAMPLES_PER_SUGGESTION = 3;
