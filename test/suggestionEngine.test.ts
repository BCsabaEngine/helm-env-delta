import { describe, expect, it } from 'vitest';

import { Config } from '../src/configFile';
import { ChangedFile, FileDiffResult } from '../src/fileDiff';
import { analyzeDifferencesForSuggestions, formatSuggestionsAsYaml } from '../src/suggestionEngine';

const createMinimalConfig = (): Config => ({
  source: './src',
  destination: './dest',
  include: ['**/*'],
  exclude: [],
  prune: false,
  outputFormat: { indent: 2, keySeparator: false }
});

const createChangedFile = (
  path: string,
  rawSource: unknown,
  rawDestination: unknown,
  processedSource?: unknown,
  processedDestination?: unknown
): ChangedFile => ({
  path,
  sourceContent: JSON.stringify(rawSource),
  destinationContent: JSON.stringify(rawDestination),
  rawParsedSource: rawSource,
  rawParsedDest: rawDestination,
  processedSourceContent: processedSource || rawSource,
  processedDestContent: processedDestination || rawDestination
});

describe('suggestionEngine', () => {
  describe('analyzeDifferencesForSuggestions', () => {
    it('should return empty suggestions for no changes', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: ['file.yaml']
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      expect(result.transforms.size).toBe(0);
      expect(result.stopRules.size).toBe(0);
      expect(result.metadata.changedFiles).toBe(0);
    });

    it('should detect simple transform patterns', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile('app.yaml', { cluster: 'prod-cluster' }, { cluster: 'uat-cluster' })
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const transforms = result.transforms.get('**/*.yaml');
      expect(transforms).toBeDefined();
      expect(transforms!.length).toBeGreaterThan(0);
      expect(transforms!.some((t) => t.find === 'uat' && t.replace === 'prod')).toBe(true);
    });

    it('should detect semantic environment patterns', () => {
      const changedFiles: ChangedFile[] = [createChangedFile('app.yaml', { env: 'production' }, { env: 'staging' })];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const transforms = result.transforms.get('**/*.yaml');
      expect(transforms).toBeDefined();
      expect(transforms!.some((t) => t.find === 'staging' && t.replace === 'production')).toBe(true);
    });

    it('should detect multiple transform patterns in one file', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          { cluster: 'prod-cluster', database: 'db.prod.example.com' },
          { cluster: 'uat-cluster', database: 'db.uat.example.com' }
        )
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const transforms = result.transforms.get('**/*.yaml');
      expect(transforms).toBeDefined();
      expect(transforms!.length).toBeGreaterThan(0);
    });

    it('should detect semver patterns and suggest stop rules', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          { image: { tag: '2.0.0' } },
          { image: { tag: '1.5.0' } },
          { image: { tag: '2.0.0' } },
          { image: { tag: '1.5.0' } }
        )
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const stopRules = result.stopRules.get('**/*.yaml');
      expect(stopRules).toBeDefined();
      expect(stopRules!.some((r) => r.rule.type === 'semverDowngrade')).toBe(true);
      expect(stopRules!.some((r) => r.rule.type === 'semverMajorUpgrade')).toBe(true);
    });

    it('should detect version format patterns', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          { version: '1.2.3' },
          { version: '1.2.2' },
          { version: '1.2.3' },
          { version: '1.2.2' }
        )
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const stopRules = result.stopRules.get('**/*.yaml');
      expect(stopRules).toBeDefined();
      expect(stopRules!.some((r) => r.rule.type === 'versionFormat')).toBe(true);
    });

    it('should detect version format with v-prefix required', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          { version: 'v1.2.3' },
          { version: 'v1.2.2' },
          { version: 'v1.2.3' },
          { version: 'v1.2.2' }
        )
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const stopRules = result.stopRules.get('**/*.yaml');
      const versionFormatRule = stopRules?.find((r) => r.rule.type === 'versionFormat');
      expect(versionFormatRule).toBeDefined();
      expect(versionFormatRule!.rule.type === 'versionFormat' && versionFormatRule!.rule.vPrefix).toBe('required');
    });

    it('should detect version format with v-prefix forbidden', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          { version: '1.2.3' },
          { version: '1.2.2' },
          { version: '1.2.3' },
          { version: '1.2.2' }
        )
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const stopRules = result.stopRules.get('**/*.yaml');
      const versionFormatRule = stopRules?.find((r) => r.rule.type === 'versionFormat');
      expect(versionFormatRule).toBeDefined();
      expect(versionFormatRule!.rule.type === 'versionFormat' && versionFormatRule!.rule.vPrefix).toBe('forbidden');
    });

    it('should detect numeric constraints for replicas field', () => {
      const changedFiles: ChangedFile[] = [
        {
          path: 'app1.yaml',
          sourceContent: 'replicas: 5',
          destinationContent: 'replicas: 2',
          rawParsedSource: { replicas: 5 },
          rawParsedDest: { replicas: 2 },
          processedSourceContent: { replicas: 5 },
          processedDestContent: { replicas: 2 }
        },
        {
          path: 'app2.yaml',
          sourceContent: 'replicas: 10',
          destinationContent: 'replicas: 8',
          rawParsedSource: { replicas: 10 },
          rawParsedDest: { replicas: 8 },
          processedSourceContent: { replicas: 10 },
          processedDestContent: { replicas: 8 }
        }
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const stopRules = result.stopRules.get('**/*.yaml');
      expect(stopRules).toBeDefined();
      expect(stopRules!.some((r) => r.rule.type === 'numeric')).toBe(true);
    });

    it('should not suggest numeric rules for non-constraint fields', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          { randomNumber: 5 },
          { randomNumber: 2 },
          { randomNumber: 5 },
          { randomNumber: 2 }
        )
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const stopRules = result.stopRules.get('**/*.yaml');
      expect(stopRules?.some((r) => r.rule.type === 'numeric')).toBe(false);
    });

    it('should skip patterns already in config', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile('app.yaml', { cluster: 'prod-cluster' }, { cluster: 'uat-cluster' })
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config: Config = {
        ...createMinimalConfig(),
        transforms: {
          '**/*.yaml': {
            content: [{ find: 'uat', replace: 'prod' }]
          }
        }
      };

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const transforms = result.transforms.get('**/*.yaml');
      expect(transforms?.some((t) => t.find === 'uat' && t.replace === 'prod')).toBe(false);
    });

    it('should skip stop rules already in config', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          { image: { tag: '2.0.0' } },
          { image: { tag: '1.5.0' } },
          { image: { tag: '2.0.0' } },
          { image: { tag: '1.5.0' } }
        )
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config: Config = {
        ...createMinimalConfig(),
        stopRules: {
          '**/*.yaml': [{ type: 'semverDowngrade', path: 'image.tag' }]
        }
      };

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const stopRules = result.stopRules.get('**/*.yaml');
      expect(stopRules?.some((r) => r.rule.type === 'semverDowngrade' && r.rule.path === 'image.tag')).toBe(false);
    });

    it('should filter noise - UUIDs', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          { id: '550e8400-e29b-41d4-a716-446655440000' },
          { id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' }
        )
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const transforms = result.transforms.get('**/*.yaml');
      expect(transforms).toEqual([]);
    });

    it('should filter noise - ISO timestamps', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile('app.yaml', { timestamp: '2024-01-15T10:30:00Z' }, { timestamp: '2024-01-14T09:20:00Z' })
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const transforms = result.transforms.get('**/*.yaml');
      expect(transforms).toEqual([]);
    });

    it('should filter noise - very long strings', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile('app.yaml', { token: 'a'.repeat(150) }, { token: 'b'.repeat(150) })
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const transforms = result.transforms.get('**/*.yaml');
      expect(transforms).toEqual([]);
    });

    it('should filter noise - single character differences', () => {
      const changedFiles: ChangedFile[] = [createChangedFile('app.yaml', { value: 'test1' }, { value: 'test2' })];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const transforms = result.transforms.get('**/*.yaml');
      expect(transforms).toEqual([]);
    });

    it('should calculate higher confidence for patterns in multiple files', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile('app1.yaml', { cluster: 'prod-cluster' }, { cluster: 'uat-cluster' }),
        createChangedFile('app2.yaml', { cluster: 'prod-cluster' }, { cluster: 'uat-cluster' }),
        createChangedFile('app3.yaml', { cluster: 'prod-cluster' }, { cluster: 'uat-cluster' })
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const transforms = result.transforms.get('**/*.yaml');
      const uatProductionTransform = transforms?.find((t) => t.find === 'uat' && t.replace === 'prod');
      expect(uatProductionTransform).toBeDefined();
      expect(uatProductionTransform!.confidence).toBeGreaterThan(0.6);
      expect(uatProductionTransform!.affectedFiles).toHaveLength(3);
    });

    it('should calculate lower confidence for single file patterns', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile('app.yaml', { cluster: 'prod-cluster' }, { cluster: 'uat-cluster' })
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const transforms = result.transforms.get('**/*.yaml');
      const uatProductionTransform = transforms?.find((t) => t.find === 'uat' && t.replace === 'prod');
      expect(uatProductionTransform).toBeDefined();
      expect(uatProductionTransform!.confidence).toBeLessThan(0.6);
    });

    it('should boost confidence for semantic keywords', () => {
      const changedFiles: ChangedFile[] = [createChangedFile('app.yaml', { env: 'production' }, { env: 'staging' })];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const transforms = result.transforms.get('**/*.yaml');
      const semanticTransform = transforms?.find((t) => t.find === 'staging' && t.replace === 'production');
      expect(semanticTransform).toBeDefined();
      expect(semanticTransform!.confidence).toBeGreaterThan(0.3);
    });

    it('should handle nested object differences', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          { config: { database: { host: 'db.prod.com' } } },
          { config: { database: { host: 'db.uat.com' } } }
        )
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const transforms = result.transforms.get('**/*.yaml');
      expect(transforms).toBeDefined();
      expect(transforms!.length).toBeGreaterThan(0);
    });

    it('should handle array values', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile('app.yaml', { hosts: ['prod-1.com', 'prod-2.com'] }, { hosts: ['uat-1.com', 'uat-2.com'] })
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const transforms = result.transforms.get('**/*.yaml');
      expect(transforms).toBeDefined();
      expect(transforms!.some((t) => t.find === 'uat' && t.replace === 'prod')).toBe(true);
    });

    it('should ignore non-string value differences', () => {
      const changedFiles: ChangedFile[] = [createChangedFile('app.yaml', { enabled: true }, { enabled: false })];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const transforms = result.transforms.get('**/*.yaml');
      expect(transforms).toEqual([]);
    });

    it('should include metadata in results', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile('app.yaml', { cluster: 'prod-cluster' }, { cluster: 'uat-cluster' })
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      expect(result.metadata.filesAnalyzed).toBe(1);
      expect(result.metadata.changedFiles).toBe(1);
      expect(result.metadata.timestamp).toBeDefined();
    });

    it('should handle multiple patterns in same file', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          { cluster: 'prod-cluster', env: 'production', region: 'prod-us-east' },
          { cluster: 'uat-cluster', env: 'staging', region: 'uat-us-east' }
        )
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const transforms = result.transforms.get('**/*.yaml');
      expect(transforms).toBeDefined();
      expect(transforms!.length).toBeGreaterThan(1);
    });

    it('should calculate numeric min constraint correctly', () => {
      const changedFiles: ChangedFile[] = [
        {
          path: 'app1.yaml',
          sourceContent: 'replicas: 10',
          destinationContent: 'replicas: 5',
          rawParsedSource: { replicas: 10 },
          rawParsedDest: { replicas: 5 },
          processedSourceContent: { replicas: 10 },
          processedDestContent: { replicas: 5 }
        },
        {
          path: 'app2.yaml',
          sourceContent: 'replicas: 2',
          destinationContent: 'replicas: 1',
          rawParsedSource: { replicas: 2 },
          rawParsedDest: { replicas: 1 },
          processedSourceContent: { replicas: 2 },
          processedDestContent: { replicas: 1 }
        }
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const stopRules = result.stopRules.get('**/*.yaml');
      const numericRule = stopRules?.find((r) => r.rule.type === 'numeric');
      expect(numericRule).toBeDefined();
      expect(numericRule!.rule.type === 'numeric' && numericRule!.rule.min).toBeGreaterThan(0);
    });

    it('should not suggest numeric rules when values are the same', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile('app.yaml', { replicas: 5 }, { replicas: 5 }, { replicas: 5 }, { replicas: 5 })
      ];
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles,
        unchangedFiles: []
      };
      const config = createMinimalConfig();

      const result = analyzeDifferencesForSuggestions(diffResult, config);

      const stopRules = result.stopRules.get('**/*.yaml');
      expect(stopRules?.some((r) => r.rule.type === 'numeric')).toBe(false);
    });
  });

  describe('formatSuggestionsAsYaml', () => {
    it('should format empty suggestions', () => {
      const suggestionResult = {
        transforms: new Map(),
        stopRules: new Map(),
        metadata: {
          filesAnalyzed: 0,
          changedFiles: 0,
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      };

      const yaml = formatSuggestionsAsYaml(suggestionResult);

      expect(yaml).toContain('# helm-env-delta Configuration Suggestions');
      expect(yaml).toContain('# No transform suggestions found');
      expect(yaml).toContain('# No stop rule suggestions found');
    });

    it('should format transform suggestions with confidence', () => {
      const suggestionResult = {
        transforms: new Map([
          [
            '**/*.yaml',
            [
              {
                find: 'uat',
                replace: 'prod',
                confidence: 0.85,
                occurrences: 5,
                affectedFiles: ['app.yaml', 'db.yaml'],
                examples: [{ oldValue: 'uat-cluster', targetValue: 'prod-cluster', path: 'cluster.name' }]
              }
            ]
          ]
        ]),
        stopRules: new Map(),
        metadata: {
          filesAnalyzed: 2,
          changedFiles: 2,
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      };

      const yaml = formatSuggestionsAsYaml(suggestionResult);

      expect(yaml).toContain('transforms:');
      expect(yaml).toContain("'**/*.yaml':");
      expect(yaml).toContain('content:');
      expect(yaml).toContain('# Confidence: 85%');
      expect(yaml).toContain('Found in 2 files');
      expect(yaml).toContain('5 occurrence(s)');
      expect(yaml).toContain("find: 'uat'");
      expect(yaml).toContain("replace: 'prod'");
      expect(yaml).toContain('Example:');
    });

    it('should format stop rule suggestions with reasons', () => {
      const suggestionResult = {
        transforms: new Map(),
        stopRules: new Map([
          [
            '**/*.yaml',
            [
              {
                rule: { type: 'semverDowngrade' as const, path: 'image.tag' },
                confidence: 0.95,
                reason: 'Prevents version downgrades',
                affectedPaths: ['image.tag'],
                affectedFiles: ['app.yaml']
              }
            ]
          ]
        ]),
        metadata: {
          filesAnalyzed: 1,
          changedFiles: 1,
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      };

      const yaml = formatSuggestionsAsYaml(suggestionResult);

      expect(yaml).toContain('stopRules:');
      expect(yaml).toContain("'**/*.yaml':");
      expect(yaml).toContain('# Confidence: 95%');
      expect(yaml).toContain('Prevents version downgrades');
      expect(yaml).toContain("type: 'semverDowngrade'");
      expect(yaml).toContain("path: 'image.tag'");
    });

    it('should format versionFormat rules with vPrefix', () => {
      const suggestionResult = {
        transforms: new Map(),
        stopRules: new Map([
          [
            '**/*.yaml',
            [
              {
                rule: { type: 'versionFormat' as const, path: 'version', vPrefix: 'forbidden' as const },
                confidence: 0.95,
                reason: 'Enforces forbidden v-prefix',
                affectedPaths: ['version'],
                affectedFiles: ['app.yaml']
              }
            ]
          ]
        ]),
        metadata: {
          filesAnalyzed: 1,
          changedFiles: 1,
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      };

      const yaml = formatSuggestionsAsYaml(suggestionResult);

      expect(yaml).toContain("type: 'versionFormat'");
      expect(yaml).toContain("vPrefix: 'forbidden'");
    });

    it('should format numeric rules with min/max', () => {
      const suggestionResult = {
        transforms: new Map(),
        stopRules: new Map([
          [
            '**/*.yaml',
            [
              {
                rule: { type: 'numeric' as const, path: 'replicas', min: 1, max: 10 },
                confidence: 0.7,
                reason: 'Prevents unsafe scaling',
                affectedPaths: ['replicas'],
                affectedFiles: ['app.yaml']
              }
            ]
          ]
        ]),
        metadata: {
          filesAnalyzed: 1,
          changedFiles: 1,
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      };

      const yaml = formatSuggestionsAsYaml(suggestionResult);

      expect(yaml).toContain("type: 'numeric'");
      expect(yaml).toContain('min: 1');
      expect(yaml).toContain('max: 10');
    });

    it('should escape single quotes in YAML strings', () => {
      const suggestionResult = {
        transforms: new Map([
          [
            '**/*.yaml',
            [
              {
                find: "it's",
                replace: "it's",
                confidence: 0.5,
                occurrences: 1,
                affectedFiles: ['app.yaml'],
                examples: []
              }
            ]
          ]
        ]),
        stopRules: new Map(),
        metadata: {
          filesAnalyzed: 1,
          changedFiles: 1,
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      };

      const yaml = formatSuggestionsAsYaml(suggestionResult);

      expect(yaml).toContain("find: 'it''s'");
      expect(yaml).toContain("replace: 'it''s'");
    });

    it('should include instructions header', () => {
      const suggestionResult = {
        transforms: new Map(),
        stopRules: new Map(),
        metadata: {
          filesAnalyzed: 0,
          changedFiles: 0,
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      };

      const yaml = formatSuggestionsAsYaml(suggestionResult);

      expect(yaml).toContain('Instructions:');
      expect(yaml).toContain('Review suggestions below');
      expect(yaml).toContain('Copy relevant sections to your config.yaml');
      expect(yaml).toContain('Test with --dry-run before applying');
    });

    it('should include timestamp in header', () => {
      const timestamp = '2024-01-15T10:30:00.000Z';
      const suggestionResult = {
        transforms: new Map(),
        stopRules: new Map(),
        metadata: {
          filesAnalyzed: 0,
          changedFiles: 0,
          timestamp
        }
      };

      const yaml = formatSuggestionsAsYaml(suggestionResult);

      expect(yaml).toContain(`Timestamp: ${timestamp}`);
    });

    it('should format multiple transforms sorted by confidence', () => {
      const suggestionResult = {
        transforms: new Map([
          [
            '**/*.yaml',
            [
              {
                find: 'high',
                replace: 'confidence',
                confidence: 0.95,
                occurrences: 10,
                affectedFiles: ['a.yaml'],
                examples: []
              },
              {
                find: 'low',
                replace: 'confidence',
                confidence: 0.3,
                occurrences: 1,
                affectedFiles: ['b.yaml'],
                examples: []
              }
            ]
          ]
        ]),
        stopRules: new Map(),
        metadata: {
          filesAnalyzed: 2,
          changedFiles: 2,
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      };

      const yaml = formatSuggestionsAsYaml(suggestionResult);

      const highIndex = yaml.indexOf('# Confidence: 95%');
      const lowIndex = yaml.indexOf('# Confidence: 30%');
      expect(highIndex).toBeLessThan(lowIndex);
    });

    it('should use singular "file" for single affected file', () => {
      const suggestionResult = {
        transforms: new Map([
          [
            '**/*.yaml',
            [
              {
                find: 'test',
                replace: 'prod',
                confidence: 0.5,
                occurrences: 1,
                affectedFiles: ['app.yaml'],
                examples: []
              }
            ]
          ]
        ]),
        stopRules: new Map(),
        metadata: {
          filesAnalyzed: 1,
          changedFiles: 1,
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      };

      const yaml = formatSuggestionsAsYaml(suggestionResult);

      expect(yaml).toContain('Found in 1 file');
    });

    it('should use plural "files" for multiple affected files', () => {
      const suggestionResult = {
        transforms: new Map([
          [
            '**/*.yaml',
            [
              {
                find: 'test',
                replace: 'prod',
                confidence: 0.7,
                occurrences: 5,
                affectedFiles: ['app1.yaml', 'app2.yaml'],
                examples: []
              }
            ]
          ]
        ]),
        stopRules: new Map(),
        metadata: {
          filesAnalyzed: 2,
          changedFiles: 2,
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      };

      const yaml = formatSuggestionsAsYaml(suggestionResult);

      expect(yaml).toContain('Found in 2 files');
    });
  });
});
