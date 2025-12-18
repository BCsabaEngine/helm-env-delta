import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import YAML from 'yaml';

import { ConfigLoaderError, isConfigLoaderError, loadConfigFile } from '../src/configLoader';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn()
}));

import { readFileSync } from 'node:fs';

describe('configLoader', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadConfigFile', () => {
    const validConfig = {
      source: './path/to/source',
      destination: './path/to/destination'
    };

    it('should load valid YAML config file', () => {
      const yamlContent = YAML.stringify(validConfig);
      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = loadConfigFile('config.yaml');

      expect(readFileSync).toHaveBeenCalledWith('config.yaml', 'utf8');
      expect(result.source).toBe('./path/to/source');
      expect(result.destination).toBe('./path/to/destination');
    });

    it('should parse config content correctly', () => {
      const config = {
        ...validConfig,
        include: ['**/*.yaml'],
        exclude: ['**/secret.yaml'],
        prune: true
      };
      vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

      const result = loadConfigFile('config.yaml');

      expect(result.include).toEqual(['**/*.yaml']);
      expect(result.exclude).toEqual(['**/secret.yaml']);
      expect(result.prune).toBe(true);
    });

    it('should validate config against schema', () => {
      const yamlContent = YAML.stringify(validConfig);
      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = loadConfigFile('config.yaml');

      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('destination');
    });

    it('should return typed Config object', () => {
      const yamlContent = YAML.stringify(validConfig);
      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = loadConfigFile('config.yaml');

      expect(typeof result.source).toBe('string');
      expect(typeof result.destination).toBe('string');
    });

    it('should log success message with source and destination', () => {
      vi.mocked(readFileSync).mockReturnValue(YAML.stringify(validConfig));

      loadConfigFile('config.yaml');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('./path/to/source -> ./path/to/destination'));
    });

    it('should log prune indicator when prune is true', () => {
      const config = { ...validConfig, prune: true };
      vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

      loadConfigFile('config.yaml');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[prune!]'));
    });

    it('should not log prune indicator when prune is false', () => {
      const config = { ...validConfig, prune: false };
      vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

      loadConfigFile('config.yaml');

      const calls = consoleLogSpy.mock.calls.flat().join('');
      expect(calls).not.toContain('[prune!]');
    });
  });

  describe('file loading errors', () => {
    it('should throw ConfigLoaderError when file not found (ENOENT)', () => {
      const error: NodeJS.ErrnoException = new Error('File not found');
      error.code = 'ENOENT';
      vi.mocked(readFileSync).mockImplementation(() => {
        throw error;
      });

      expect(() => loadConfigFile('missing.yaml')).toThrow(ConfigLoaderError);
      try {
        loadConfigFile('missing.yaml');
      } catch (error_) {
        expect(isConfigLoaderError(error_)).toBe(true);
        if (isConfigLoaderError(error_)) {
          expect(error_.code).toBe('ENOENT');
          expect(error_.path).toBe('missing.yaml');
        }
      }
    });

    it('should throw ConfigLoaderError when permission denied (EACCES)', () => {
      const error: NodeJS.ErrnoException = new Error('Permission denied');
      error.code = 'EACCES';
      vi.mocked(readFileSync).mockImplementation(() => {
        throw error;
      });

      expect(() => loadConfigFile('forbidden.yaml')).toThrow(ConfigLoaderError);
      try {
        loadConfigFile('forbidden.yaml');
      } catch (error_) {
        if (isConfigLoaderError(error_)) {
          expect(error_.code).toBe('EACCES');
          expect(error_.message).toContain('Permission denied');
        }
      }
    });

    it('should throw ConfigLoaderError when path is directory (EISDIR)', () => {
      const error: NodeJS.ErrnoException = new Error('Is a directory');
      error.code = 'EISDIR';
      vi.mocked(readFileSync).mockImplementation(() => {
        throw error;
      });

      expect(() => loadConfigFile('./directory/')).toThrow(ConfigLoaderError);
      try {
        loadConfigFile('./directory/');
      } catch (error_) {
        if (isConfigLoaderError(error_)) {
          expect(error_.code).toBe('EISDIR');
          expect(error_.message).toContain('Path is a directory');
        }
      }
    });

    it('should include path in error object', () => {
      const error: NodeJS.ErrnoException = new Error('File not found');
      error.code = 'ENOENT';
      vi.mocked(readFileSync).mockImplementation(() => {
        throw error;
      });

      try {
        loadConfigFile('/path/to/config.yaml');
      } catch (error_) {
        if (isConfigLoaderError(error_)) expect(error_.path).toBe('/path/to/config.yaml');
      }
    });

    it('should include cause in error object', () => {
      const cause = new Error('Original error');
      (cause as NodeJS.ErrnoException).code = 'ENOENT';
      vi.mocked(readFileSync).mockImplementation(() => {
        throw cause;
      });

      try {
        loadConfigFile('config.yaml');
      } catch (error_) {
        if (isConfigLoaderError(error_)) expect(error_.cause).toBe(cause);
      }
    });
  });

  describe('YAML parsing errors', () => {
    it('should throw ConfigLoaderError for invalid YAML syntax', () => {
      vi.mocked(readFileSync).mockReturnValue('invalid: yaml: syntax:');

      expect(() => loadConfigFile('bad.yaml')).toThrow();
    });

    it('should throw ConfigLoaderError for malformed YAML', () => {
      vi.mocked(readFileSync).mockReturnValue('   \t\n  :  :\n');

      expect(() => loadConfigFile('malformed.yaml')).toThrow();
    });

    it('should include "Failed to parse YAML" in error message', () => {
      vi.mocked(readFileSync).mockReturnValue('bad yaml {{');

      try {
        loadConfigFile('config.yaml');
      } catch (error_) {
        if (isConfigLoaderError(error_)) expect(error_.message).toContain('Failed to parse YAML');
      }
    });

    it('should include path in YAML parse error', () => {
      vi.mocked(readFileSync).mockReturnValue('bad yaml {{');

      try {
        loadConfigFile('/path/bad.yaml');
      } catch (error_) {
        if (isConfigLoaderError(error_)) expect(error_.path).toBe('/path/bad.yaml');
      }
    });

    it('should include cause from YAML parser', () => {
      vi.mocked(readFileSync).mockReturnValue('bad yaml {{');

      try {
        loadConfigFile('config.yaml');
      } catch (error_) {
        if (isConfigLoaderError(error_)) expect(error_.cause).toBeDefined();
      }
    });
  });

  describe('schema validation errors', () => {
    it('should throw error for missing required field (source)', () => {
      const invalidConfig = { destination: './dest' };
      vi.mocked(readFileSync).mockReturnValue(YAML.stringify(invalidConfig));

      expect(() => loadConfigFile('config.yaml')).toThrow();
    });

    it('should throw error for missing required field (destination)', () => {
      const invalidConfig = { source: './src' };
      vi.mocked(readFileSync).mockReturnValue(YAML.stringify(invalidConfig));

      expect(() => loadConfigFile('config.yaml')).toThrow();
    });

    it('should throw error for invalid field type', () => {
      const invalidConfig = { source: 123, destination: './dest' };
      vi.mocked(readFileSync).mockReturnValue(YAML.stringify(invalidConfig));

      expect(() => loadConfigFile('config.yaml')).toThrow();
    });

    describe('transforms schema validation', () => {
      it('should accept valid transform rules', () => {
        const config = {
          source: './src',
          destination: './dest',
          transforms: {
            '*.yaml': [{ find: 'uat-', replace: 'prod-' }]
          }
        };
        vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

        const result = loadConfigFile('config.yaml');

        expect(result.transforms).toBeDefined();
        expect(result.transforms?.['*.yaml']).toEqual([{ find: 'uat-', replace: 'prod-' }]);
      });

      it('should accept multiple transform rules per pattern', () => {
        const config = {
          source: './src',
          destination: './dest',
          transforms: {
            '*.yaml': [
              { find: 'uat-', replace: 'prod-' },
              { find: 'debug', replace: 'info' }
            ]
          }
        };
        vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

        const result = loadConfigFile('config.yaml');

        expect(result.transforms?.['*.yaml']).toHaveLength(2);
      });

      it('should accept empty replace string', () => {
        const config = {
          source: './src',
          destination: './dest',
          transforms: {
            '*.yaml': [{ find: 'uat-', replace: '' }]
          }
        };
        vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

        const result = loadConfigFile('config.yaml');

        expect(result.transforms?.['*.yaml']?.[0]?.replace).toBe('');
      });

      it('should accept complex regex patterns', () => {
        const config = {
          source: './src',
          destination: './dest',
          transforms: {
            '*.yaml': [{ find: String.raw`uat-db\.(.+)\.internal`, replace: 'prod-db.$1.internal' }]
          }
        };
        vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

        const result = loadConfigFile('config.yaml');

        expect(result.transforms?.['*.yaml']?.[0]?.find).toBe(String.raw`uat-db\.(.+)\.internal`);
      });

      it('should throw error for invalid regex pattern', () => {
        const config = {
          source: './src',
          destination: './dest',
          transforms: {
            '*.yaml': [{ find: '[invalid(regex', replace: 'prod-' }]
          }
        };
        vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

        expect(() => loadConfigFile('config.yaml')).toThrow();
      });

      it('should throw error for empty find pattern', () => {
        const config = {
          source: './src',
          destination: './dest',
          transforms: {
            '*.yaml': [{ find: '', replace: 'prod-' }]
          }
        };
        vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

        expect(() => loadConfigFile('config.yaml')).toThrow();
      });

      it('should accept optional transforms field (backward compatibility)', () => {
        const config = {
          source: './src',
          destination: './dest'
        };
        vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

        const result = loadConfigFile('config.yaml');

        expect(result.transforms).toBeUndefined();
      });
    });
  });

  describe('isConfigLoaderError type guard', () => {
    it('should return true for ConfigLoaderError instances', () => {
      const error = new ConfigLoaderError('Test error');
      expect(isConfigLoaderError(error)).toBe(true);
    });

    it('should return false for other error types', () => {
      const error = new Error('Regular error');
      expect(isConfigLoaderError(error)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isConfigLoaderError()).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isConfigLoaderError('string')).toBe(false);
      expect(isConfigLoaderError(123)).toBe(false);
      expect(isConfigLoaderError({})).toBe(false);
    });
  });
});
