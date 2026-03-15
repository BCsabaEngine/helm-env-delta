/**
 * Shared regex transformation utilities.
 * Consolidates duplicated regex application logic across transformer and filenameTransformer.
 */

import type { TransformRule } from '../config';

// Module-level cache: pattern string → compiled RegExp (with 'g' flag)
// String.prototype.replace() resets lastIndex after each call, so stateful 'g' reuse is safe.
const regexCache = new Map<string, RegExp>();

/**
 * Applies multiple regex transformation rules sequentially to a string.
 * Each rule is applied in order, with the output of one becoming the input of the next.
 * Compiled RegExp instances are cached to avoid recompilation on repeated calls.
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
      let regex = regexCache.get(rule.find);
      if (!regex) {
        regex = new RegExp(rule.find, 'g');
        regexCache.set(rule.find, regex);
      }
      result = result.replace(regex, rule.replace);
    } catch (error) {
      if (throwOnError) throw error;

      // If not throwing, skip this rule and continue
    }

  return result;
};
