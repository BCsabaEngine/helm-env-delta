import { describe, expect, it } from 'vitest';

import { isCommentOnlyContent } from '../src/utils/commentOnlyDetector';

describe('commentOnlyDetector', () => {
  describe('isCommentOnlyContent', () => {
    it('should return true for file with only # comments', () => {
      const content = `# This is a comment
# Another comment
# Third comment`;
      expect(isCommentOnlyContent(content)).toBe(true);
    });

    it('should return true for file with comments and empty lines', () => {
      const content = `# Comment 1

# Comment 2

# Comment 3
`;
      expect(isCommentOnlyContent(content)).toBe(true);
    });

    it('should return true for file with comments and whitespace-only lines', () => {
      const content = `# Comment 1

# Comment 2

# Comment 3`;
      expect(isCommentOnlyContent(content)).toBe(true);
    });

    it('should return true for file with indented comments', () => {
      const content = `  # Indented comment
    # More indented
		# Tab indented`;
      expect(isCommentOnlyContent(content)).toBe(true);
    });

    it('should return true for file with trailing whitespace on comment lines', () => {
      const content = `# Comment with trailing spaces
# Another comment with tabs
# Clean comment`;
      expect(isCommentOnlyContent(content)).toBe(true);
    });

    it('should return false for file with YAML content', () => {
      const content = `# Comment
key: value`;
      expect(isCommentOnlyContent(content)).toBe(false);
    });

    it('should return false for file with mixed content', () => {
      const content = `# This is a header comment
name: my-app
# Another comment
version: 1.0.0`;
      expect(isCommentOnlyContent(content)).toBe(false);
    });

    it('should return false for empty file', () => {
      expect(isCommentOnlyContent('')).toBe(false);
    });

    it('should return false for undefined content', () => {
      expect(isCommentOnlyContent(undefined as unknown as string)).toBe(false);
    });

    it('should return true for file with only whitespace and comments', () => {
      const content = `

  # A comment

   `;
      expect(isCommentOnlyContent(content)).toBe(true);
    });

    it('should return false for YAML document separator', () => {
      const content = `---
# Comment`;
      expect(isCommentOnlyContent(content)).toBe(false);
    });

    it('should return true for single comment line', () => {
      expect(isCommentOnlyContent('# Just one comment')).toBe(true);
    });

    it('should return true for file with only empty lines', () => {
      const content = `

`;
      expect(isCommentOnlyContent(content)).toBe(true);
    });

    it('should return false for content that looks like comment but is in a string', () => {
      const content = `description: "# This is not a comment"`;
      expect(isCommentOnlyContent(content)).toBe(false);
    });
  });
});
