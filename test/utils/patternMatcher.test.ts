import { describe, expect, it } from 'vitest';

import { globalMatcher, PatternMatcher } from '../../src/utils/patternMatcher';

describe('utils/patternMatcher', () => {
  describe('PatternMatcher', () => {
    it('compilePattern returns a RegExp', () => {
      const matcher = new PatternMatcher();
      const regex = matcher.compilePattern('*.yaml');
      expect(regex).toBeInstanceOf(RegExp);
    });

    it('compilePattern returns the same cached instance for the same pattern', () => {
      const matcher = new PatternMatcher();
      const first = matcher.compilePattern('*.yaml');
      const second = matcher.compilePattern('*.yaml');
      expect(first).toBe(second);
    });

    it('match returns true when path matches *.yaml pattern', () => {
      const matcher = new PatternMatcher();
      expect(matcher.match('foo.yaml', '*.yaml')).toBe(true);
    });

    it('match returns false when path does not match *.yaml pattern', () => {
      const matcher = new PatternMatcher();
      expect(matcher.match('foo.ts', '*.yaml')).toBe(false);
    });

    it('match handles **/values*.yaml for nested paths', () => {
      const matcher = new PatternMatcher();
      expect(matcher.match('charts/app/values-prod.yaml', '**/values*.yaml')).toBe(true);
    });

    it('clearCache causes compilePattern to return a new RegExp instance', () => {
      const matcher = new PatternMatcher();
      const before = matcher.compilePattern('*.yaml');
      matcher.clearCache();
      const after = matcher.compilePattern('*.yaml');
      expect(before).not.toBe(after);
    });
  });

  describe('globalMatcher', () => {
    it('is an instance of PatternMatcher', () => {
      expect(globalMatcher).toBeInstanceOf(PatternMatcher);
    });

    it('caches patterns across calls', () => {
      const first = globalMatcher.compilePattern('**/*.json');
      const second = globalMatcher.compilePattern('**/*.json');
      expect(first).toBe(second);
    });
  });
});
