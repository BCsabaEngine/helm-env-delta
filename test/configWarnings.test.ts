import { describe, expect, it } from 'vitest';

import type { FinalConfig } from '../src/configFile';
import { validateConfigWarnings } from '../src/configWarnings';

const createBaseConfig = (): FinalConfig => ({
  source: './source',
  destination: './destination',
  include: ['**/*.yaml'],
  exclude: [],
  prune: false
});

describe('validateConfigWarnings', () => {
  describe('inefficient glob patterns', () => {
    it('should warn about **/** in include patterns', () => {
      const config = createBaseConfig();
      config.include = ['**/**/*.yaml'];

      const result = validateConfigWarnings(config);

      expect(result.warnings).toContain("Inefficient glob pattern '**/**/*.yaml' detected (use '**/*' instead)");
      expect(result.hasWarnings).toBe(true);
    });

    it('should warn about **/** in exclude patterns', () => {
      const config = createBaseConfig();
      config.exclude = ['**/**/test.yaml'];

      const result = validateConfigWarnings(config);

      expect(result.warnings).toContain("Inefficient glob pattern '**/**/test.yaml' detected (use '**/*' instead)");
      expect(result.hasWarnings).toBe(true);
    });

    it('should not warn about valid glob patterns', () => {
      const config = createBaseConfig();
      config.include = ['**/*.yaml', 'src/**/*.yml'];

      const result = validateConfigWarnings(config);

      expect(result.warnings).not.toContain(expect.stringContaining('Inefficient glob pattern'));
      expect(result.hasWarnings).toBe(false);
    });
  });

  describe('duplicate patterns', () => {
    it('should warn about duplicate include patterns', () => {
      const config = createBaseConfig();
      config.include = ['**/*.yaml', '*.yml', '**/*.yaml'];

      const result = validateConfigWarnings(config);

      expect(result.warnings).toContain('Duplicate patterns found in include array');
      expect(result.hasWarnings).toBe(true);
    });

    it('should warn about duplicate exclude patterns', () => {
      const config = createBaseConfig();
      config.exclude = ['node_modules/**', 'test/**', 'node_modules/**'];

      const result = validateConfigWarnings(config);

      expect(result.warnings).toContain('Duplicate patterns found in exclude array');
      expect(result.hasWarnings).toBe(true);
    });

    it('should not warn when no duplicates exist', () => {
      const config = createBaseConfig();
      config.include = ['**/*.yaml', '*.yml'];
      config.exclude = ['node_modules/**', 'test/**'];

      const result = validateConfigWarnings(config);

      expect(result.warnings).not.toContain(expect.stringContaining('Duplicate patterns'));
      expect(result.hasWarnings).toBe(false);
    });
  });

  describe('conflicting include/exclude patterns', () => {
    it('should warn when pattern appears in both include and exclude', () => {
      const config = createBaseConfig();
      config.include = ['**/*.yaml', 'src/**/*.yml'];
      config.exclude = ['**/*.yaml', 'test/**'];

      const result = validateConfigWarnings(config);

      expect(result.warnings).toContain(
        "Pattern '**/*.yaml' appears in both include and exclude (exclude takes precedence)"
      );
      expect(result.hasWarnings).toBe(true);
    });

    it('should not warn when patterns do not overlap', () => {
      const config = createBaseConfig();
      config.include = ['**/*.yaml'];
      config.exclude = ['test/**'];

      const result = validateConfigWarnings(config);

      expect(result.warnings).not.toContain(expect.stringContaining('appears in both'));
      expect(result.hasWarnings).toBe(false);
    });
  });

  describe('empty skipPath arrays', () => {
    it('should warn about skipPath patterns with empty arrays', () => {
      const config = createBaseConfig();
      config.skipPath = {
        '**/*.yaml': ['$.metadata.labels'],
        'empty.yaml': []
      };

      const result = validateConfigWarnings(config);

      expect(result.warnings).toContain("skipPath pattern 'empty.yaml' has empty array (will have no effect)");
      expect(result.hasWarnings).toBe(true);
    });

    it('should not warn when skipPath is undefined', () => {
      const config = createBaseConfig();
      config.skipPath = undefined;

      const result = validateConfigWarnings(config);

      expect(result.warnings).not.toContain(expect.stringContaining('skipPath'));
      expect(result.hasWarnings).toBe(false);
    });

    it('should not warn when all skipPath patterns have values', () => {
      const config = createBaseConfig();
      config.skipPath = {
        '**/*.yaml': ['$.metadata.labels'],
        'config.yaml': ['$.spec.replicas']
      };

      const result = validateConfigWarnings(config);

      expect(result.warnings).not.toContain(expect.stringContaining('skipPath'));
      expect(result.hasWarnings).toBe(false);
    });
  });

  describe('empty transform arrays', () => {
    it('should warn about transforms with empty content and filename arrays', () => {
      const config = createBaseConfig();
      config.transforms = {
        '**/*.yaml': {
          content: [{ find: 'old', replace: 'new' }],
          filename: []
        },
        'empty.yaml': {
          content: [],
          filename: []
        }
      };

      const result = validateConfigWarnings(config);

      expect(result.warnings).toContain(
        "Transform pattern 'empty.yaml' has empty content and filename arrays (will have no effect)"
      );
      expect(result.hasWarnings).toBe(true);
    });

    it('should not warn when transforms is undefined', () => {
      const config = createBaseConfig();
      config.transforms = undefined;

      const result = validateConfigWarnings(config);

      expect(result.warnings).not.toContain(expect.stringContaining('Transform pattern'));
      expect(result.hasWarnings).toBe(false);
    });

    it('should not warn when content array has values', () => {
      const config = createBaseConfig();
      config.transforms = {
        '**/*.yaml': {
          content: [{ find: 'old', replace: 'new' }],
          filename: []
        }
      };

      const result = validateConfigWarnings(config);

      expect(result.warnings).not.toContain(expect.stringContaining('Transform pattern'));
      expect(result.hasWarnings).toBe(false);
    });

    it('should not warn when filename array has values', () => {
      const config = createBaseConfig();
      config.transforms = {
        '**/*.yaml': {
          content: [],
          filename: [{ find: 'old', replace: 'new' }]
        }
      };

      const result = validateConfigWarnings(config);

      expect(result.warnings).not.toContain(expect.stringContaining('Transform pattern'));
      expect(result.hasWarnings).toBe(false);
    });
  });

  describe('multiple warnings', () => {
    it('should return multiple warnings when multiple issues exist', () => {
      const config = createBaseConfig();
      config.include = ['**/**/*.yaml', '*.yml', '*.yml']; // Inefficient + duplicate
      config.exclude = ['test/**']; // Different pattern
      config.skipPath = {
        empty: []
      };

      const result = validateConfigWarnings(config);

      expect(result.warnings.length).toBeGreaterThanOrEqual(3);
      expect(result.warnings.some((w) => w.includes('Inefficient glob pattern'))).toBe(true);
      expect(result.warnings).toContain('Duplicate patterns found in include array');
      expect(result.warnings.some((w) => w.includes('skipPath'))).toBe(true);
      expect(result.hasWarnings).toBe(true);
    });

    it('should return empty array when config is valid', () => {
      const config = createBaseConfig();
      config.include = ['**/*.yaml'];
      config.exclude = ['test/**'];
      config.skipPath = {
        '**/*.yaml': ['$.metadata']
      };

      const result = validateConfigWarnings(config);

      expect(result.warnings).toEqual([]);
      expect(result.hasWarnings).toBe(false);
    });
  });
});
