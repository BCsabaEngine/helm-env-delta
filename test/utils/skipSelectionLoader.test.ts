import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn()
}));

import { readFileSync } from 'node:fs';

import {
  isSkipSelectionLoaderError,
  loadSkipSelection,
  mergeSkipSelection,
  SkipSelectionLoaderError
} from '../../src/utils/skipSelectionLoader';

describe('utils/skipSelectionLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SkipSelectionLoaderError', () => {
    it('should create error with message', () => {
      const error = new SkipSelectionLoaderError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('Skip Selection Loader Error');
      expect(error.message).toContain('Test error');
    });

    it('should create error with FILE_NOT_FOUND code', () => {
      const error = new SkipSelectionLoaderError('File not found', {
        code: 'FILE_NOT_FOUND',
        path: '/path/to/file.json'
      });
      expect(error.code).toBe('FILE_NOT_FOUND');
      expect(error.path).toBe('/path/to/file.json');
    });

    it('should create error with INVALID_JSON code', () => {
      const error = new SkipSelectionLoaderError('Invalid JSON', {
        code: 'INVALID_JSON'
      });
      expect(error.code).toBe('INVALID_JSON');
    });

    it('should create error with INVALID_FORMAT code', () => {
      const error = new SkipSelectionLoaderError('Invalid format', {
        code: 'INVALID_FORMAT'
      });
      expect(error.code).toBe('INVALID_FORMAT');
    });
  });

  describe('isSkipSelectionLoaderError', () => {
    it('should return true for SkipSelectionLoaderError', () => {
      const error = new SkipSelectionLoaderError('Test');
      expect(isSkipSelectionLoaderError(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Test');
      expect(isSkipSelectionLoaderError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isSkipSelectionLoaderError()).toBe(false);
      expect(isSkipSelectionLoaderError()).toBe(false);
      expect(isSkipSelectionLoaderError('error')).toBe(false);
    });
  });

  describe('loadSkipSelection', () => {
    it('should load and parse valid selection file', () => {
      const selectionJson = JSON.stringify({
        selections: [
          { file: 'values.yaml', path: 'image.tag', value: 'v1.0.0' },
          { file: 'values.yaml', path: 'replicas', value: 3 }
        ]
      });
      vi.mocked(readFileSync).mockReturnValue(selectionJson);

      const result = loadSkipSelection('/path/to/selections.json');

      expect(result).toEqual({
        'values.yaml': ['image.tag', 'replicas']
      });
    });

    it('should group selections by file', () => {
      const selectionJson = JSON.stringify({
        selections: [
          { file: 'values-prod.yaml', path: 'image.tag' },
          { file: 'values-dev.yaml', path: 'debug' },
          { file: 'values-prod.yaml', path: 'replicas' }
        ]
      });
      vi.mocked(readFileSync).mockReturnValue(selectionJson);

      const result = loadSkipSelection('/path/to/selections.json');

      expect(result).toEqual({
        'values-prod.yaml': ['image.tag', 'replicas'],
        'values-dev.yaml': ['debug']
      });
    });

    it('should deduplicate paths within same file', () => {
      const selectionJson = JSON.stringify({
        selections: [
          { file: 'values.yaml', path: 'image.tag' },
          { file: 'values.yaml', path: 'image.tag' },
          { file: 'values.yaml', path: 'replicas' }
        ]
      });
      vi.mocked(readFileSync).mockReturnValue(selectionJson);

      const result = loadSkipSelection('/path/to/selections.json');

      expect(result['values.yaml']).toHaveLength(2);
      expect(result['values.yaml']).toContain('image.tag');
      expect(result['values.yaml']).toContain('replicas');
    });

    it('should throw FILE_NOT_FOUND error when file does not exist', () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      expect(() => loadSkipSelection('/nonexistent.json')).toThrow(SkipSelectionLoaderError);

      try {
        loadSkipSelection('/nonexistent.json');
      } catch (error) {
        expect((error as SkipSelectionLoaderError).code).toBe('FILE_NOT_FOUND');
      }
    });

    it('should throw INVALID_JSON error when file contains invalid JSON', () => {
      vi.mocked(readFileSync).mockReturnValue('{ invalid json }');

      expect(() => loadSkipSelection('/invalid.json')).toThrow(SkipSelectionLoaderError);

      try {
        loadSkipSelection('/invalid.json');
      } catch (error) {
        expect((error as SkipSelectionLoaderError).code).toBe('INVALID_JSON');
      }
    });

    it('should throw INVALID_FORMAT error when selections array is missing', () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ foo: 'bar' }));

      expect(() => loadSkipSelection('/invalid-format.json')).toThrow(SkipSelectionLoaderError);

      try {
        loadSkipSelection('/invalid-format.json');
      } catch (error) {
        expect((error as SkipSelectionLoaderError).code).toBe('INVALID_FORMAT');
      }
    });

    it('should throw INVALID_FORMAT error when selections is not an array', () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ selections: 'not an array' }));

      expect(() => loadSkipSelection('/invalid-format.json')).toThrow(SkipSelectionLoaderError);

      try {
        loadSkipSelection('/invalid-format.json');
      } catch (error) {
        expect((error as SkipSelectionLoaderError).code).toBe('INVALID_FORMAT');
      }
    });

    it('should skip entries without file property', () => {
      const selectionJson = JSON.stringify({
        selections: [
          { file: 'values.yaml', path: 'image.tag' },
          { path: 'missing-file' },
          { file: 'values.yaml', path: 'replicas' }
        ]
      });
      vi.mocked(readFileSync).mockReturnValue(selectionJson);

      const result = loadSkipSelection('/path/to/selections.json');

      expect(result['values.yaml']).toHaveLength(2);
    });

    it('should skip entries without path property', () => {
      const selectionJson = JSON.stringify({
        selections: [
          { file: 'values.yaml', path: 'image.tag' },
          { file: 'values.yaml' },
          { file: 'values.yaml', path: 'replicas' }
        ]
      });
      vi.mocked(readFileSync).mockReturnValue(selectionJson);

      const result = loadSkipSelection('/path/to/selections.json');

      expect(result['values.yaml']).toHaveLength(2);
    });

    it('should handle empty selections array', () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ selections: [] }));

      const result = loadSkipSelection('/path/to/selections.json');

      expect(result).toEqual({});
    });

    it('should handle selections with filter notation paths', () => {
      const selectionJson = JSON.stringify({
        selections: [
          { file: 'values.yaml', path: 'env[name=DEBUG].value' },
          { file: 'values.yaml', path: 'containers[name^=sidecar-].resources' }
        ]
      });
      vi.mocked(readFileSync).mockReturnValue(selectionJson);

      const result = loadSkipSelection('/path/to/selections.json');

      expect(result['values.yaml']).toContain('env[name=DEBUG].value');
      expect(result['values.yaml']).toContain('containers[name^=sidecar-].resources');
    });
  });

  describe('mergeSkipSelection', () => {
    it('should return selection skipPath when existing is undefined', () => {
      const selectionSkipPath = {
        'values.yaml': ['image.tag']
      };

      const result = mergeSkipSelection(undefined, selectionSkipPath);

      expect(result).toEqual(selectionSkipPath);
    });

    it('should merge selection into existing skipPath', () => {
      const existing = {
        'values.yaml': ['debug'],
        'config.yaml': ['secret']
      };
      const selection = {
        'values.yaml': ['image.tag'],
        'values-prod.yaml': ['replicas']
      };

      const result = mergeSkipSelection(existing, selection);

      expect(result).toEqual({
        'values.yaml': ['debug', 'image.tag'],
        'config.yaml': ['secret'],
        'values-prod.yaml': ['replicas']
      });
    });

    it('should not duplicate paths that already exist', () => {
      const existing = {
        'values.yaml': ['image.tag', 'debug']
      };
      const selection = {
        'values.yaml': ['image.tag', 'replicas']
      };

      const result = mergeSkipSelection(existing, selection);

      expect(result['values.yaml']).toHaveLength(3);
      expect(result['values.yaml']).toEqual(['image.tag', 'debug', 'replicas']);
    });

    it('should not modify existing skipPath object', () => {
      const existing = {
        'values.yaml': ['debug']
      };
      const selection = {
        'values.yaml': ['image.tag']
      };

      const result = mergeSkipSelection(existing, selection);

      expect(existing['values.yaml']).toHaveLength(1);
      expect(result['values.yaml']).toHaveLength(2);
    });

    it('should handle empty selection', () => {
      const existing = {
        'values.yaml': ['debug']
      };

      const result = mergeSkipSelection(existing, {});

      expect(result).toEqual(existing);
    });

    it('should handle empty existing', () => {
      const selection = {
        'values.yaml': ['image.tag']
      };

      const result = mergeSkipSelection({}, selection);

      expect(result).toEqual(selection);
    });
  });
});
