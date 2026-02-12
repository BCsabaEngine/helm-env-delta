import { describe, expect, it, vi } from 'vitest';

import {
  isTransformFileLoaderError,
  loadTransformFile,
  loadTransformFiles,
  TransformFileLoaderError
} from '../../src/utils/transformFileLoader';
import { YamlFileLoaderError } from '../../src/utils/yamlFileLoader';

vi.mock('../../src/utils/yamlFileLoader', async () => {
  const actual = await vi.importActual<typeof import('../../src/utils/yamlFileLoader')>(
    '../../src/utils/yamlFileLoader'
  );
  return {
    ...actual,
    loadYamlFile: vi.fn()
  };
});

import { loadYamlFile } from '../../src/utils/yamlFileLoader';

const mockLoadYamlFile = vi.mocked(loadYamlFile);

describe('utils/transformFileLoader', () => {
  // ==========================================================================
  // loadTransformFile
  // ==========================================================================

  describe('loadTransformFile', () => {
    it('should load valid transform file with escaped keys', () => {
      mockLoadYamlFile.mockReturnValue({
        'uat-cluster': 'prod-cluster',
        'uat.internal.example.com': 'prod.internal.example.com'
      });

      const result = loadTransformFile('./transforms.yaml', '/config');

      expect(result).toEqual([
        { find: 'uat-cluster', replace: 'prod-cluster' },
        { find: String.raw`uat\.internal\.example\.com`, replace: 'prod.internal.example.com' }
      ]);
      expect(mockLoadYamlFile).toHaveBeenCalledWith('./transforms.yaml', '/config', 'transform');
    });

    it('should return empty array for null (empty file)', () => {
      // eslint-disable-next-line unicorn/no-null -- YAML.parse returns null for empty files
      mockLoadYamlFile.mockReturnValue(null);

      const result = loadTransformFile('./empty.yaml', '/config');

      expect(result).toEqual([]);
    });

    it('should return empty array for undefined (empty file)', () => {
      mockLoadYamlFile.mockReturnValue();

      const result = loadTransformFile('./empty.yaml', '/config');

      expect(result).toEqual([]);
    });

    it('should throw on array data', () => {
      mockLoadYamlFile.mockReturnValue(['not', 'valid']);

      expect(() => loadTransformFile('./bad.yaml', '/config')).toThrow(TransformFileLoaderError);
      expect(() => loadTransformFile('./bad.yaml', '/config')).toThrow('must be a YAML object');
    });

    it('should throw on string data', () => {
      mockLoadYamlFile.mockReturnValue('just a string');

      expect(() => loadTransformFile('./bad.yaml', '/config')).toThrow(TransformFileLoaderError);
    });

    it('should throw on non-string values', () => {
      mockLoadYamlFile.mockReturnValue({ key: 123 });

      expect(() => loadTransformFile('./bad.yaml', '/config')).toThrow(TransformFileLoaderError);
      expect(() => loadTransformFile('./bad.yaml', '/config')).toThrow('All values must be strings');
    });

    it('should re-wrap YamlFileLoaderError', () => {
      mockLoadYamlFile.mockImplementation(() => {
        throw new YamlFileLoaderError('Cannot read transform file', { code: 'ENOENT' });
      });

      expect(() => loadTransformFile('./missing.yaml', '/config')).toThrow(TransformFileLoaderError);
    });

    it('should pass through non-YamlFileLoaderError errors', () => {
      mockLoadYamlFile.mockImplementation(() => {
        throw new TypeError('unexpected');
      });

      expect(() => loadTransformFile('./bad.yaml', '/config')).toThrow(TypeError);
    });
  });

  // ==========================================================================
  // loadTransformFiles
  // ==========================================================================

  describe('loadTransformFiles', () => {
    it('should handle a single string path', () => {
      mockLoadYamlFile.mockReturnValue({ key: 'value' });

      const result = loadTransformFiles('./single.yaml', '/config');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ find: 'key', replace: 'value' });
    });

    it('should handle an array of paths', () => {
      mockLoadYamlFile.mockReturnValueOnce({ first: 'one' }).mockReturnValueOnce({ second: 'two' });

      const result = loadTransformFiles(['./a.yaml', './b.yaml'], '/config');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ find: 'first', replace: 'one' });
      expect(result[1]).toEqual({ find: 'second', replace: 'two' });
    });

    it('should return empty array for empty array input', () => {
      const result = loadTransformFiles([], '/config');

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // Error class and type guard
  // ==========================================================================

  describe('error handling', () => {
    it('should identify TransformFileLoaderError with type guard', () => {
      const error = new TransformFileLoaderError('test', { code: 'INVALID_FORMAT' });
      expect(isTransformFileLoaderError(error)).toBe(true);
    });

    it('should not identify regular Error with type guard', () => {
      expect(isTransformFileLoaderError(new Error('test'))).toBe(false);
    });
  });
});
