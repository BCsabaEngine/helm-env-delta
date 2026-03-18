import { describe, expect, it } from 'vitest';

import { isCommentOnlyContent } from '../../src/utils/commentOnlyDetector';

describe('utils/commentOnlyDetector', () => {
  describe('isCommentOnlyContent', () => {
    it('returns false for empty string', () => {
      expect(isCommentOnlyContent('')).toBe(false);
    });

    it('returns true for blank lines only', () => {
      expect(isCommentOnlyContent('\n\n  \n')).toBe(true);
    });

    it('returns true for comments only', () => {
      expect(isCommentOnlyContent('# foo\n# bar')).toBe(true);
    });

    it('returns false when YAML content follows comments', () => {
      expect(isCommentOnlyContent('# title\n\nkey: val')).toBe(false);
    });

    it('returns false for a single YAML value', () => {
      expect(isCommentOnlyContent('key: value')).toBe(false);
    });

    it('returns true for an indented comment line', () => {
      expect(isCommentOnlyContent('  # indented comment')).toBe(true);
    });
  });
});
