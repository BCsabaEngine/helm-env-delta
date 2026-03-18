import { describe, expect, it } from 'vitest';

import { applyRegexRulesSequentially } from '../../src/utils/regexTransform';

describe('utils/regexTransform', () => {
  describe('applyRegexRulesSequentially', () => {
    it('returns the original value when no rules are provided', () => {
      expect(applyRegexRulesSequentially('hello', [])).toBe('hello');
    });

    it('applies a single find/replace rule', () => {
      const result = applyRegexRulesSequentially('hello world', [{ find: 'world', replace: 'there' }]);
      expect(result).toBe('hello there');
    });

    it('applies multiple rules in order, piping output through each', () => {
      const rules = [
        { find: 'foo', replace: 'bar' },
        { find: 'bar', replace: 'baz' }
      ];
      expect(applyRegexRulesSequentially('foo', rules)).toBe('baz');
    });

    it('supports capture groups in replacement', () => {
      const result = applyRegexRulesSequentially('foo', [{ find: '(foo)', replace: '$1bar' }]);
      expect(result).toBe('foobar');
    });

    it('replaces all occurrences (global flag)', () => {
      const result = applyRegexRulesSequentially('aaa', [{ find: 'a', replace: 'b' }]);
      expect(result).toBe('bbb');
    });

    it('silently skips an invalid regex when throwOnError is false (default)', () => {
      const rules = [
        { find: '[invalid', replace: 'x' },
        { find: 'hello', replace: 'world' }
      ];
      expect(applyRegexRulesSequentially('hello', rules)).toBe('world');
    });

    it('throws when an invalid regex is encountered and throwOnError is true', () => {
      const rules = [{ find: '[invalid', replace: 'x' }];
      expect(() => applyRegexRulesSequentially('hello', rules, true)).toThrow();
    });
  });
});
