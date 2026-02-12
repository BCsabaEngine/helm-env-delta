import { describe, expect, it } from 'vitest';

import type { StopRule } from '../../src/config';
import { getAllValuesRecursive, validatePathlessRegex, validateTargetedRegex } from '../../src/utils/regexValidator';

const makeRule = (overrides: Partial<StopRule> = {}): StopRule =>
  ({
    regex: ['^forbidden'],
    path: 'some.path',
    ...overrides
  }) as StopRule;

describe('utils/regexValidator', () => {
  // ==========================================================================
  // getAllValuesRecursive
  // ==========================================================================

  describe('getAllValuesRecursive', () => {
    it('should return values from a flat object', () => {
      const result = getAllValuesRecursive({ a: 'foo', b: 'bar' });
      expect(result).toEqual(['foo', 'bar']);
    });

    it('should return values from nested objects', () => {
      const result = getAllValuesRecursive({ a: { b: { c: 'deep' } } });
      expect(result).toEqual(['deep']);
    });

    it('should return values from arrays', () => {
      const result = getAllValuesRecursive(['a', 'b', 'c']);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should return values from mixed structures', () => {
      const result = getAllValuesRecursive({
        a: 'foo',
        b: { c: 'bar', d: 123 },
        e: [true, 'baz']
      });
      expect(result).toEqual(['foo', 'bar', 123, true, 'baz']);
    });

    it('should skip null and undefined values', () => {
      // eslint-disable-next-line unicorn/no-null -- testing YAML null value handling
      const result = getAllValuesRecursive({ a: null, b: undefined, c: 'kept' });
      expect(result).toEqual(['kept']);
    });

    it('should return empty array for null input', () => {
      // eslint-disable-next-line unicorn/no-null -- testing YAML null value handling
      expect(getAllValuesRecursive(null)).toEqual([]);
    });

    it('should return empty array for undefined input', () => {
      expect(getAllValuesRecursive()).toEqual([]);
    });

    it('should return single leaf value for primitives', () => {
      expect(getAllValuesRecursive('hello')).toEqual(['hello']);
      expect(getAllValuesRecursive(42)).toEqual([42]);
      expect(getAllValuesRecursive(true)).toEqual([true]);
    });

    it('should return empty array for empty object', () => {
      expect(getAllValuesRecursive({})).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      expect(getAllValuesRecursive([])).toEqual([]);
    });
  });

  // ==========================================================================
  // validateTargetedRegex
  // ==========================================================================

  describe('validateTargetedRegex', () => {
    it('should return violation when updatedValue matches pattern', () => {
      const result = validateTargetedRegex({
        patterns: ['^forbidden'],
        filePath: 'values.yaml',
        rule: makeRule(),
        oldValue: 'old',
        updatedValue: 'forbidden-thing'
      });

      expect(result).toBeDefined();
      expect(result!.file).toBe('values.yaml');
      expect(result!.message).toContain('forbidden-thing');
      expect(result!.message).toContain('matches forbidden pattern');
    });

    it('should return undefined when no pattern matches', () => {
      const result = validateTargetedRegex({
        patterns: ['^forbidden'],
        filePath: 'values.yaml',
        rule: makeRule(),
        oldValue: 'old',
        updatedValue: 'allowed-value'
      });

      expect(result).toBeUndefined();
    });

    it('should fall back to oldValue when updatedValue is undefined', () => {
      const result = validateTargetedRegex({
        patterns: ['^forbidden'],
        filePath: 'values.yaml',
        rule: makeRule(),
        oldValue: 'forbidden-old',
        updatedValue: undefined
      });

      expect(result).toBeDefined();
      expect(result!.message).toContain('forbidden-old');
    });

    it('should return undefined when both values are undefined', () => {
      const result = validateTargetedRegex({
        patterns: ['^forbidden'],
        filePath: 'values.yaml',
        rule: makeRule(),
        oldValue: undefined,
        updatedValue: undefined
      });

      expect(result).toBeUndefined();
    });

    it('should include patternSource in message when provided', () => {
      const result = validateTargetedRegex({
        patterns: ['^forbidden'],
        patternSource: 'patterns/rules.yaml',
        filePath: 'values.yaml',
        rule: makeRule(),
        oldValue: 'old',
        updatedValue: 'forbidden-thing'
      });

      expect(result).toBeDefined();
      expect(result!.message).toContain('from patterns/rules.yaml');
    });

    it('should include pattern string in message when no patternSource', () => {
      const result = validateTargetedRegex({
        patterns: ['^forbidden'],
        filePath: 'values.yaml',
        rule: makeRule(),
        oldValue: 'old',
        updatedValue: 'forbidden-thing'
      });

      expect(result!.message).toContain('^forbidden');
    });

    it('should use rule.path for the violation path', () => {
      const result = validateTargetedRegex({
        patterns: ['^forbidden'],
        filePath: 'values.yaml',
        rule: makeRule({ path: 'image.tag' }),
        oldValue: 'old',
        updatedValue: 'forbidden-thing'
      });

      expect(result!.path).toBe('image.tag');
    });

    it('should use (unknown) when rule has no path', () => {
      const result = validateTargetedRegex({
        patterns: ['^forbidden'],
        filePath: 'values.yaml',
        rule: makeRule({ path: undefined }),
        oldValue: 'old',
        updatedValue: 'forbidden-thing'
      });

      expect(result!.path).toBe('(unknown)');
    });

    it('should check multiple patterns and return first match', () => {
      const result = validateTargetedRegex({
        patterns: ['^no-match', '^forbidden', '^also-no'],
        filePath: 'values.yaml',
        rule: makeRule(),
        oldValue: 'old',
        updatedValue: 'forbidden-thing'
      });

      expect(result).toBeDefined();
    });

    it('should convert non-string values to string for comparison', () => {
      const result = validateTargetedRegex({
        patterns: ['^42$'],
        filePath: 'values.yaml',
        rule: makeRule(),
        oldValue: 'old',
        updatedValue: 42
      });

      expect(result).toBeDefined();
      expect(result!.message).toContain('"42"');
    });
  });

  // ==========================================================================
  // validatePathlessRegex
  // ==========================================================================

  describe('validatePathlessRegex', () => {
    it('should return violation when a value in updatedData matches', () => {
      const result = validatePathlessRegex({
        patterns: ['^forbidden'],
        filePath: 'values.yaml',
        rule: makeRule({ path: undefined }),
        oldValue: undefined,
        updatedValue: undefined,
        oldData: { a: 'safe' },
        updatedData: { a: 'forbidden-value' }
      });

      expect(result).toBeDefined();
      expect(result!.path).toBe('(global scan)');
      expect(result!.message).toContain('forbidden-value');
      expect(result!.message).toContain('found during global scan');
    });

    it('should return undefined when no values match', () => {
      const result = validatePathlessRegex({
        patterns: ['^forbidden'],
        filePath: 'values.yaml',
        rule: makeRule({ path: undefined }),
        oldValue: undefined,
        updatedValue: undefined,
        oldData: { a: 'safe' },
        updatedData: { a: 'allowed' }
      });

      expect(result).toBeUndefined();
    });

    it('should fall back to oldData when updatedData is undefined', () => {
      const result = validatePathlessRegex({
        patterns: ['^forbidden'],
        filePath: 'values.yaml',
        rule: makeRule({ path: undefined }),
        oldValue: undefined,
        updatedValue: undefined,
        oldData: { a: 'forbidden-old' },
        updatedData: undefined
      });

      expect(result).toBeDefined();
      expect(result!.message).toContain('forbidden-old');
    });

    it('should return undefined when both data sources are undefined', () => {
      const result = validatePathlessRegex({
        patterns: ['^forbidden'],
        filePath: 'values.yaml',
        rule: makeRule({ path: undefined }),
        oldValue: undefined,
        updatedValue: undefined,
        oldData: undefined,
        updatedData: undefined
      });

      expect(result).toBeUndefined();
    });

    it('should include patternSource in message when provided', () => {
      const result = validatePathlessRegex({
        patterns: ['^forbidden'],
        patternSource: 'patterns/rules.yaml',
        filePath: 'values.yaml',
        rule: makeRule({ path: undefined }),
        oldValue: undefined,
        updatedValue: undefined,
        updatedData: { a: 'forbidden-value' }
      });

      expect(result!.message).toContain('from patterns/rules.yaml');
    });

    it('should include pattern string in message when no patternSource', () => {
      const result = validatePathlessRegex({
        patterns: ['^forbidden'],
        filePath: 'values.yaml',
        rule: makeRule({ path: undefined }),
        oldValue: undefined,
        updatedValue: undefined,
        updatedData: { a: 'forbidden-value' }
      });

      expect(result!.message).toContain('^forbidden');
    });

    it('should set oldValue to oldData and updatedValue to updatedData', () => {
      const oldData = { a: 'safe' };
      const updatedData = { a: 'forbidden-value' };

      const result = validatePathlessRegex({
        patterns: ['^forbidden'],
        filePath: 'values.yaml',
        rule: makeRule({ path: undefined }),
        oldValue: undefined,
        updatedValue: undefined,
        oldData,
        updatedData
      });

      expect(result!.oldValue).toBe(oldData);
      expect(result!.updatedValue).toBe(updatedData);
    });

    it('should scan nested values', () => {
      const result = validatePathlessRegex({
        patterns: ['^forbidden'],
        filePath: 'values.yaml',
        rule: makeRule({ path: undefined }),
        oldValue: undefined,
        updatedValue: undefined,
        updatedData: { deep: { nested: { value: 'forbidden-deep' } } }
      });

      expect(result).toBeDefined();
      expect(result!.message).toContain('forbidden-deep');
    });
  });
});
