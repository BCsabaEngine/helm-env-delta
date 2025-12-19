import { isMatch } from 'picomatch';

import type { TransformConfig, TransformRule } from '../configFile';
import { createErrorClass, createErrorTypeGuard } from './errors';

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
    if (isMatch(filePath, pattern)) allRules.push(...(transformRules.content ?? []));

  return allRules;
};

// ============================================================================
// Core Transformation Algorithm
// ============================================================================

const transformValueRecursive = (value: unknown, rules: TransformRule[]): unknown => {
  // String: apply all transforms sequentially
  if (typeof value === 'string') {
    let result = value;
    for (const rule of rules) {
      const regex = new RegExp(rule.find, 'g');
      result = result.replace(regex, rule.replace);
    }
    return result;
  }

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
    throw new TransformerError('Failed to apply transformations', {
      code: 'TRANSFORM_APPLICATION_ERROR',
      path: filePath,
      cause: error instanceof Error ? error : new Error(String(error))
    });
  }
};
