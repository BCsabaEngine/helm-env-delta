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

      const warnings = validateConfigWarnings(config);

      expect(warnings).toContain("Inefficient glob pattern '**/**/*.yaml' detected (use '**/*' instead)");
    });

    it('should warn about **/** in exclude patterns', () => {
      const config = createBaseConfig();
      config.exclude = ['**/**/test.yaml'];

      const warnings = validateConfigWarnings(config);

      expect(warnings).toContain("Inefficient glob pattern '**/**/test.yaml' detected (use '**/*' instead)");
    });

    it('should not warn about valid glob patterns', () => {
      const config = createBaseConfig();
      config.include = ['**/*.yaml', 'src/**/*.yml'];

      const warnings = validateConfigWarnings(config);

      expect(warnings).not.toContain(expect.stringContaining('Inefficient glob pattern'));
    });
  });

  describe('duplicate patterns', () => {
    it('should warn about duplicate include patterns', () => {
      const config = createBaseConfig();
      config.include = ['**/*.yaml', '*.yml', '**/*.yaml'];

      const warnings = validateConfigWarnings(config);

      expect(warnings).toContain('Duplicate patterns found in include array');
    });

    it('should warn about duplicate exclude patterns', () => {
      const config = createBaseConfig();
      config.exclude = ['node_modules/**', 'test/**', 'node_modules/**'];

      const warnings = validateConfigWarnings(config);

      expect(warnings).toContain('Duplicate patterns found in exclude array');
    });

    it('should not warn when no duplicates exist', () => {
      const config = createBaseConfig();
      config.include = ['**/*.yaml', '*.yml'];
      config.exclude = ['node_modules/**', 'test/**'];

      const warnings = validateConfigWarnings(config);

      expect(warnings).not.toContain(expect.stringContaining('Duplicate patterns'));
    });
  });

  describe('conflicting include/exclude patterns', () => {
    it('should warn when pattern appears in both include and exclude', () => {
      const config = createBaseConfig();
      config.include = ['**/*.yaml', 'src/**/*.yml'];
      config.exclude = ['**/*.yaml', 'test/**'];

      const warnings = validateConfigWarnings(config);

      expect(warnings).toContain("Pattern '**/*.yaml' appears in both include and exclude (exclude takes precedence)");
    });

    it('should not warn when patterns do not overlap', () => {
      const config = createBaseConfig();
      config.include = ['**/*.yaml'];
      config.exclude = ['test/**'];

      const warnings = validateConfigWarnings(config);

      expect(warnings).not.toContain(expect.stringContaining('appears in both'));
    });
  });

  describe('empty skipPath arrays', () => {
    it('should warn about skipPath patterns with empty arrays', () => {
      const config = createBaseConfig();
      config.skipPath = {
        '**/*.yaml': ['$.metadata.labels'],
        'empty.yaml': []
      };

      const warnings = validateConfigWarnings(config);

      expect(warnings).toContain("skipPath pattern 'empty.yaml' has empty array (will have no effect)");
    });

    it('should not warn when skipPath is undefined', () => {
      const config = createBaseConfig();
      config.skipPath = undefined;

      const warnings = validateConfigWarnings(config);

      expect(warnings).not.toContain(expect.stringContaining('skipPath'));
    });

    it('should not warn when all skipPath patterns have values', () => {
      const config = createBaseConfig();
      config.skipPath = {
        '**/*.yaml': ['$.metadata.labels'],
        'config.yaml': ['$.spec.replicas']
      };

      const warnings = validateConfigWarnings(config);

      expect(warnings).not.toContain(expect.stringContaining('skipPath'));
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

      const warnings = validateConfigWarnings(config);

      expect(warnings).toContain(
        "Transform pattern 'empty.yaml' has empty content and filename arrays (will have no effect)"
      );
    });

    it('should not warn when transforms is undefined', () => {
      const config = createBaseConfig();
      config.transforms = undefined;

      const warnings = validateConfigWarnings(config);

      expect(warnings).not.toContain(expect.stringContaining('Transform pattern'));
    });

    it('should not warn when content array has values', () => {
      const config = createBaseConfig();
      config.transforms = {
        '**/*.yaml': {
          content: [{ find: 'old', replace: 'new' }],
          filename: []
        }
      };

      const warnings = validateConfigWarnings(config);

      expect(warnings).not.toContain(expect.stringContaining('Transform pattern'));
    });

    it('should not warn when filename array has values', () => {
      const config = createBaseConfig();
      config.transforms = {
        '**/*.yaml': {
          content: [],
          filename: [{ find: 'old', replace: 'new' }]
        }
      };

      const warnings = validateConfigWarnings(config);

      expect(warnings).not.toContain(expect.stringContaining('Transform pattern'));
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

      const warnings = validateConfigWarnings(config);

      expect(warnings.length).toBeGreaterThanOrEqual(3);
      expect(warnings.some((w) => w.includes('Inefficient glob pattern'))).toBe(true);
      expect(warnings).toContain('Duplicate patterns found in include array');
      expect(warnings.some((w) => w.includes('skipPath'))).toBe(true);
    });

    it('should return empty array when config is valid', () => {
      const config = createBaseConfig();
      config.include = ['**/*.yaml'];
      config.exclude = ['test/**'];
      config.skipPath = {
        '**/*.yaml': ['$.metadata']
      };

      const warnings = validateConfigWarnings(config);

      expect(warnings).toEqual([]);
    });
  });
});
