import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as YAML from 'yaml';

import packageJson from '../../package.json';
import { ConfigLoaderError, isConfigLoaderError, loadConfigFile } from '../../src/config/configLoader';
import { ConfigMergerError, isConfigMergerError } from '../../src/config/configMerger';

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

      expect(readFileSync).toHaveBeenCalledWith(expect.stringContaining('config.yaml'), 'utf8');
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
    it('should throw ConfigMergerError when file not found (ENOENT)', () => {
      const error: NodeJS.ErrnoException = new Error('File not found');
      error.code = 'ENOENT';
      vi.mocked(readFileSync).mockImplementation(() => {
        throw error;
      });

      expect(() => loadConfigFile('missing.yaml')).toThrow(ConfigMergerError);
      try {
        loadConfigFile('missing.yaml');
      } catch (error_) {
        expect(isConfigMergerError(error_)).toBe(true);
        if (isConfigMergerError(error_)) expect(error_.code).toBe('ENOENT');
      }
    });

    it('should throw ConfigMergerError when permission denied (EACCES)', () => {
      const error: NodeJS.ErrnoException = new Error('Permission denied');
      error.code = 'EACCES';
      vi.mocked(readFileSync).mockImplementation(() => {
        throw error;
      });

      expect(() => loadConfigFile('forbidden.yaml')).toThrow(ConfigMergerError);
      try {
        loadConfigFile('forbidden.yaml');
      } catch (error_) {
        if (isConfigMergerError(error_)) {
          expect(error_.code).toBe('EACCES');
          expect(error_.message).toContain('Permission denied');
        }
      }
    });

    it('should throw ConfigMergerError when path is directory (EISDIR)', () => {
      const error: NodeJS.ErrnoException = new Error('Is a directory');
      error.code = 'EISDIR';
      vi.mocked(readFileSync).mockImplementation(() => {
        throw error;
      });

      expect(() => loadConfigFile('./directory/')).toThrow(ConfigMergerError);
      try {
        loadConfigFile('./directory/');
      } catch (error_) {
        if (isConfigMergerError(error_)) expect(error_.code).toBe('EISDIR');
      }
    });
  });

  describe('YAML parsing errors', () => {
    it('should throw ConfigMergerError for invalid YAML syntax', () => {
      vi.mocked(readFileSync).mockReturnValue('invalid: yaml: syntax:');

      expect(() => loadConfigFile('bad.yaml')).toThrow();
    });

    it('should throw ConfigMergerError for malformed YAML', () => {
      vi.mocked(readFileSync).mockReturnValue('   \t\n  :  :\n');

      expect(() => loadConfigFile('malformed.yaml')).toThrow();
    });

    it('should include "Failed to parse YAML" in error message', () => {
      vi.mocked(readFileSync).mockReturnValue('bad yaml {{');

      try {
        loadConfigFile('config.yaml');
      } catch (error_) {
        if (isConfigMergerError(error_)) expect(error_.message).toContain('Failed to parse YAML');
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
            '*.yaml': { content: [{ find: 'uat-', replace: 'prod-' }] }
          }
        };
        vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

        const result = loadConfigFile('config.yaml');

        expect(result.transforms).toBeDefined();
        expect(result.transforms?.['*.yaml']).toEqual({
          content: [{ find: 'uat-', replace: 'prod-' }],
          filename: []
        });
      });

      it('should accept multiple transform rules per pattern', () => {
        const config = {
          source: './src',
          destination: './dest',
          transforms: {
            '*.yaml': {
              content: [
                { find: 'uat-', replace: 'prod-' },
                { find: 'debug', replace: 'info' }
              ]
            }
          }
        };
        vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

        const result = loadConfigFile('config.yaml');

        expect(result.transforms?.['*.yaml']?.content).toHaveLength(2);
      });

      it('should accept empty replace string', () => {
        const config = {
          source: './src',
          destination: './dest',
          transforms: {
            '*.yaml': { content: [{ find: 'uat-', replace: '' }] }
          }
        };
        vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

        const result = loadConfigFile('config.yaml');

        expect(result.transforms?.['*.yaml']?.content?.[0]?.replace).toBe('');
      });

      it('should accept complex regex patterns', () => {
        const config = {
          source: './src',
          destination: './dest',
          transforms: {
            '*.yaml': { content: [{ find: String.raw`uat-db\.(.+)\.internal`, replace: 'prod-db.$1.internal' }] }
          }
        };
        vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

        const result = loadConfigFile('config.yaml');

        expect(result.transforms?.['*.yaml']?.content?.[0]?.find).toBe(String.raw`uat-db\.(.+)\.internal`);
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

  describe('config inheritance with extends', () => {
    it('should load config with extends from base file', () => {
      const baseConfig = {
        prune: true,
        include: ['apps/*']
      };
      const childConfig = {
        extends: './base.yaml',
        source: './source',
        destination: './dest'
      };

      vi.mocked(readFileSync)
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce(YAML.stringify(baseConfig));

      const result = loadConfigFile('/path/to/config.yaml');

      expect(result.source).toBe('./source');
      expect(result.destination).toBe('./dest');
      expect(result.prune).toBe(true);
      expect(result.include).toEqual(['apps/*']);
    });

    it('should merge include arrays from base and child', () => {
      const baseConfig = {
        include: ['apps/*', 'svc/*']
      };
      const childConfig = {
        extends: './base.yaml',
        source: './source',
        destination: './dest',
        include: ['config/*']
      };

      vi.mocked(readFileSync)
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce(YAML.stringify(baseConfig));

      const result = loadConfigFile('/path/to/config.yaml');

      expect(result.include).toEqual(['apps/*', 'svc/*', 'config/*']);
    });

    it('should override base config values with child values', () => {
      const baseConfig = {
        prune: false,
        outputFormat: { indent: 2 }
      };
      const childConfig = {
        extends: './base.yaml',
        source: './source',
        destination: './dest',
        prune: true,
        outputFormat: { indent: 4 }
      };

      vi.mocked(readFileSync)
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce(YAML.stringify(baseConfig));

      const result = loadConfigFile('/path/to/config.yaml');

      expect(result.prune).toBe(true);
      expect(result.outputFormat?.indent).toBe(4);
    });
  });

  describe('formatOnly option', () => {
    it('should load format-only config without source', () => {
      const formatOnlyConfig = {
        destination: './path/to/destination',
        outputFormat: { indent: 4 }
      };
      vi.mocked(readFileSync).mockReturnValue(YAML.stringify(formatOnlyConfig));

      const result = loadConfigFile('format-only.yaml', false, undefined, { formatOnly: true });

      expect(result.destination).toBe('./path/to/destination');
      expect(result.source).toBeUndefined();
      expect(result.outputFormat?.indent).toBe(4);
    });

    it('should accept format-only config with optional source', () => {
      const formatOnlyConfig = {
        source: './optional/source',
        destination: './path/to/destination'
      };
      vi.mocked(readFileSync).mockReturnValue(YAML.stringify(formatOnlyConfig));

      const result = loadConfigFile('format-only.yaml', false, undefined, { formatOnly: true });

      expect(result.source).toBe('./optional/source');
      expect(result.destination).toBe('./path/to/destination');
    });

    it('should throw error for format-only config missing destination', () => {
      const invalidConfig = { outputFormat: { indent: 4 } };
      vi.mocked(readFileSync).mockReturnValue(YAML.stringify(invalidConfig));

      expect(() => loadConfigFile('format-only.yaml', false, undefined, { formatOnly: true })).toThrow();
    });

    it('should log config without source arrow when source is missing', () => {
      const formatOnlyConfig = { destination: './dest' };
      vi.mocked(readFileSync).mockReturnValue(YAML.stringify(formatOnlyConfig));

      loadConfigFile('format-only.yaml', false, undefined, { formatOnly: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('./dest'));
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('->'));
    });

    it('should log config with source arrow when source is present', () => {
      const formatOnlyConfig = { source: './src', destination: './dest' };
      vi.mocked(readFileSync).mockReturnValue(YAML.stringify(formatOnlyConfig));

      loadConfigFile('format-only.yaml', false, undefined, { formatOnly: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('./src -> ./dest'));
    });
  });

  describe('requiredVersion', () => {
    it('should throw when installed version is older than requiredVersion', () => {
      const config = {
        source: './path/to/source',
        destination: './path/to/destination',
        requiredVersion: '99.0.0'
      };
      vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

      expect(() => loadConfigFile('config.yaml')).toThrow(ConfigLoaderError);
      expect(() => loadConfigFile('config.yaml')).toThrow('v99.0.0');
    });

    it('should not throw when installed version meets requiredVersion', () => {
      const config = {
        source: './path/to/source',
        destination: './path/to/destination',
        requiredVersion: '0.0.1'
      };
      vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

      expect(() => loadConfigFile('config.yaml')).not.toThrow();
    });

    it('should not throw when installed version equals requiredVersion', () => {
      const config = {
        source: './path/to/source',
        destination: './path/to/destination',
        requiredVersion: packageJson.version
      };
      vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

      expect(() => loadConfigFile('config.yaml')).not.toThrow();
    });

    it('should not throw when requiredVersion is omitted', () => {
      const config = {
        source: './path/to/source',
        destination: './path/to/destination'
      };
      vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

      expect(() => loadConfigFile('config.yaml')).not.toThrow();
    });

    it('should include required version, current version, and npm install hint in error', () => {
      const config = {
        source: './path/to/source',
        destination: './path/to/destination',
        requiredVersion: '99.0.0'
      };
      vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

      try {
        loadConfigFile('config.yaml');
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ConfigLoaderError);
        const message = (error as Error).message;
        expect(message).toContain('99.0.0');
        expect(message).toContain('Current version');
        expect(message).toContain('npm install');
      }
    });

    it('should be identified by isConfigLoaderError type guard', () => {
      const error = new ConfigLoaderError('test', { code: 'VERSION_REQUIREMENT' });

      expect(isConfigLoaderError(error)).toBe(true);
      expect(isConfigLoaderError(new Error('other'))).toBe(false);
    });
  });
});
