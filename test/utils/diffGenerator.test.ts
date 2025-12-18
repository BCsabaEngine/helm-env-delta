import { describe, expect, it } from 'vitest';

import { generateUnifiedDiff } from '../../src/utils/diffGenerator';

describe('utils/diffGenerator', () => {
  describe('generateUnifiedDiff', () => {
    it('should return minimal diff for identical content', () => {
      const content = 'line1\nline2\nline3';
      const result = generateUnifiedDiff('test.txt', content, content);

      expect(result).toContain('test.txt');
      expect(result).not.toContain('+line');
      expect(result).not.toContain('-line');
    });

    it('should show addition with + line', () => {
      const destination = 'line1\nline2';
      const source = 'line1\nline2\nline3';
      const result = generateUnifiedDiff('test.txt', destination, source);

      expect(result).toContain('+line3');
    });

    it('should show deletion with - line', () => {
      const destination = 'line1\nline2\nline3';
      const source = 'line1\nline2';
      const result = generateUnifiedDiff('test.txt', destination, source);

      expect(result).toContain('-line3');
    });

    it('should show change with - and + lines', () => {
      const destination = 'line1\nold content\nline3';
      const source = 'line1\nnew content\nline3';
      const result = generateUnifiedDiff('test.txt', destination, source);

      expect(result).toContain('-old content');
      expect(result).toContain('+new content');
    });

    it('should handle multi-line additions', () => {
      const destination = 'line1';
      const source = 'line1\nline2\nline3\nline4';
      const result = generateUnifiedDiff('test.txt', destination, source);

      expect(result).toContain('+line2');
      expect(result).toContain('+line3');
      expect(result).toContain('+line4');
    });

    it('should handle multi-line deletions', () => {
      const destination = 'line1\nline2\nline3\nline4';
      const source = 'line1';
      const result = generateUnifiedDiff('test.txt', destination, source);

      expect(result).toContain('-line2');
      expect(result).toContain('-line3');
      expect(result).toContain('-line4');
    });

    it('should handle multi-line changes', () => {
      const destination = 'line1\nold1\nold2\nline4';
      const source = 'line1\nnew1\nnew2\nline4';
      const result = generateUnifiedDiff('test.txt', destination, source);

      expect(result).toContain('-old1');
      expect(result).toContain('-old2');
      expect(result).toContain('+new1');
      expect(result).toContain('+new2');
    });

    it('should handle empty source and destination', () => {
      const result = generateUnifiedDiff('test.txt', '', '');

      expect(result).toContain('test.txt');
    });

    it('should handle empty source with non-empty destination', () => {
      const result = generateUnifiedDiff('test.txt', '', 'content');

      expect(result).toContain('+content');
    });

    it('should handle non-empty source with empty destination', () => {
      const result = generateUnifiedDiff('test.txt', 'content', '');

      expect(result).toContain('-content');
    });

    it('should include file path in headers', () => {
      const result = generateUnifiedDiff('path/to/file.yaml', 'old', 'new');

      expect(result).toContain('path/to/file.yaml');
    });

    it('should include Destination and Source labels in headers', () => {
      const result = generateUnifiedDiff('test.txt', 'old', 'new');

      expect(result).toContain('Destination');
      expect(result).toContain('Source');
    });

    it('should include context lines', () => {
      const destination = 'line1\nline2\nold\nline4\nline5';
      const source = 'line1\nline2\nnew\nline4\nline5';
      const result = generateUnifiedDiff('test.txt', destination, source);

      expect(result).toContain(' line');
    });

    it('should handle large content diff', () => {
      const destination = Array.from({ length: 100 }, (_, index) => `line${index}`).join('\n');
      const source = Array.from({ length: 100 }, (_, index) => `line${index}`).join('\n') + '\nnewline';
      const result = generateUnifiedDiff('test.txt', destination, source);

      expect(result).toContain('+newline');
      expect(result).toBeDefined();
    });
  });
});
