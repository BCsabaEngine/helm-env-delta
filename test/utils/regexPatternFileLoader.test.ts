import { describe, expect, it, vi } from 'vitest';

import {
  isRegexPatternFileLoaderError,
  loadRegexPatternArray,
  loadRegexPatternsFromKeys,
  RegexPatternFileLoaderError
} from '../../src/utils/regexPatternFileLoader';
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

describe('utils/regexPatternFileLoader', () => {
  // ==========================================================================
  // loadRegexPatternArray
  // ==========================================================================

  describe('loadRegexPatternArray', () => {
    it('should load valid array of patterns', () => {
      mockLoadYamlFile.mockReturnValue([String.raw`^v0\.`, 'localhost', '.*-debug$']);

      const result = loadRegexPatternArray('./patterns.yaml', '/config');

      expect(result).toEqual([String.raw`^v0\.`, 'localhost', '.*-debug$']);
      expect(mockLoadYamlFile).toHaveBeenCalledWith('./patterns.yaml', '/config', 'pattern');
    });

    it('should return empty array for null (empty file)', () => {
      // eslint-disable-next-line unicorn/no-null -- YAML.parse returns null for empty files
      mockLoadYamlFile.mockReturnValue(null);

      const result = loadRegexPatternArray('./empty.yaml', '/config');

      expect(result).toEqual([]);
    });

    it('should return empty array for undefined (empty file)', () => {
      mockLoadYamlFile.mockReturnValue();

      const result = loadRegexPatternArray('./empty.yaml', '/config');

      expect(result).toEqual([]);
    });

    it('should throw on non-array data', () => {
      mockLoadYamlFile.mockReturnValue({ key: 'value' });

      expect(() => loadRegexPatternArray('./bad.yaml', '/config')).toThrow(RegexPatternFileLoaderError);
      expect(() => loadRegexPatternArray('./bad.yaml', '/config')).toThrow('Pattern file must be a YAML array');
    });

    it('should throw on non-string array items', () => {
      mockLoadYamlFile.mockReturnValue(['valid', 123, 'also-valid']);

      expect(() => loadRegexPatternArray('./bad.yaml', '/config')).toThrow(RegexPatternFileLoaderError);
      expect(() => loadRegexPatternArray('./bad.yaml', '/config')).toThrow('must be a string');
    });

    it('should throw on invalid regex pattern', () => {
      mockLoadYamlFile.mockReturnValue(['valid-pattern', '[invalid']);

      expect(() => loadRegexPatternArray('./bad.yaml', '/config')).toThrow(RegexPatternFileLoaderError);
      expect(() => loadRegexPatternArray('./bad.yaml', '/config')).toThrow('Invalid regex pattern');
    });

    it('should re-wrap YamlFileLoaderError', () => {
      mockLoadYamlFile.mockImplementation(() => {
        throw new YamlFileLoaderError('Cannot read pattern file', { code: 'ENOENT' });
      });

      expect(() => loadRegexPatternArray('./missing.yaml', '/config')).toThrow(RegexPatternFileLoaderError);
    });

    it('should pass through non-YamlFileLoaderError errors', () => {
      mockLoadYamlFile.mockImplementation(() => {
        throw new TypeError('unexpected');
      });

      expect(() => loadRegexPatternArray('./bad.yaml', '/config')).toThrow(TypeError);
    });
  });

  // ==========================================================================
  // loadRegexPatternsFromKeys
  // ==========================================================================

  describe('loadRegexPatternsFromKeys', () => {
    it('should load keys from a valid object', () => {
      mockLoadYamlFile.mockReturnValue({
        'uat-cluster': 'prod-cluster',
        'uat\\.internal': 'prod.internal'
      });

      const result = loadRegexPatternsFromKeys('./transforms.yaml', '/config');

      expect(result).toEqual(['uat-cluster', String.raw`uat\.internal`]);
    });

    it('should return empty array for null (empty file)', () => {
      // eslint-disable-next-line unicorn/no-null -- YAML.parse returns null for empty files
      mockLoadYamlFile.mockReturnValue(null);

      const result = loadRegexPatternsFromKeys('./empty.yaml', '/config');

      expect(result).toEqual([]);
    });

    it('should return empty array for undefined (empty file)', () => {
      mockLoadYamlFile.mockReturnValue();

      const result = loadRegexPatternsFromKeys('./empty.yaml', '/config');

      expect(result).toEqual([]);
    });

    it('should throw on array data', () => {
      mockLoadYamlFile.mockReturnValue(['not', 'an', 'object']);

      expect(() => loadRegexPatternsFromKeys('./bad.yaml', '/config')).toThrow(RegexPatternFileLoaderError);
      expect(() => loadRegexPatternsFromKeys('./bad.yaml', '/config')).toThrow(
        'Pattern file must be a YAML object with keys'
      );
    });

    it('should throw on primitive data', () => {
      mockLoadYamlFile.mockReturnValue('just a string');

      expect(() => loadRegexPatternsFromKeys('./bad.yaml', '/config')).toThrow(RegexPatternFileLoaderError);
    });

    it('should throw on invalid regex key', () => {
      mockLoadYamlFile.mockReturnValue({ '[invalid': 'value' });

      expect(() => loadRegexPatternsFromKeys('./bad.yaml', '/config')).toThrow(RegexPatternFileLoaderError);
      expect(() => loadRegexPatternsFromKeys('./bad.yaml', '/config')).toThrow('Invalid regex pattern');
    });

    it('should re-wrap YamlFileLoaderError', () => {
      mockLoadYamlFile.mockImplementation(() => {
        throw new YamlFileLoaderError('Cannot read pattern file', { code: 'ENOENT' });
      });

      expect(() => loadRegexPatternsFromKeys('./missing.yaml', '/config')).toThrow(RegexPatternFileLoaderError);
    });

    it('should pass through non-YamlFileLoaderError errors', () => {
      mockLoadYamlFile.mockImplementation(() => {
        throw new TypeError('unexpected');
      });

      expect(() => loadRegexPatternsFromKeys('./bad.yaml', '/config')).toThrow(TypeError);
    });
  });

  // ==========================================================================
  // Error class and type guard
  // ==========================================================================

  describe('error handling', () => {
    it('should identify RegexPatternFileLoaderError with type guard', () => {
      const error = new RegexPatternFileLoaderError('test', { code: 'INVALID_REGEX' });
      expect(isRegexPatternFileLoaderError(error)).toBe(true);
    });

    it('should not identify regular Error with type guard', () => {
      expect(isRegexPatternFileLoaderError(new Error('test'))).toBe(false);
    });
  });
});
