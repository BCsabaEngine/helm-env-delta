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

// Diff utilities
export { generateUnifiedDiff } from './diffGenerator';
