import { describe, expect, it } from 'vitest';

import type { FinalConfig } from '../src/configFile';
import type { FileMap } from '../src/fileLoader';
import { validatePatternUsage } from '../src/patternUsageValidator';

const createBaseConfig = (): FinalConfig => ({
  source: './source',
  destination: './destination',
  include: ['**/*.yaml'],
  exclude: [],
  prune: false
});

const createFileMap = (entries: Record<string, string>): FileMap => new Map(Object.entries(entries));

describe('patternUsageValidator', () => {
  describe('validateExcludePatterns', () => {
    it('should warn when exclude pattern matches no files', () => {
      const config = createBaseConfig();
      config.exclude = ['nonexistent/**/*.yaml', 'test/**/*.backup'];

      const sourceFiles = createFileMap({
        'app.yaml': 'content: value',
        'config.yaml': 'key: value'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'content: value'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.hasWarnings).toBe(true);
      expect(result.warnings).toContainEqual({
        type: 'unused-exclude',
        pattern: 'nonexistent/**/*.yaml',
        message: "Exclude pattern 'nonexistent/**/*.yaml' matches no files"
      });
      expect(result.warnings).toContainEqual({
        type: 'unused-exclude',
        pattern: 'test/**/*.backup',
        message: "Exclude pattern 'test/**/*.backup' matches no files"
      });
    });

    it('should not warn when exclude pattern matches at least one file', () => {
      const config = createBaseConfig();
      config.exclude = ['test/**/*.yaml'];

      const sourceFiles = createFileMap({
        'app.yaml': 'content: value',
        'test/unit.yaml': 'test: value'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'content: value'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          type: 'unused-exclude'
        })
      );
    });

    it('should handle empty exclude array', () => {
      const config = createBaseConfig();
      config.exclude = [];

      const sourceFiles = createFileMap({
        'app.yaml': 'content: value'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'content: value'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          type: 'unused-exclude'
        })
      );
    });

    it('should check both source and destination files', () => {
      const config = createBaseConfig();
      config.exclude = ['source-only/**/*.yaml', 'dest-only/**/*.yaml'];

      const sourceFiles = createFileMap({
        'source-only/file.yaml': 'content: value'
      });

      const destinationFiles = createFileMap({
        'dest-only/file.yaml': 'content: value'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          type: 'unused-exclude'
        })
      );
    });
  });

  describe('validateSkipPathPatterns', () => {
    it('should warn when skipPath pattern matches no files', () => {
      const config = createBaseConfig();
      config.skipPath = {
        'legacy/**/*.yaml': ['metadata.labels'],
        'old/**/*.yml': ['spec.replicas']
      };

      const sourceFiles = createFileMap({
        'app.yaml': 'content: value'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'content: value'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.hasWarnings).toBe(true);
      expect(result.warnings).toContainEqual({
        type: 'unused-skipPath',
        pattern: 'legacy/**/*.yaml',
        message: "skipPath pattern 'legacy/**/*.yaml' matches no files"
      });
      expect(result.warnings).toContainEqual({
        type: 'unused-skipPath',
        pattern: 'old/**/*.yml',
        message: "skipPath pattern 'old/**/*.yml' matches no files"
      });
    });

    it('should not warn when skipPath pattern matches at least one file', () => {
      const config = createBaseConfig();
      config.skipPath = {
        'app.yaml': ['metadata.labels']
      };

      const sourceFiles = createFileMap({
        'app.yaml': 'content: value'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'content: value'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          type: 'unused-skipPath'
        })
      );
    });

    it('should handle undefined skipPath', () => {
      const config = createBaseConfig();
      config.skipPath = undefined;

      const sourceFiles = createFileMap({
        'app.yaml': 'content: value'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'content: value'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          type: 'unused-skipPath'
        })
      );
    });

    it('should check both source and destination files', () => {
      const config = createBaseConfig();
      config.skipPath = {
        'source.yaml': ['metadata'],
        'dest.yaml': ['spec']
      };

      const sourceFiles = createFileMap({
        'source.yaml': 'content: value'
      });

      const destinationFiles = createFileMap({
        'dest.yaml': 'content: value'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          type: 'unused-skipPath'
        })
      );
    });

    it('should warn when skipPath JSONPath not found in any matched files', () => {
      const config = createBaseConfig();
      config.skipPath = {
        '**/*.yaml': ['metadata.nonexistent', 'spec.missing']
      };

      const sourceFiles = createFileMap({
        'app.yaml': 'version: 1.0.0\nmetadata:\n  name: app'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'version: 1.0.0\nmetadata:\n  name: app'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.hasWarnings).toBe(true);
      expect(result.warnings).toContainEqual({
        type: 'unused-skipPath-jsonpath',
        pattern: '**/*.yaml',
        message: "skipPath JSONPath 'metadata.nonexistent' not found in any matched files",
        context: 'Pattern: **/*.yaml, matches 1 file(s)'
      });
      expect(result.warnings).toContainEqual({
        type: 'unused-skipPath-jsonpath',
        pattern: '**/*.yaml',
        message: "skipPath JSONPath 'spec.missing' not found in any matched files",
        context: 'Pattern: **/*.yaml, matches 1 file(s)'
      });
    });

    it('should not warn when skipPath JSONPath exists in at least one file', () => {
      const config = createBaseConfig();
      config.skipPath = {
        '**/*.yaml': ['metadata.name', 'version']
      };

      const sourceFiles = createFileMap({
        'app.yaml': 'version: 1.0.0\nmetadata:\n  name: app',
        'config.yaml': 'name: test'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'version: 1.0.0'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          type: 'unused-skipPath-jsonpath'
        })
      );
    });

    it('should validate nested JSONPath in skipPath', () => {
      const config = createBaseConfig();
      config.skipPath = {
        '**/*.yaml': ['spec.template.containers[*].image']
      };

      const sourceFiles = createFileMap({
        'app.yaml': 'spec:\n  replicas: 3\n  name: app'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'spec:\n  replicas: 3'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.hasWarnings).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unused-skipPath-jsonpath',
          message: "skipPath JSONPath 'spec.template.containers[*].image' not found in any matched files"
        })
      );
    });
  });

  describe('validateStopRulePatterns', () => {
    it('should warn when stopRule glob matches no files', () => {
      const config = createBaseConfig();
      config.stopRules = {
        'helm-charts/**/*.yaml': [
          { type: 'semverMajorUpgrade', path: 'version' },
          { type: 'semverDowngrade', path: 'version' }
        ]
      };

      const sourceFiles = createFileMap({
        'app.yaml': 'version: 1.0.0'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'version: 1.0.0'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.hasWarnings).toBe(true);
      expect(result.warnings).toContainEqual({
        type: 'unused-stopRule-glob',
        pattern: 'helm-charts/**/*.yaml',
        message: "stopRules glob pattern 'helm-charts/**/*.yaml' matches no files",
        context: '2 rule(s) defined'
      });
    });

    it('should not warn when stopRule glob matches files', () => {
      const config = createBaseConfig();
      config.stopRules = {
        '**/*.yaml': [{ type: 'semverMajorUpgrade', path: 'version' }]
      };

      const sourceFiles = createFileMap({
        'app.yaml': 'version: 1.0.0'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'version: 1.0.0'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          type: 'unused-stopRule-glob'
        })
      );
    });

    it('should warn when stopRule path not found in any matched files', () => {
      const config = createBaseConfig();
      config.stopRules = {
        '**/*.yaml': [{ type: 'semverMajorUpgrade', path: 'spec.replicas' }]
      };

      const sourceFiles = createFileMap({
        'app.yaml': 'version: 1.0.0\nmetadata:\n  name: app'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'version: 1.0.0\nmetadata:\n  name: app'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.hasWarnings).toBe(true);
      expect(result.warnings).toContainEqual({
        type: 'unused-stopRule-path',
        pattern: '**/*.yaml',
        message: "stopRules JSONPath 'spec.replicas' not found in any matched files",
        context: 'Rule type: semverMajorUpgrade, matches 1 file(s)'
      });
    });

    it('should not warn when stopRule path exists in at least one file', () => {
      const config = createBaseConfig();
      config.stopRules = {
        '**/*.yaml': [{ type: 'semverMajorUpgrade', path: 'version' }]
      };

      const sourceFiles = createFileMap({
        'app.yaml': 'version: 1.0.0',
        'config.yaml': 'name: test'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'version: 1.0.0'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          type: 'unused-stopRule-path'
        })
      );
    });

    it('should not validate JSONPath for rules without path field (global mode)', () => {
      const config = createBaseConfig();
      config.stopRules = {
        '**/*.yaml': [{ type: 'regex', regex: '^prod-' }]
      };

      const sourceFiles = createFileMap({
        'app.yaml': 'name: dev-app'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'name: dev-app'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          type: 'unused-stopRule-path'
        })
      );
    });

    it('should skip JSONPath validation for non-YAML files', () => {
      const config = createBaseConfig();
      config.stopRules = {
        '**/*': [{ type: 'semverMajorUpgrade', path: 'version' }]
      };

      const sourceFiles = createFileMap({
        'app.txt': 'version: 1.0.0'
      });

      const destinationFiles = createFileMap({
        'app.txt': 'version: 1.0.0'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      // Should not warn about path since only non-YAML files matched
      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          type: 'unused-stopRule-path'
        })
      );
    });

    it('should handle stopRules with nested path', () => {
      const config = createBaseConfig();
      config.stopRules = {
        '**/*.yaml': [{ type: 'numeric', path: 'spec.replicas', min: 1, max: 10 }]
      };

      const sourceFiles = createFileMap({
        'app.yaml': 'spec:\n  replicas: 3\n  name: app'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'spec:\n  replicas: 3'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          type: 'unused-stopRule-path'
        })
      );
    });

    it('should handle undefined stopRules', () => {
      const config = createBaseConfig();
      config.stopRules = undefined;

      const sourceFiles = createFileMap({
        'app.yaml': 'version: 1.0.0'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'version: 1.0.0'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          type: 'unused-stopRule-glob'
        })
      );
      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          type: 'unused-stopRule-path'
        })
      );
    });

    it('should handle YAML parse errors gracefully', () => {
      const config = createBaseConfig();
      config.stopRules = {
        '**/*.yaml': [{ type: 'semverMajorUpgrade', path: 'version' }]
      };

      const sourceFiles = createFileMap({
        'invalid.yaml': 'this is: [invalid yaml content: {'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'version: 1.0.0'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      // Should not crash. Path is found in app.yaml (destination), so no warning despite invalid.yaml
      expect(result.hasWarnings).toBe(false);
      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          type: 'unused-stopRule-path'
        })
      );
    });

    it('should validate multiple rules per glob pattern', () => {
      const config = createBaseConfig();
      config.stopRules = {
        '**/*.yaml': [
          { type: 'semverMajorUpgrade', path: 'version' },
          { type: 'numeric', path: 'replicas', min: 1 }
        ]
      };

      const sourceFiles = createFileMap({
        'app.yaml': 'version: 1.0.0'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'version: 1.0.0'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      // Version exists, replicas doesn't
      expect(result.hasWarnings).toBe(true);
      expect(result.warnings).toContainEqual({
        type: 'unused-stopRule-path',
        pattern: '**/*.yaml',
        message: "stopRules JSONPath 'replicas' not found in any matched files",
        context: 'Rule type: numeric, matches 1 file(s)'
      });
      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('version')
        })
      );
    });
  });

  describe('validatePatternUsage', () => {
    it('should combine warnings from all validators', () => {
      const config = createBaseConfig();
      config.exclude = ['nonexistent/**/*.yaml'];
      config.skipPath = {
        'legacy/**/*.yaml': ['metadata']
      };
      config.stopRules = {
        'charts/**/*.yaml': [{ type: 'semverMajorUpgrade', path: 'version' }]
      };

      const sourceFiles = createFileMap({
        'app.yaml': 'version: 1.0.0'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'version: 1.0.0'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.hasWarnings).toBe(true);
      expect(result.warnings.length).toBe(3);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unused-exclude'
        })
      );
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unused-skipPath'
        })
      );
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unused-stopRule-glob'
        })
      );
    });

    it('should return no warnings for valid config', () => {
      const config = createBaseConfig();
      config.exclude = ['test/**/*.yaml'];
      config.skipPath = {
        'app.yaml': ['metadata']
      };
      config.stopRules = {
        '**/*.yaml': [{ type: 'semverMajorUpgrade', path: 'version' }]
      };

      const sourceFiles = createFileMap({
        'app.yaml': 'version: 1.0.0\nmetadata:\n  name: app',
        'test/unit.yaml': 'test: value'
      });

      const destinationFiles = createFileMap({
        'app.yaml': 'version: 1.0.0'
      });

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.hasWarnings).toBe(false);
      expect(result.warnings).toEqual([]);
    });

    it('should handle empty file maps', () => {
      const config = createBaseConfig();
      config.exclude = ['**/*.backup'];

      const sourceFiles = createFileMap({});
      const destinationFiles = createFileMap({});

      const result = validatePatternUsage(config, sourceFiles, destinationFiles);

      expect(result.hasWarnings).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unused-exclude'
        })
      );
    });
  });
});
