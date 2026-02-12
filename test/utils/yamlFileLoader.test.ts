import fs from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { escapeRegex, isYamlFileLoaderError, loadYamlFile, YamlFileLoaderError } from '../../src/utils/yamlFileLoader';

vi.mock('node:fs', () => ({
  default: { readFileSync: vi.fn() }
}));

const mockReadFileSync = vi.mocked(fs.readFileSync);

describe('utils/yamlFileLoader', () => {
  // ==========================================================================
  // loadYamlFile
  // ==========================================================================

  describe('loadYamlFile', () => {
    it('should load and parse a valid YAML file', () => {
      mockReadFileSync.mockReturnValue('key: value\nlist:\n  - item1\n  - item2');

      const result = loadYamlFile('./config.yaml', '/project', 'config');

      expect(result).toEqual({ key: 'value', list: ['item1', 'item2'] });
    });

    it('should resolve relative paths against config directory', () => {
      mockReadFileSync.mockReturnValue('key: value');

      loadYamlFile('./sub/config.yaml', '/project', 'config');

      expect(mockReadFileSync).toHaveBeenCalledWith(expect.stringContaining('/project/sub/config.yaml'), 'utf8');
    });

    it('should use absolute paths as-is', () => {
      mockReadFileSync.mockReturnValue('key: value');

      loadYamlFile('/absolute/config.yaml', '/project', 'config');

      expect(mockReadFileSync).toHaveBeenCalledWith('/absolute/config.yaml', 'utf8');
    });

    it('should return null for empty file', () => {
      mockReadFileSync.mockReturnValue('');

      const result = loadYamlFile('./empty.yaml', '/project', 'config');

      expect(result).toBeNull();
    });

    it('should throw ENOENT error for missing file', () => {
      const error = new Error('ENOENT: no such file') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockReadFileSync.mockImplementation(() => {
        throw error;
      });

      expect(() => loadYamlFile('./missing.yaml', '/project', 'config')).toThrow(YamlFileLoaderError);

      try {
        loadYamlFile('./missing.yaml', '/project', 'config');
      } catch (error_) {
        expect((error_ as InstanceType<typeof YamlFileLoaderError>).code).toBe('ENOENT');
      }
    });

    it('should throw FILE_NOT_FOUND for non-ENOENT read errors', () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      mockReadFileSync.mockImplementation(() => {
        throw error;
      });

      expect(() => loadYamlFile('./noperm.yaml', '/project', 'config')).toThrow(YamlFileLoaderError);

      try {
        loadYamlFile('./noperm.yaml', '/project', 'config');
      } catch (error_) {
        expect((error_ as InstanceType<typeof YamlFileLoaderError>).code).toBe('FILE_NOT_FOUND');
      }
    });

    it('should throw PARSE_ERROR for invalid YAML', () => {
      mockReadFileSync.mockReturnValue('invalid: yaml: content: [');

      expect(() => loadYamlFile('./bad.yaml', '/project', 'config')).toThrow(YamlFileLoaderError);

      try {
        loadYamlFile('./bad.yaml', '/project', 'config');
      } catch (error_) {
        expect((error_ as InstanceType<typeof YamlFileLoaderError>).code).toBe('PARSE_ERROR');
      }
    });

    it('should include file type in error messages', () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockReadFileSync.mockImplementation(() => {
        throw error;
      });

      expect(() => loadYamlFile('./missing.yaml', '/project', 'transform')).toThrow('transform file');
    });
  });

  // ==========================================================================
  // escapeRegex
  // ==========================================================================

  describe('escapeRegex', () => {
    it('should escape dots', () => {
      expect(escapeRegex('example.com')).toBe(String.raw`example\.com`);
    });

    it('should escape brackets', () => {
      expect(escapeRegex('[test]')).toBe(String.raw`\[test\]`);
    });

    it('should escape parentheses', () => {
      expect(escapeRegex('(group)')).toBe(String.raw`\(group\)`);
    });

    it('should escape asterisks', () => {
      expect(escapeRegex('file*')).toBe(String.raw`file\*`);
    });

    it('should escape plus signs', () => {
      expect(escapeRegex('a+b')).toBe(String.raw`a\+b`);
    });

    it('should escape question marks', () => {
      expect(escapeRegex('maybe?')).toBe(String.raw`maybe\?`);
    });

    it('should escape caret and dollar', () => {
      expect(escapeRegex('^start$end')).toBe(String.raw`\^start\$end`);
    });

    it('should escape curly braces', () => {
      expect(escapeRegex('{n}')).toBe(String.raw`\{n\}`);
    });

    it('should escape pipe', () => {
      expect(escapeRegex('a|b')).toBe(String.raw`a\|b`);
    });

    it('should escape backslash', () => {
      expect(escapeRegex(String.raw`path\to`)).toBe(String.raw`path\\to`);
    });

    it('should return empty string for empty input', () => {
      expect(escapeRegex('')).toBe('');
    });

    it('should return plain strings unchanged', () => {
      expect(escapeRegex('simple-string')).toBe('simple-string');
    });

    it('should escape multiple special chars in IP address', () => {
      expect(escapeRegex('10.0.0.1')).toBe(String.raw`10\.0\.0\.1`);
    });
  });

  // ==========================================================================
  // Error class and type guard
  // ==========================================================================

  describe('error handling', () => {
    it('should identify YamlFileLoaderError with type guard', () => {
      const error = new YamlFileLoaderError('test', { code: 'ENOENT' });
      expect(isYamlFileLoaderError(error)).toBe(true);
    });

    it('should not identify regular Error with type guard', () => {
      expect(isYamlFileLoaderError(new Error('test'))).toBe(false);
    });
  });
});
