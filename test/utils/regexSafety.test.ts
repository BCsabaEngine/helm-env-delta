import { describe, expect, it } from 'vitest';

import { isSafeRegex } from '../../src/utils/regexSafety';

describe('utils/regexSafety', () => {
  describe('isSafeRegex', () => {
    it('returns true for a safe literal pattern', () => {
      expect(isSafeRegex('foo')).toBe(true);
    });

    it('returns true for a safe character class with quantifier', () => {
      expect(isSafeRegex('[a-z]+')).toBe(true);
    });

    it('returns true for a safe grouped pattern without quantifier nesting', () => {
      expect(isSafeRegex('(abc)')).toBe(true);
    });

    it('returns false for nested + on group: (a+)+', () => {
      expect(isSafeRegex('(a+)+')).toBe(false);
    });

    it('returns false for nested * on group: (a*)*', () => {
      expect(isSafeRegex('(a*)*')).toBe(false);
    });

    it('returns false for mixed nested quantifiers: (a+)*', () => {
      expect(isSafeRegex('(a+)*')).toBe(false);
    });

    it('returns false for character class with inner + then outer +: ([a-z]+)+', () => {
      expect(isSafeRegex('([a-z]+)+')).toBe(false);
    });

    it('returns false for nested quantifier followed by {: (a+){2,5}', () => {
      expect(isSafeRegex('(a+){2,5}')).toBe(false);
    });
  });
});
