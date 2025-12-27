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
export { getValueAtPath, parseJsonPath } from './jsonPath';

// File utilities
export { isYamlFile } from './fileType';

// Pattern matching utilities
export { globalMatcher, PatternMatcher } from './patternMatcher';

// Diff utilities
export { generateUnifiedDiff } from './diffGenerator';

// Version checking utilities
export { checkForUpdates, isVersionCheckerError, VersionCheckerError } from './versionChecker';
