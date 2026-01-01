import type { TransformConfig, TransformRule } from '../configFile';
import { createErrorClass, createErrorTypeGuard } from './errors';
import { globalMatcher } from './patternMatcher';
import { applyRegexRulesSequentially } from './regexTransform';

// ============================================================================
// Error Handling
// ============================================================================

const TransformerErrorClass = createErrorClass('Transformer Error', {
  REGEX_COMPILATION_ERROR: 'Failed to compile regex pattern',
  TRANSFORM_APPLICATION_ERROR: 'Failed to apply transformation'
});

export class TransformerError extends TransformerErrorClass {}
export const isTransformerError = createErrorTypeGuard(TransformerError);

// ============================================================================
// File Pattern Matching
// ============================================================================

export const getTransformsForFile = (filePath: string, transforms?: TransformConfig): TransformRule[] => {
  if (!transforms) return [];

  const allRules: TransformRule[] = [];

  for (const [pattern, transformRules] of Object.entries(transforms))
    if (globalMatcher.match(filePath, pattern)) allRules.push(...(transformRules.content ?? []));

  return allRules;
};

// ============================================================================
// Core Transformation Algorithm
// ============================================================================

const transformValueRecursive = (value: unknown, rules: TransformRule[]): unknown => {
  // String: apply all transforms sequentially using shared utility
  if (typeof value === 'string') return applyRegexRulesSequentially(value, rules, false);

  // Array: map and recurse
  if (Array.isArray(value)) return value.map((item) => transformValueRecursive(item, rules));

  // Object: recurse on values only (preserve keys)
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value_] of Object.entries(value)) result[key] = transformValueRecursive(value_, rules);

    return result;
  }

  // Primitives (number, boolean, null, undefined): return unchanged
  return value;
};

// ============================================================================
// Public API
// ============================================================================

export const applyTransforms = (data: unknown, filePath: string, transforms?: TransformConfig): unknown => {
  if (!transforms) return data;

  const matchedRules = getTransformsForFile(filePath, transforms);
  if (matchedRules.length === 0) return data;

  try {
    return transformValueRecursive(data, matchedRules);
  } catch (error) {
    const transformError = new TransformerError('Failed to apply transformations', {
      code: 'TRANSFORM_APPLICATION_ERROR',
      path: filePath,
      cause: error instanceof Error ? error : new Error(String(error))
    });

    const hints = [
      '\n\n  Hint: Common regex issues:',
      '\n    - Unescaped special chars: use \\. for dots, \\[ for brackets',
      '\n    - Invalid capture groups: ensure balanced parentheses',
      '\n    - Test your pattern: https://regex101.com/'
    ].join('');
    transformError.message += hints;

    throw transformError;
  }
};
