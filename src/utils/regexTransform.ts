/**
 * Shared regex transformation utilities.
 * Consolidates duplicated regex application logic across transformer and filenameTransformer.
 */

import type { TransformRule } from '../config';

/**
 * Applies multiple regex transformation rules sequentially to a string.
 * Each rule is applied in order, with the output of one becoming the input of the next.
 *
 * @param value - The string to transform
 * @param rules - Array of transformation rules (find/replace pairs)
 * @param throwOnError - Whether to throw on regex compilation errors (default: false)
 * @returns The transformed string
 * @throws Error if throwOnError is true and regex compilation fails
 */
export const applyRegexRulesSequentially = (
  value: string,
  rules: TransformRule[],
  throwOnError: boolean = false
): string => {
  let result = value;

  for (const rule of rules)
    try {
      const regex = new RegExp(rule.find, 'g');
      result = result.replace(regex, rule.replace);
    } catch (error) {
      if (throwOnError) throw error;

      // If not throwing, skip this rule and continue
    }

  return result;
};
