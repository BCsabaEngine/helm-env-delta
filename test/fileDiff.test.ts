import { describe, expect, it } from 'vitest';

import { computeFileDiff, getSkipPathsForFile } from '../src/fileDiff';

describe('fileDiff', () => {
  describe('computeFileDiff', () => {
    it('should detect added files', () => {
      const source = new Map([['new.yaml', 'content']]);
      const destination = new Map();
      const config = { source: './src', destination: './dest' };

      const result = computeFileDiff(source, destination, config);

      expect(result.addedFiles).toContain('new.yaml');
      expect(result.deletedFiles).toHaveLength(0);
    });

    it('should detect deleted files when prune enabled', () => {
      const source = new Map();
      const destination = new Map([['old.yaml', 'content']]);
      const config = { source: './src', destination: './dest', prune: true };

      const result = computeFileDiff(source, destination, config);

      expect(result.deletedFiles).toContain('old.yaml');
      expect(result.addedFiles).toHaveLength(0);
    });

    it('should detect unchanged files', () => {
      const source = new Map([['file.yaml', 'content']]);
      const destination = new Map([['file.yaml', 'content']]);
      const config = { source: './src', destination: './dest' };

      const result = computeFileDiff(source, destination, config);

      expect(result.unchangedFiles).toContain('file.yaml');
      expect(result.changedFiles).toHaveLength(0);
    });

    it('should detect changed YAML files', () => {
      const source = new Map([['file.yaml', 'version: 2.0.0']]);
      const destination = new Map([['file.yaml', 'version: 1.0.0']]);
      const config = { source: './src', destination: './dest' };

      const result = computeFileDiff(source, destination, config);

      expect(result.changedFiles).toHaveLength(1);
      expect(result.changedFiles[0]?.path).toBe('file.yaml');
    });

    it('should detect changed non-YAML files', () => {
      const source = new Map([['file.txt', 'new content']]);
      const destination = new Map([['file.txt', 'old content']]);
      const config = { source: './src', destination: './dest' };

      const result = computeFileDiff(source, destination, config);

      expect(result.changedFiles).toHaveLength(1);
    });

    it('should apply skipPath filters', () => {
      const source = new Map([['file.yaml', 'version: 2.0.0\ndata: test']]);
      const destination = new Map([['file.yaml', 'version: 1.0.0\ndata: test']]);
      const config = {
        source: './src',
        destination: './dest',
        skipPath: { '*.yaml': ['version'] }
      };

      const result = computeFileDiff(source, destination, config);

      expect(result.unchangedFiles).toContain('file.yaml');
    });

    it('should handle mixed file types', () => {
      const source = new Map([
        ['file.yaml', 'content'],
        ['file.txt', 'content']
      ]);
      const destination = new Map([
        ['file.yaml', 'different'],
        ['file.txt', 'content']
      ]);
      const config = { source: './src', destination: './dest' };

      const result = computeFileDiff(source, destination, config);

      expect(result.changedFiles).toHaveLength(1);
      expect(result.unchangedFiles).toHaveLength(1);
    });

    it('should return empty arrays when no files', () => {
      const source = new Map();
      const destination = new Map();
      const config = { source: './src', destination: './dest' };

      const result = computeFileDiff(source, destination, config);

      expect(result.addedFiles).toHaveLength(0);
      expect(result.deletedFiles).toHaveLength(0);
      expect(result.changedFiles).toHaveLength(0);
      expect(result.unchangedFiles).toHaveLength(0);
    });
  });

  describe('getSkipPathsForFile', () => {
    it('should return empty array when no skipPath config', () => {
      const result = getSkipPathsForFile('file.yaml');

      expect(result).toEqual([]);
    });

    it('should return paths for matching pattern', () => {
      const skipPath = { '*.yaml': ['version', 'metadata'] };

      const result = getSkipPathsForFile('test.yaml', skipPath);

      expect(result).toEqual(['version', 'metadata']);
    });

    it('should return empty array for non-matching pattern', () => {
      const skipPath = { '*.json': ['version'] };

      const result = getSkipPathsForFile('test.yaml', skipPath);

      expect(result).toEqual([]);
    });

    it('should combine paths from multiple matching patterns', () => {
      const skipPath = {
        '*.yaml': ['version'],
        'test.*': ['metadata']
      };

      const result = getSkipPathsForFile('test.yaml', skipPath);

      expect(result).toContain('version');
      expect(result).toContain('metadata');
    });

    it('should handle glob patterns', () => {
      const skipPath = { 'apps/**/*.yaml': ['secrets'] };

      const result = getSkipPathsForFile('apps/prod/values.yaml', skipPath);

      expect(result).toEqual(['secrets']);
    });
  });
});
