import { describe, expect, it } from 'vitest';

import {
  type BaseConfig,
  type FinalConfig,
  type FormatOnlyConfig,
  parseBaseConfig,
  parseConfig,
  parseFinalConfig,
  parseFormatOnlyConfig
} from '../src/configFile';
import { ZodValidationError } from '../src/ZodError';

describe('configFile', () => {
  describe('parseBaseConfig - basic structure', () => {
    it('should parse empty config (all fields optional)', () => {
      const result = parseBaseConfig({});
      expect(result).toEqual({});
    });

    it('should parse config with only source', () => {
      const result = parseBaseConfig({ source: './source' });
      expect(result).toEqual({ source: './source' });
    });

    it('should parse config with only destination', () => {
      const result = parseBaseConfig({ destination: './dest' });
      expect(result).toEqual({ destination: './dest' });
    });

    it('should parse config with extends', () => {
      const result = parseBaseConfig({ extends: './base.yaml' });
      expect(result).toEqual({ extends: './base.yaml' });
    });

    it('should parse config with all fields', () => {
      const config: BaseConfig = {
        extends: './base.yaml',
        source: './source',
        destination: './dest',
        include: ['**/*.yaml'],
        exclude: ['node_modules/**'],
        prune: true,
        skipPath: { '*.yaml': ['version'] },
        outputFormat: { indent: 4, keySeparator: true },
        transforms: { '*.yaml': { content: [{ find: 'test', replace: 'prod' }] } },
        stopRules: {
          'values.yaml': [{ type: 'semverMajorUpgrade', path: 'version' }]
        }
      };

      const result = parseBaseConfig(config);
      expect(result).toEqual(config);
    });
  });

  describe('parseBaseConfig - validation errors', () => {
    it('should throw for invalid type on source', () => {
      expect(() => parseBaseConfig({ source: 123 })).toThrow(ZodValidationError);
    });

    it('should throw for empty string source', () => {
      expect(() => parseBaseConfig({ source: '' })).toThrow(ZodValidationError);
    });

    it('should throw for invalid include pattern', () => {
      expect(() => parseBaseConfig({ include: ['valid', ''] })).toThrow(ZodValidationError);
    });

    it('should throw for invalid prune type', () => {
      expect(() => parseBaseConfig({ prune: 'yes' })).toThrow(ZodValidationError);
    });
  });

  describe('parseFinalConfig - required fields', () => {
    it('should require source field', () => {
      const config = { destination: './dest' };
      expect(() => parseFinalConfig(config)).toThrow(ZodValidationError);
      expect(() => parseFinalConfig(config)).toThrow('source');
    });

    it('should require destination field', () => {
      const config = { source: './source' };
      expect(() => parseFinalConfig(config)).toThrow(ZodValidationError);
      expect(() => parseFinalConfig(config)).toThrow('destination');
    });

    it('should add hint for missing source or destination', () => {
      try {
        parseFinalConfig({});
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ZodValidationError);
        expect((error as Error).message).toContain('Hint');
        expect((error as Error).message).toContain('Base configs can omit');
      }
    });

    it('should parse minimal valid config', () => {
      const config = { source: './source', destination: './dest' };
      const result = parseFinalConfig(config);

      expect(result.source).toBe('./source');
      expect(result.destination).toBe('./dest');
    });
  });

  describe('parseFinalConfig - defaults', () => {
    it('should apply default include pattern', () => {
      const config = { source: './source', destination: './dest' };
      const result = parseFinalConfig(config);

      expect(result.include).toEqual(['**/*']);
    });

    it('should apply default exclude pattern', () => {
      const config = { source: './source', destination: './dest' };
      const result = parseFinalConfig(config);

      expect(result.exclude).toEqual([]);
    });

    it('should apply default prune value', () => {
      const config = { source: './source', destination: './dest' };
      const result = parseFinalConfig(config);

      expect(result.prune).toBe(false);
    });

    it('should apply default outputFormat', () => {
      const config = { source: './source', destination: './dest' };
      const result = parseFinalConfig(config);

      expect(result.outputFormat).toEqual({ indent: 2, keySeparator: false });
    });

    it('should use custom values over defaults', () => {
      const config = {
        source: './source',
        destination: './dest',
        include: ['**/*.yaml'],
        exclude: ['test/**'],
        prune: true
      };
      const result = parseFinalConfig(config);

      expect(result.include).toEqual(['**/*.yaml']);
      expect(result.exclude).toEqual(['test/**']);
      expect(result.prune).toBe(true);
    });
  });

  describe('parseFinalConfig - outputFormat', () => {
    it('should apply default indent', () => {
      const config = { source: './src', destination: './dest' };
      const result = parseFinalConfig(config);

      expect(result.outputFormat.indent).toBe(2);
    });

    it('should validate indent range (min 1)', () => {
      const config = { source: './src', destination: './dest', outputFormat: { indent: 0 } };
      expect(() => parseFinalConfig(config)).toThrow(ZodValidationError);
    });

    it('should validate indent range (max 10)', () => {
      const config = { source: './src', destination: './dest', outputFormat: { indent: 11 } };
      expect(() => parseFinalConfig(config)).toThrow(ZodValidationError);
    });

    it('should accept indent within range', () => {
      const config = { source: './src', destination: './dest', outputFormat: { indent: 4 } };
      const result = parseFinalConfig(config);

      expect(result.outputFormat.indent).toBe(4);
    });

    it('should apply default keySeparator', () => {
      const config = { source: './src', destination: './dest' };
      const result = parseFinalConfig(config);

      expect(result.outputFormat.keySeparator).toBe(false);
    });

    it('should accept custom keySeparator', () => {
      const config = { source: './src', destination: './dest', outputFormat: { keySeparator: true } };
      const result = parseFinalConfig(config);

      expect(result.outputFormat.keySeparator).toBe(true);
    });
  });

  describe('stop rules - semverMajorUpgrade', () => {
    it('should parse valid semverMajorUpgrade rule', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        stopRules: {
          'values.yaml': [{ type: 'semverMajorUpgrade', path: 'version' }]
        }
      };

      const result = parseFinalConfig(config);
      expect(result.stopRules?.['values.yaml'][0]).toEqual({
        type: 'semverMajorUpgrade',
        path: 'version'
      });
    });

    it('should require path for semverMajorUpgrade', () => {
      const config = {
        source: './src',
        destination: './dest',
        stopRules: {
          'values.yaml': [{ type: 'semverMajorUpgrade' }]
        }
      };

      expect(() => parseFinalConfig(config)).toThrow(ZodValidationError);
    });

    it('should reject empty path for semverMajorUpgrade', () => {
      const config = {
        source: './src',
        destination: './dest',
        stopRules: {
          'values.yaml': [{ type: 'semverMajorUpgrade', path: '' }]
        }
      };

      expect(() => parseFinalConfig(config)).toThrow(ZodValidationError);
    });
  });

  describe('stop rules - semverDowngrade', () => {
    it('should parse valid semverDowngrade rule', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        stopRules: {
          'values.yaml': [{ type: 'semverDowngrade', path: 'image.tag' }]
        }
      };

      const result = parseFinalConfig(config);
      expect(result.stopRules?.['values.yaml'][0]).toEqual({
        type: 'semverDowngrade',
        path: 'image.tag'
      });
    });
  });

  describe('stop rules - versionFormat', () => {
    it('should parse versionFormat with default vPrefix', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        stopRules: {
          'values.yaml': [{ type: 'versionFormat', path: 'version' }]
        }
      };

      const result = parseFinalConfig(config);
      const rule = result.stopRules?.['values.yaml'][0];
      expect(rule).toMatchObject({ type: 'versionFormat', path: 'version', vPrefix: 'allowed' });
    });

    it('should parse versionFormat with vPrefix required', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        stopRules: {
          'values.yaml': [{ type: 'versionFormat', path: 'version', vPrefix: 'required' }]
        }
      };

      const result = parseFinalConfig(config);
      const rule = result.stopRules?.['values.yaml'][0];
      expect(rule).toMatchObject({ vPrefix: 'required' });
    });

    it('should parse versionFormat with vPrefix forbidden', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        stopRules: {
          'values.yaml': [{ type: 'versionFormat', path: 'version', vPrefix: 'forbidden' }]
        }
      };

      const result = parseFinalConfig(config);
      const rule = result.stopRules?.['values.yaml'][0];
      expect(rule).toMatchObject({ vPrefix: 'forbidden' });
    });

    it('should reject invalid vPrefix value', () => {
      const config = {
        source: './src',
        destination: './dest',
        stopRules: {
          'values.yaml': [{ type: 'versionFormat', path: 'version', vPrefix: 'invalid' }]
        }
      };

      expect(() => parseFinalConfig(config)).toThrow(ZodValidationError);
    });

    it('should reject extra fields in versionFormat (strict mode)', () => {
      const config = {
        source: './src',
        destination: './dest',
        stopRules: {
          'values.yaml': [{ type: 'versionFormat', path: 'version', extraField: 'value' }]
        }
      };

      expect(() => parseFinalConfig(config)).toThrow(ZodValidationError);
    });
  });

  describe('stop rules - numeric', () => {
    it('should parse numeric rule with min only', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        stopRules: {
          'values.yaml': [{ type: 'numeric', path: 'replicas', min: 1 }]
        }
      };

      const result = parseFinalConfig(config);
      expect(result.stopRules?.['values.yaml'][0]).toMatchObject({ min: 1 });
    });

    it('should parse numeric rule with max only', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        stopRules: {
          'values.yaml': [{ type: 'numeric', path: 'replicas', max: 10 }]
        }
      };

      const result = parseFinalConfig(config);
      expect(result.stopRules?.['values.yaml'][0]).toMatchObject({ max: 10 });
    });

    it('should parse numeric rule with both min and max', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        stopRules: {
          'values.yaml': [{ type: 'numeric', path: 'replicas', min: 1, max: 10 }]
        }
      };

      const result = parseFinalConfig(config);
      expect(result.stopRules?.['values.yaml'][0]).toMatchObject({ min: 1, max: 10 });
    });

    it('should reject when min > max', () => {
      const config = {
        source: './src',
        destination: './dest',
        stopRules: {
          'values.yaml': [{ type: 'numeric', path: 'replicas', min: 10, max: 1 }]
        }
      };

      expect(() => parseFinalConfig(config)).toThrow(ZodValidationError);
      expect(() => parseFinalConfig(config)).toThrow('min must be less than or equal to max');
    });

    it('should accept when min equals max', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        stopRules: {
          'values.yaml': [{ type: 'numeric', path: 'replicas', min: 5, max: 5 }]
        }
      };

      const result = parseFinalConfig(config);
      expect(result.stopRules?.['values.yaml'][0]).toMatchObject({ min: 5, max: 5 });
    });
  });

  describe('stop rules - regex', () => {
    it('should parse valid regex rule', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        stopRules: {
          'values.yaml': [{ type: 'regex', path: 'database.url', regex: 'prod-db' }]
        }
      };

      const result = parseFinalConfig(config);
      expect(result.stopRules?.['values.yaml'][0]).toMatchObject({ regex: 'prod-db' });
    });

    it('should reject invalid regex pattern', () => {
      const config = {
        source: './src',
        destination: './dest',
        stopRules: {
          'values.yaml': [{ type: 'regex', path: 'url', regex: '[invalid((' }]
        }
      };

      expect(() => parseFinalConfig(config)).toThrow(ZodValidationError);
      expect(() => parseFinalConfig(config)).toThrow('Invalid regular expression');
    });

    it('should accept complex regex patterns', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        stopRules: {
          'values.yaml': [
            { type: 'regex', path: 'email', regex: String.raw`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$` }
          ]
        }
      };

      const result = parseFinalConfig(config);
      expect(result.stopRules?.['values.yaml'][0]).toBeDefined();
    });
  });

  describe('transforms - content and filename', () => {
    it('should parse transform with content only', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        transforms: {
          '*.yaml': { content: [{ find: 'uat', replace: 'prod' }] }
        }
      };

      const result = parseFinalConfig(config);
      expect(result.transforms?.['*.yaml']).toEqual({
        content: [{ find: 'uat', replace: 'prod' }]
      });
    });

    it('should parse transform with filename only', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        transforms: {
          '*.yaml': { filename: [{ find: '/uat/', replace: '/prod/' }] }
        }
      };

      const result = parseFinalConfig(config);
      expect(result.transforms?.['*.yaml']).toEqual({
        filename: [{ find: '/uat/', replace: '/prod/' }]
      });
    });

    it('should parse transform with both content and filename', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        transforms: {
          '*.yaml': {
            content: [{ find: 'uat-', replace: 'prod-' }],
            filename: [{ find: '/uat/', replace: '/prod/' }]
          }
        }
      };

      const result = parseFinalConfig(config);
      expect(result.transforms?.['*.yaml']).toEqual({
        content: [{ find: 'uat-', replace: 'prod-' }],
        filename: [{ find: '/uat/', replace: '/prod/' }]
      });
    });

    it('should reject transform with neither content nor filename', () => {
      const config = {
        source: './src',
        destination: './dest',
        transforms: {
          '*.yaml': {}
        }
      };

      expect(() => parseFinalConfig(config)).toThrow(ZodValidationError);
      expect(() => parseFinalConfig(config)).toThrow(
        'At least one of content, filename, contentFile, or filenameFile must be specified'
      );
    });

    it('should reject invalid regex in transform find pattern', () => {
      const config = {
        source: './src',
        destination: './dest',
        transforms: {
          '*.yaml': { content: [{ find: '[invalid', replace: 'prod' }] }
        }
      };

      expect(() => parseFinalConfig(config)).toThrow(ZodValidationError);
      expect(() => parseFinalConfig(config)).toThrow('Invalid regular expression');
    });

    it('should reject empty find pattern', () => {
      const config = {
        source: './src',
        destination: './dest',
        transforms: {
          '*.yaml': { content: [{ find: '', replace: 'prod' }] }
        }
      };

      expect(() => parseFinalConfig(config)).toThrow(ZodValidationError);
    });

    it('should allow empty replace string', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        transforms: {
          '*.yaml': { content: [{ find: 'remove-me', replace: '' }] }
        }
      };

      const result = parseFinalConfig(config);
      expect(result.transforms?.['*.yaml'].content?.[0].replace).toBe('');
    });

    it('should parse multiple transform rules', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        transforms: {
          '*.yaml': {
            content: [
              { find: 'uat-', replace: 'prod-' },
              { find: 'test', replace: 'production' }
            ]
          }
        }
      };

      const result = parseFinalConfig(config);
      expect(result.transforms?.['*.yaml'].content).toHaveLength(2);
    });
  });

  describe('arraySort rules', () => {
    it('should parse arraySort with required fields', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        outputFormat: {
          arraySort: {
            '*.yaml': [{ path: 'items', sortBy: 'name' }]
          }
        }
      };

      const result = parseFinalConfig(config);
      const sortRule = result.outputFormat.arraySort?.['*.yaml'][0];
      expect(sortRule).toMatchObject({ path: 'items', sortBy: 'name', order: 'asc' });
    });

    it('should apply default order asc', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        outputFormat: {
          arraySort: {
            '*.yaml': [{ path: 'items', sortBy: 'name' }]
          }
        }
      };

      const result = parseFinalConfig(config);
      expect(result.outputFormat.arraySort?.['*.yaml'][0].order).toBe('asc');
    });

    it('should accept order desc', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        outputFormat: {
          arraySort: {
            '*.yaml': [{ path: 'items', sortBy: 'name', order: 'desc' }]
          }
        }
      };

      const result = parseFinalConfig(config);
      expect(result.outputFormat.arraySort?.['*.yaml'][0].order).toBe('desc');
    });

    it('should reject invalid order value', () => {
      const config = {
        source: './src',
        destination: './dest',
        outputFormat: {
          arraySort: {
            '*.yaml': [{ path: 'items', sortBy: 'name', order: 'invalid' }]
          }
        }
      };

      expect(() => parseFinalConfig(config)).toThrow(ZodValidationError);
    });

    it('should require sortBy field', () => {
      const config = {
        source: './src',
        destination: './dest',
        outputFormat: {
          arraySort: {
            '*.yaml': [{ path: 'items' }]
          }
        }
      };

      expect(() => parseFinalConfig(config)).toThrow(ZodValidationError);
    });
  });

  describe('keySort rules', () => {
    it('should parse valid keySort config', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        outputFormat: {
          keySort: {
            '**/*.yaml': [{ path: 'env.vars' }]
          }
        }
      };

      const result = parseFinalConfig(config);
      expect(result.outputFormat.keySort?.['**/*.yaml'][0]).toEqual({ path: 'env.vars' });
    });

    it('should reject empty path', () => {
      const config = {
        source: './src',
        destination: './dest',
        outputFormat: {
          keySort: {
            '*.yaml': [{ path: '' }]
          }
        }
      };

      expect(() => parseFinalConfig(config)).toThrow(ZodValidationError);
    });

    it('should accept multiple rules per pattern', () => {
      const config: FinalConfig = {
        source: './src',
        destination: './dest',
        outputFormat: {
          keySort: {
            '**/*.yaml': [{ path: 'env.vars' }, { path: 'env.config' }]
          }
        }
      };

      const result = parseFinalConfig(config);
      const rules = result.outputFormat.keySort?.['**/*.yaml'];
      expect(rules).toHaveLength(2);
      expect(rules?.[0]).toEqual({ path: 'env.vars' });
      expect(rules?.[1]).toEqual({ path: 'env.config' });
    });
  });

  describe('parseConfig alias', () => {
    it('should be an alias for parseFinalConfig', () => {
      const config = { source: './src', destination: './dest' };
      const result1 = parseConfig(config);
      const result2 = parseFinalConfig(config);

      expect(result1).toEqual(result2);
    });
  });

  describe('complex configurations', () => {
    it('should parse full production-like config', () => {
      const config: FinalConfig = {
        source: './envs/uat',
        destination: './envs/prod',
        include: ['**/*.yaml', '**/*.yml'],
        exclude: ['**/*.local.yaml', 'temp/**'],
        prune: true,
        skipPath: {
          '*.yaml': ['metadata.creationTimestamp', 'status'],
          'values.yaml': ['secrets']
        },
        outputFormat: {
          indent: 2,
          keySeparator: true,
          quoteValues: {
            '*.yaml': ['name', 'namespace']
          },
          keyOrders: {
            '*.yaml': ['apiVersion', 'kind', 'metadata', 'spec']
          },
          arraySort: {
            '*.yaml': [{ path: 'spec.containers', sortBy: 'name', order: 'asc' }]
          }
        },
        transforms: {
          '**/*.yaml': {
            content: [
              { find: 'uat-cluster', replace: 'prod-cluster' },
              { find: String.raw`uat\.example\.com`, replace: 'prod.example.com' }
            ],
            filename: [{ find: '/uat/', replace: '/prod/' }]
          }
        },
        stopRules: {
          'chart.yaml': [
            { type: 'semverMajorUpgrade', path: 'version' },
            { type: 'versionFormat', path: 'version', vPrefix: 'forbidden' }
          ],
          'values.yaml': [
            { type: 'semverDowngrade', path: 'image.tag' },
            { type: 'numeric', path: 'replicas', min: 2, max: 10 },
            { type: 'regex', path: 'database.url', regex: 'prod-db' }
          ]
        }
      };

      const result = parseFinalConfig(config);
      expect(result.source).toBe('./envs/uat');
      expect(result.destination).toBe('./envs/prod');
      expect(result.prune).toBe(true);
      expect(result.stopRules).toBeDefined();
      expect(result.transforms).toBeDefined();
    });
  });

  describe('parseFinalConfig - source equals destination validation', () => {
    it('should reject when source and destination are the same path', () => {
      const config = {
        source: './same/path',
        destination: './same/path'
      };

      expect(() => parseFinalConfig(config)).toThrow(ZodValidationError);
      expect(() => parseFinalConfig(config)).toThrow('Source and destination folders cannot be the same');
    });

    it('should reject when source and destination resolve to the same path', () => {
      const config = {
        source: './envs/../envs/prod',
        destination: './envs/prod'
      };

      expect(() => parseFinalConfig(config)).toThrow(ZodValidationError);
      expect(() => parseFinalConfig(config)).toThrow('Source and destination folders cannot be the same');
    });

    it('should allow different source and destination paths', () => {
      const config = {
        source: './envs/uat',
        destination: './envs/prod'
      };

      const result = parseFinalConfig(config);
      expect(result.source).toBe('./envs/uat');
      expect(result.destination).toBe('./envs/prod');
    });
  });

  describe('parseFormatOnlyConfig', () => {
    it('should parse config with only destination (no source required)', () => {
      const config = { destination: './dest' };
      const result = parseFormatOnlyConfig(config);

      expect(result.destination).toBe('./dest');
      expect(result.source).toBeUndefined();
    });

    it('should apply default values', () => {
      const config = { destination: './dest' };
      const result = parseFormatOnlyConfig(config);

      expect(result.include).toEqual(['**/*']);
      expect(result.exclude).toEqual([]);
      expect(result.prune).toBe(false);
      expect(result.confirmationDelay).toBe(3000);
      expect(result.outputFormat).toEqual({ indent: 2, keySeparator: false });
    });

    it('should accept source as optional', () => {
      const config = {
        source: './optional/source',
        destination: './dest'
      };
      const result = parseFormatOnlyConfig(config);

      expect(result.source).toBe('./optional/source');
      expect(result.destination).toBe('./dest');
    });

    it('should reject missing destination', () => {
      const config = { source: './src' };

      expect(() => parseFormatOnlyConfig(config)).toThrow(ZodValidationError);
    });

    it('should add hint for missing destination', () => {
      try {
        parseFormatOnlyConfig({});
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ZodValidationError);
        expect((error as Error).message).toContain('Hint');
        expect((error as Error).message).toContain('Format-only mode requires destination');
      }
    });

    it('should parse config with outputFormat', () => {
      const config: FormatOnlyConfig = {
        destination: './dest',
        outputFormat: {
          indent: 4,
          keySeparator: true,
          keyOrders: { '*.yaml': ['apiVersion', 'kind'] }
        }
      };
      const result = parseFormatOnlyConfig(config);

      expect(result.outputFormat.indent).toBe(4);
      expect(result.outputFormat.keySeparator).toBe(true);
      expect(result.outputFormat.keyOrders).toEqual({ '*.yaml': ['apiVersion', 'kind'] });
    });

    it('should include config path in error message', () => {
      try {
        parseFormatOnlyConfig({}, '/path/to/format-only.yaml');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ZodValidationError);
        expect((error as Error).message).toContain('/path/to/format-only.yaml');
      }
    });
  });

  describe('parseBaseConfig - requiredVersion', () => {
    it('should accept valid semver version', () => {
      const result = parseBaseConfig({ requiredVersion: '1.2.3' });
      expect(result.requiredVersion).toBe('1.2.3');
    });

    it('should accept version with v prefix', () => {
      const result = parseBaseConfig({ requiredVersion: 'v1.2.3' });
      expect(result.requiredVersion).toBe('v1.2.3');
    });

    it('should allow undefined (optional)', () => {
      const result = parseBaseConfig({});
      expect(result.requiredVersion).toBeUndefined();
    });

    it('should reject empty string', () => {
      expect(() => parseBaseConfig({ requiredVersion: '' })).toThrow(ZodValidationError);
    });

    it('should reject non-semver string', () => {
      expect(() => parseBaseConfig({ requiredVersion: 'not-semver' })).toThrow(ZodValidationError);
    });

    it('should reject pre-release version', () => {
      expect(() => parseBaseConfig({ requiredVersion: '1.2.3-beta' })).toThrow(ZodValidationError);
    });

    it('should reject incomplete version', () => {
      expect(() => parseBaseConfig({ requiredVersion: '1.2' })).toThrow(ZodValidationError);
    });
  });
});
