import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as YAML from 'yaml';

import type { BaseConfig } from '../src/configFile';
import { ConfigMergerError, isConfigMergerError, mergeConfigs, resolveConfigWithExtends } from '../src/configMerger';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn()
}));

import { readFileSync } from 'node:fs';

describe('configMerger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('mergeConfigs', () => {
    it('should override primitive fields from parent with child', () => {
      const parent: BaseConfig = {
        source: './parent-source',
        destination: './parent-dest',
        prune: false
      };
      const child: BaseConfig = {
        source: './child-source',
        prune: true
      };

      const result = mergeConfigs(parent, child);

      expect(result.source).toBe('./child-source');
      expect(result.destination).toBe('./parent-dest');
      expect(result.prune).toBe(true);
    });

    it('should concatenate include arrays', () => {
      const parent: BaseConfig = {
        include: ['apps/*', 'svc/*']
      };
      const child: BaseConfig = {
        include: ['config/*']
      };

      const result = mergeConfigs(parent, child);

      expect(result.include).toEqual(['apps/*', 'svc/*', 'config/*']);
    });

    it('should concatenate exclude arrays', () => {
      const parent: BaseConfig = {
        exclude: ['**/*.tmp']
      };
      const child: BaseConfig = {
        exclude: ['**/*.bak']
      };

      const result = mergeConfigs(parent, child);

      expect(result.exclude).toEqual(['**/*.tmp', '**/*.bak']);
    });

    it('should merge outputFormat object', () => {
      const parent: BaseConfig = {
        outputFormat: {
          indent: 2,
          keySeparator: true
        }
      };
      const child: BaseConfig = {
        outputFormat: {
          indent: 4
        }
      };

      const result = mergeConfigs(parent, child);

      expect(result.outputFormat?.indent).toBe(4);
      expect(result.outputFormat?.keySeparator).toBe(true);
    });

    it('should merge per-file skipPath rules', () => {
      const parent: BaseConfig = {
        skipPath: {
          'apps/*.yaml': ['spec.secrets'],
          'svc/*.yaml': ['metadata.labels']
        }
      };
      const child: BaseConfig = {
        skipPath: {
          'apps/*.yaml': ['spec.env'],
          'config/*.yaml': ['data']
        }
      };

      const result = mergeConfigs(parent, child);

      expect(result.skipPath).toEqual({
        'apps/*.yaml': ['spec.secrets', 'spec.env'],
        'svc/*.yaml': ['metadata.labels'],
        'config/*.yaml': ['data']
      });
    });

    it('should merge per-file transforms rules', () => {
      const parent: BaseConfig = {
        transforms: {
          'apps/*.yaml': {
            content: [{ find: 'old', replace: 'new' }],
            filename: [{ find: 'uat', replace: 'prod' }]
          }
        }
      };
      const child: BaseConfig = {
        transforms: {
          'apps/*.yaml': {
            content: [{ find: 'dev', replace: 'prod' }]
          },
          'svc/*.yaml': {
            filename: [{ find: 'test', replace: 'live' }]
          }
        }
      };

      const result = mergeConfigs(parent, child);

      expect(result.transforms).toEqual({
        'apps/*.yaml': {
          content: [
            { find: 'old', replace: 'new' },
            { find: 'dev', replace: 'prod' }
          ],
          filename: [{ find: 'uat', replace: 'prod' }]
        },
        'svc/*.yaml': {
          content: [],
          filename: [{ find: 'test', replace: 'live' }]
        }
      });
    });

    it('should merge per-file stopRules', () => {
      const parent: BaseConfig = {
        stopRules: {
          'apps/*.yaml': [{ type: 'semverMajorUpgrade', path: 'version' }]
        }
      };
      const child: BaseConfig = {
        stopRules: {
          'apps/*.yaml': [{ type: 'semverDowngrade', path: 'version' }],
          'svc/*.yaml': [{ type: 'numeric', path: 'replicas', min: 1, max: 10 }]
        }
      };

      const result = mergeConfigs(parent, child);

      expect(result.stopRules).toEqual({
        'apps/*.yaml': [
          { type: 'semverMajorUpgrade', path: 'version' },
          { type: 'semverDowngrade', path: 'version' }
        ],
        'svc/*.yaml': [{ type: 'numeric', path: 'replicas', min: 1, max: 10 }]
      });
    });

    it('should remove extends field from merged result', () => {
      const parent: BaseConfig = {
        extends: './grandparent.yaml',
        source: './parent-source'
      };
      const child: BaseConfig = {
        extends: './parent.yaml',
        destination: './child-dest'
      };

      const result = mergeConfigs(parent, child);

      expect(result).not.toHaveProperty('extends');
      expect(result.source).toBe('./parent-source');
      expect(result.destination).toBe('./child-dest');
    });

    it('should handle parent with field, child without', () => {
      const parent: BaseConfig = {
        source: './source',
        destination: './dest',
        prune: true
      };
      const child: BaseConfig = {};

      const result = mergeConfigs(parent, child);

      expect(result.source).toBe('./source');
      expect(result.destination).toBe('./dest');
      expect(result.prune).toBe(true);
    });

    it('should handle child with field, parent without', () => {
      const parent: BaseConfig = {};
      const child: BaseConfig = {
        source: './source',
        destination: './dest',
        prune: false
      };

      const result = mergeConfigs(parent, child);

      expect(result.source).toBe('./source');
      expect(result.destination).toBe('./dest');
      expect(result.prune).toBe(false);
    });

    it('should handle both configs empty', () => {
      const parent: BaseConfig = {};
      const child: BaseConfig = {};

      const result = mergeConfigs(parent, child);

      expect(result).toEqual({});
    });

    it('should handle parent with arrays, child without', () => {
      const parent: BaseConfig = {
        include: ['apps/*'],
        exclude: ['**/*.tmp']
      };
      const child: BaseConfig = {};

      const result = mergeConfigs(parent, child);

      expect(result.include).toEqual(['apps/*']);
      expect(result.exclude).toEqual(['**/*.tmp']);
    });

    it('should handle child with arrays, parent without', () => {
      const parent: BaseConfig = {};
      const child: BaseConfig = {
        include: ['svc/*'],
        exclude: ['**/*.bak']
      };

      const result = mergeConfigs(parent, child);

      expect(result.include).toEqual(['svc/*']);
      expect(result.exclude).toEqual(['**/*.bak']);
    });
  });

  describe('resolveConfigWithExtends', () => {
    it('should load config without extends', () => {
      const config: BaseConfig = {
        source: './source',
        destination: './dest'
      };
      vi.mocked(readFileSync).mockReturnValue(YAML.stringify(config));

      const result = resolveConfigWithExtends('/path/to/config.yaml');

      expect(result.source).toBe('./source');
      expect(result.destination).toBe('./dest');
    });

    it('should load config with single extends', () => {
      const baseConfig: BaseConfig = {
        prune: true,
        include: ['apps/*']
      };
      const childConfig: BaseConfig = {
        extends: './base.yaml',
        source: './source',
        destination: './dest'
      };

      vi.mocked(readFileSync)
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce(YAML.stringify(baseConfig));

      const result = resolveConfigWithExtends('/path/to/config.yaml');

      expect(result.source).toBe('./source');
      expect(result.destination).toBe('./dest');
      expect(result.prune).toBe(true);
      expect(result.include).toEqual(['apps/*']);
    });

    it('should load config with chain of extends', () => {
      const grandparentConfig: BaseConfig = {
        prune: true
      };
      const parentConfig: BaseConfig = {
        extends: './grandparent.yaml',
        include: ['apps/*']
      };
      const childConfig: BaseConfig = {
        extends: './parent.yaml',
        source: './source',
        destination: './dest'
      };

      vi.mocked(readFileSync)
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce(YAML.stringify(parentConfig))
        .mockReturnValueOnce(YAML.stringify(parentConfig))
        .mockReturnValueOnce(YAML.stringify(grandparentConfig));

      const result = resolveConfigWithExtends('/path/to/config.yaml');

      expect(result.source).toBe('./source');
      expect(result.destination).toBe('./dest');
      expect(result.prune).toBe(true);
      expect(result.include).toEqual(['apps/*']);
    });

    it('should resolve relative paths correctly', () => {
      const baseConfig: BaseConfig = {
        prune: true
      };
      const childConfig: BaseConfig = {
        extends: '../base/config.yaml',
        source: './source'
      };

      vi.mocked(readFileSync)
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce(YAML.stringify(baseConfig));

      const result = resolveConfigWithExtends('/project/env/config.yaml');

      expect(result.source).toBe('./source');
      expect(result.prune).toBe(true);
    });

    it('should detect circular dependencies', () => {
      const config1: BaseConfig = {
        extends: './config2.yaml'
      };
      const config2: BaseConfig = {
        extends: './config1.yaml'
      };

      vi.mocked(readFileSync)
        .mockReturnValueOnce(YAML.stringify(config1))
        .mockReturnValueOnce(YAML.stringify(config1))
        .mockReturnValueOnce(YAML.stringify(config2))
        .mockReturnValueOnce(YAML.stringify(config2))
        .mockReturnValue(YAML.stringify(config1));

      expect(() => resolveConfigWithExtends('/path/to/config1.yaml')).toThrow(ConfigMergerError);

      try {
        resolveConfigWithExtends('/path/to/config1.yaml');
      } catch (error: unknown) {
        if (isConfigMergerError(error)) {
          expect(error.code).toBe('CIRCULAR_DEPENDENCY');
          expect(error.message).toContain('Circular dependency detected');
        }
      }
    });

    it('should reject chains deeper than 5 levels', () => {
      const configs = Array.from({ length: 7 }).map((_, index) => {
        if (index === 6) return { source: './source', destination: './dest' };
        return { extends: `./config${index + 1}.yaml` };
      });

      let callCount = 0;
      vi.mocked(readFileSync).mockImplementation(() => {
        const index = Math.floor(callCount / 2);
        callCount++;
        return YAML.stringify(configs[index]);
      });

      expect(() => resolveConfigWithExtends('/path/to/config0.yaml')).toThrow(ConfigMergerError);

      try {
        resolveConfigWithExtends('/path/to/config0.yaml');
      } catch (error: unknown) {
        if (isConfigMergerError(error)) {
          expect(error.code).toBe('MAX_DEPTH_EXCEEDED');
          expect(error.message).toContain('Extends chain exceeds maximum depth of 5');
        }
      }
    });

    it('should throw on missing extends file', () => {
      const childConfig: BaseConfig = {
        extends: './missing.yaml',
        source: './source'
      };

      const fileNotFoundError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });

      vi.mocked(readFileSync)
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockImplementationOnce(() => {
          throw fileNotFoundError;
        });

      expect(() => resolveConfigWithExtends('/path/to/config.yaml')).toThrow(ConfigMergerError);

      try {
        resolveConfigWithExtends('/path/to/config.yaml');
      } catch (error: unknown) {
        if (isConfigMergerError(error)) {
          expect(error.code).toBe('INVALID_EXTENDS_PATH');
          expect(error.message).toContain('Extended config file not found');
        }
      }
    });

    it('should throw on invalid YAML in extends', () => {
      const childConfig: BaseConfig = {
        extends: './base.yaml',
        source: './source'
      };

      vi.mocked(readFileSync)
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce('invalid: yaml: content: [');

      expect(() => resolveConfigWithExtends('/path/to/config.yaml')).toThrow(ConfigMergerError);

      try {
        resolveConfigWithExtends('/path/to/config.yaml');
      } catch (error: unknown) {
        if (isConfigMergerError(error)) expect(error.message).toContain('Failed to parse YAML');
      }
    });

    it('should allow base config without source/dest', () => {
      const baseConfig: BaseConfig = {
        prune: true,
        include: ['apps/*']
      };
      const childConfig: BaseConfig = {
        extends: './base.yaml',
        source: './source',
        destination: './dest'
      };

      vi.mocked(readFileSync)
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce(YAML.stringify(baseConfig));

      const result = resolveConfigWithExtends('/path/to/config.yaml');

      expect(result.source).toBe('./source');
      expect(result.destination).toBe('./dest');
      expect(result.prune).toBe(true);
    });

    it('should merge skipPath from multiple levels', () => {
      const baseConfig: BaseConfig = {
        skipPath: {
          'apps/*.yaml': ['spec.secrets']
        }
      };
      const childConfig: BaseConfig = {
        extends: './base.yaml',
        skipPath: {
          'apps/*.yaml': ['spec.env'],
          'svc/*.yaml': ['metadata.labels']
        }
      };

      vi.mocked(readFileSync)
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce(YAML.stringify(childConfig))
        .mockReturnValueOnce(YAML.stringify(baseConfig));

      const result = resolveConfigWithExtends('/path/to/config.yaml');

      expect(result.skipPath).toEqual({
        'apps/*.yaml': ['spec.secrets', 'spec.env'],
        'svc/*.yaml': ['metadata.labels']
      });
    });
  });

  describe('ConfigMergerError', () => {
    it('should be instance of ConfigMergerError', () => {
      const error = new ConfigMergerError('Test error');

      expect(error).toBeInstanceOf(ConfigMergerError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct error name', () => {
      const error = new ConfigMergerError('Test error');

      expect(error.name).toBe('Config Merger Error');
    });

    it('should format circular dependency error correctly', () => {
      const error = new ConfigMergerError('Circular dependency detected', {
        code: 'CIRCULAR_DEPENDENCY',
        path: '/path/to/config.yaml',
        chain: 'base.yaml → env.yaml → base.yaml'
      });

      expect(error.message).toContain('Circular dependency detected');
      expect(error.message).toContain('Path: /path/to/config.yaml');
      expect(error.message).toContain('Chain: base.yaml → env.yaml → base.yaml');
    });

    it('should format max depth error correctly', () => {
      const error = new ConfigMergerError('Extends chain exceeds maximum depth', {
        code: 'MAX_DEPTH_EXCEEDED',
        path: '/path/to/config.yaml',
        depth: 6
      });

      expect(error.message).toContain('Extends chain exceeds maximum depth');
      expect(error.message).toContain('Current depth: 6');
    });

    it('should format invalid extends path error correctly', () => {
      const error = new ConfigMergerError('Extended config file not found', {
        code: 'INVALID_EXTENDS_PATH',
        path: '/path/to/config.yaml',
        extends: './base.yaml',
        resolved: '/path/to/base.yaml'
      });

      expect(error.message).toContain('Extended config file not found');
      expect(error.message).toContain('Extends: ./base.yaml');
      expect(error.message).toContain('Resolved: /path/to/base.yaml');
    });
  });

  describe('isConfigMergerError', () => {
    it('should return true for ConfigMergerError', () => {
      const error = new ConfigMergerError('Test error');

      expect(isConfigMergerError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = new Error('Regular error');

      expect(isConfigMergerError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isConfigMergerError()).toBe(false);
      expect(isConfigMergerError('string')).toBe(false);
      expect(isConfigMergerError(123)).toBe(false);
    });
  });
});
