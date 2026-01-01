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
  processedDestination?: unknown,
  skipPaths: string[] = []
): ChangedFile => ({
  path,
  sourceContent: JSON.stringify(rawSource),
  destinationContent: JSON.stringify(rawDestination),
  rawParsedSource: rawSource,
  rawParsedDest: rawDestination,
  processedSourceContent: processedSource || rawSource,
  processedDestContent: processedDestination || rawDestination,
  skipPaths
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
        createChangedFile(
          'app.yaml',
          { cluster: 'prod-cluster', region: 'prod-east' },
          { cluster: 'uat-cluster', region: 'uat-east' }
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
      expect(transforms!.some((t) => t.find === 'uat' && t.replace === 'prod')).toBe(true);
    });

    it('should detect semantic environment patterns', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile('app.yaml', { env: 'production', mode: 'production' }, { env: 'staging', mode: 'staging' })
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
          processedDestContent: { replicas: 2 },
          skipPaths: []
        },
        {
          path: 'app2.yaml',
          sourceContent: 'replicas: 10',
          destinationContent: 'replicas: 8',
          rawParsedSource: { replicas: 10 },
          rawParsedDest: { replicas: 8 },
          processedSourceContent: { replicas: 10 },
          processedDestContent: { replicas: 8 },
          skipPaths: []
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
        createChangedFile(
          'app.yaml',
          { cluster: 'prod-cluster', server: 'prod-server' },
          { cluster: 'uat-cluster', server: 'uat-server' }
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
      const uatProductionTransform = transforms?.find((t) => t.find === 'uat' && t.replace === 'prod');
      expect(uatProductionTransform).toBeDefined();
      expect(uatProductionTransform!.confidence).toBeLessThan(0.6);
    });

    it('should boost confidence for semantic keywords', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile('app.yaml', { env: 'production', mode: 'production' }, { env: 'staging', mode: 'staging' })
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
      const semanticTransform = transforms?.find((t) => t.find === 'staging' && t.replace === 'production');
      expect(semanticTransform).toBeDefined();
      expect(semanticTransform!.confidence).toBeGreaterThan(0.3);
    });

    it('should handle nested object differences', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          { config: { database: { host: 'db.prod.com', backup: 'backup.prod.com' } } },
          { config: { database: { host: 'db.uat.com', backup: 'backup.uat.com' } } }
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
          {
            cluster: 'prod-cluster',
            env: 'prod-env',
            region: 'prod-us-east',
            db: 'db.production.com',
            cache: 'cache.production.com'
          },
          {
            cluster: 'uat-cluster',
            env: 'uat-env',
            region: 'uat-us-east',
            db: 'db.staging.com',
            cache: 'cache.staging.com'
          }
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
          processedDestContent: { replicas: 5 },
          skipPaths: []
        },
        {
          path: 'app2.yaml',
          sourceContent: 'replicas: 2',
          destinationContent: 'replicas: 1',
          rawParsedSource: { replicas: 2 },
          rawParsedDest: { replicas: 1 },
          processedSourceContent: { replicas: 2 },
          processedDestContent: { replicas: 1 },
          skipPaths: []
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

    it('should not suggest transforms for skipPath patterns', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          { namespace: 'prod', cluster: 'prod-cluster', region: 'prod-east' },
          { namespace: 'uat', cluster: 'uat-cluster', region: 'uat-east' },
          undefined,
          undefined,
          ['namespace']
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
      expect(transforms?.some((t) => t.find === 'uat' && t.replace === 'prod')).toBe(true);
      expect(transforms?.some((t) => t.examples.some((example) => example.path === 'namespace'))).toBe(false);
    });

    it('should not suggest stop rules for skipPath patterns', () => {
      const changedFiles: ChangedFile[] = [
        {
          path: 'app.yaml',
          sourceContent: 'version: 2.0.0\nreplicas: 5',
          destinationContent: 'version: 1.0.0\nreplicas: 3',
          rawParsedSource: { version: '2.0.0', replicas: 5 },
          rawParsedDest: { version: '1.0.0', replicas: 3 },
          processedSourceContent: { version: '2.0.0', replicas: 5 },
          processedDestContent: { version: '1.0.0', replicas: 3 },
          skipPaths: ['replicas']
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
      expect(stopRules?.some((r) => r.rule.path === 'version')).toBe(true);
      expect(stopRules?.some((r) => r.rule.path === 'replicas')).toBe(false);
    });

    it('should use wildcards for array element paths', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          {
            env: [
              { name: 'DB_HOST', value: 'prod.db' },
              { name: 'API_URL', value: 'prod.api' }
            ]
          },
          {
            env: [
              { name: 'DB_HOST', value: 'uat.db' },
              { name: 'API_URL', value: 'uat.api' }
            ]
          }
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
      expect(transforms?.some((t) => t.examples.some((example) => example.path === 'env.*.value'))).toBe(true);
      expect(transforms?.some((t) => t.examples.some((example) => example.path.match(/env\.\d+\.value/)))).toBe(false);
    });

    it('should handle skipPath patterns with wildcards', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          { env: [{ name: 'KEY', value: 'prod-val' }] },
          { env: [{ name: 'KEY', value: 'uat-val' }] },
          undefined,
          undefined,
          ['env[*].value']
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
      expect(transforms?.some((t) => t.examples.some((example) => example.path === 'env.*.value'))).toBe(false);
    });

    it('should deduplicate array element suggestions', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile('app.yaml', { items: ['prod-1', 'prod-2', 'prod-3'] }, { items: ['uat-1', 'uat-2', 'uat-3'] })
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
      const itemsTransforms = transforms?.filter((t) => t.examples.some((example) => example.path === 'items.*'));
      expect(itemsTransforms?.length).toBeGreaterThan(0);
      expect(itemsTransforms?.[0]?.occurrences).toBe(3);
    });

    it('should handle nested arrays with wildcards', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          { matrix: [[{ val: 'prod' }, { val: 'prod' }]] },
          { matrix: [[{ val: 'uat' }, { val: 'uat' }]] }
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
      expect(transforms?.some((t) => t.examples.some((example) => example.path === 'matrix.*.*.val'))).toBe(true);
    });

    it('should match array elements by name field instead of index', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          {
            env: [
              { name: 'VAR_A', value: 'prod_value_a' },
              { name: 'VAR_B', value: 'prod_value_b' },
              { name: 'VAR_D', value: 'prod_value_d' }
            ]
          },
          {
            env: [
              { name: 'VAR_B', value: 'uat_value_b' },
              { name: 'VAR_C', value: 'uat_value_c' },
              { name: 'VAR_D', value: 'uat_value_d' }
            ]
          }
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
      // Should suggest: uat → prod (semantic keywords, 2 occurrences: VAR_B and VAR_D matched by name)
      const uatToProduction = transforms?.find((t) => t.find === 'uat' && t.replace === 'prod');
      expect(uatToProduction).toBeDefined();
      expect(uatToProduction?.occurrences).toBe(2);
      // Verify it's matching by key field, not by index
      expect(uatToProduction?.examples.some((example) => example.path === 'env.*.value')).toBe(true);
    });

    it('should handle reordered arrays with key fields', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          {
            env: [
              { name: 'VAR_B', value: 'production_b' },
              { name: 'VAR_A', value: 'production_a' }
            ]
          },
          {
            env: [
              { name: 'VAR_A', value: 'staging_a' },
              { name: 'VAR_B', value: 'staging_b' }
            ]
          }
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
      // Should suggest: staging → production (semantic pattern)
      expect(transforms?.some((t) => t.find === 'staging' && t.replace === 'production')).toBe(true);
      // Verify suggestions use wildcard paths
      const stagingToProductionTransform = transforms?.find((t) => t.find === 'staging' && t.replace === 'production');
      expect(stagingToProductionTransform?.examples.some((example) => example.path === 'env.*.value')).toBe(true);
      // Should have 2 occurrences (VAR_A and VAR_B)
      expect(stagingToProductionTransform?.occurrences).toBe(2);
    });

    it('should use index-based comparison for primitive arrays', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile('app.yaml', { items: ['prod-1', 'prod-2', 'prod-3'] }, { items: ['uat-1', 'uat-2', 'uat-3'] })
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
      // Should still work with existing index-based logic
      expect(transforms?.some((t) => t.find === 'uat' && t.replace === 'prod')).toBe(true);
    });

    it('should fallback to index-based when no key field detected', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          {
            items: [{ value: 'prod_1' }, { value: 'prod_2' }]
          },
          {
            items: [{ value: 'uat_1' }, { value: 'uat_2' }]
          }
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
      // No 'name' or 'id' field, should use index-based and suggest the pattern
      expect(transforms?.some((t) => t.find === 'uat' && t.replace === 'prod')).toBe(true);
    });

    it('should suggest whole value replacements for non-semantic patterns', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          { field1: 'allowed', field2: 'allowed' },
          { field1: 'forbidden', field2: 'forbidden' }
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
      // Should suggest whole value: "forbidden" → "allowed" (entire values, 2 occurrences)
      expect(transforms?.some((t) => t.find === 'forbidden' && t.replace === 'allowed')).toBe(true);
      expect(transforms?.find((t) => t.find === 'forbidden')?.occurrences).toBe(2);
    });

    it('should prefer semantic keywords over whole value patterns', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          {
            url1: 'https://production-service.example.com',
            url2: 'https://production-api.example.com'
          },
          {
            url1: 'https://staging-service.example.com',
            url2: 'https://staging-api.example.com'
          }
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
      // Should suggest semantic pattern: "staging" → "production" (semantic keyword takes priority)
      expect(transforms?.some((t) => t.find === 'staging' && t.replace === 'production')).toBe(true);
      // Should NOT suggest the full URLs because semantic match exists
      expect(transforms?.some((t) => t.find === 'https://staging-service.example.com')).toBe(false);
    });

    it('should skip patterns that occur only once', () => {
      const changedFiles: ChangedFile[] = [
        createChangedFile(
          'app.yaml',
          {
            repeated1: 'production',
            repeated2: 'production',
            single: 'unique_prod_value'
          },
          {
            repeated1: 'staging',
            repeated2: 'staging',
            single: 'unique_stg_value'
          }
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
      // Should suggest "staging" → "production" (occurs 2 times)
      expect(transforms?.some((t) => t.find === 'staging' && t.replace === 'production')).toBe(true);
      const stagingToProduction = transforms?.find((t) => t.find === 'staging' && t.replace === 'production');
      expect(stagingToProduction?.occurrences).toBe(2);

      // Should NOT suggest patterns that only occur once
      expect(transforms?.some((t) => t.find === 'unique_stg_value')).toBe(false);
      expect(transforms?.some((t) => t.find === 'unique_prod_value')).toBe(false);
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

  describe('Confidence threshold', () => {
    it('should filter suggestions below custom threshold', () => {
      const config = createMinimalConfig();
      // Need multiple occurrences for pattern to be suggested
      const changedFile = createChangedFile(
        'app.yaml',
        { cluster: 'prod-cluster', region: 'prod-east' },
        { cluster: 'uat-cluster', region: 'uat-east' }
      );

      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [changedFile],
        unchangedFiles: []
      };

      // With default threshold (0.3), suggestion should be included
      const resultDefault = analyzeDifferencesForSuggestions(diffResult, config, 0.3);
      expect(resultDefault.transforms.get('**/*.yaml')?.length).toBeGreaterThan(0);

      // With high threshold (0.7), suggestion should be filtered
      const resultHigh = analyzeDifferencesForSuggestions(diffResult, config, 0.7);
      expect(resultHigh.transforms.get('**/*.yaml')?.length).toBe(0);
    });

    it('should use default threshold 0.3 when not specified', () => {
      const config = createMinimalConfig();
      const changedFile = createChangedFile(
        'app.yaml',
        { cluster: 'prod-cluster', region: 'prod-east' },
        { cluster: 'uat-cluster', region: 'uat-east' }
      );

      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [changedFile],
        unchangedFiles: []
      };

      // Call without threshold parameter (should use default 0.3)
      const resultDefault = analyzeDifferencesForSuggestions(diffResult, config);
      expect(resultDefault.transforms.get('**/*.yaml')?.length).toBeGreaterThan(0);

      // Should be same as explicitly passing 0.3
      const resultExplicit = analyzeDifferencesForSuggestions(diffResult, config, 0.3);
      expect(resultDefault.transforms.get('**/*.yaml')).toEqual(resultExplicit.transforms.get('**/*.yaml'));
    });

    it('should accept threshold at boundaries (0.0, 1.0)', () => {
      const config = createMinimalConfig();
      const changedFile = createChangedFile(
        'app.yaml',
        { cluster: 'prod-cluster', region: 'prod-east' },
        { cluster: 'uat-cluster', region: 'uat-east' }
      );

      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [changedFile],
        unchangedFiles: []
      };

      // Threshold 0.0 should accept all suggestions
      const resultZero = analyzeDifferencesForSuggestions(diffResult, config, 0);
      expect(resultZero.transforms.get('**/*.yaml')?.length).toBeGreaterThan(0);

      // Threshold 1.0 should filter all suggestions (confidence is always < 1.0)
      const resultOne = analyzeDifferencesForSuggestions(diffResult, config, 1);
      expect(resultOne.transforms.get('**/*.yaml')?.length).toBe(0);
    });
  });

  describe('Enhanced noise filtering', () => {
    it('should filter antonym pairs', () => {
      const config = createMinimalConfig();
      const antonymCases = [
        ['enable', 'disable'],
        ['enabled', 'disabled'],
        ['true', 'false'],
        ['on', 'off'],
        ['yes', 'no'],
        ['active', 'inactive'],
        ['start', 'stop']
      ];

      for (const [oldValue, targetValue] of antonymCases) {
        const changedFile = createChangedFile('app.yaml', { setting: oldValue }, { setting: targetValue });
        const diffResult: FileDiffResult = {
          addedFiles: [],
          deletedFiles: [],
          changedFiles: [changedFile],
          unchangedFiles: []
        };

        const result = analyzeDifferencesForSuggestions(diffResult, config);
        expect(result.transforms.get('**/*.yaml')?.length).toBe(0);
      }
    });

    it('should filter values with regex special chars', () => {
      const config = createMinimalConfig();
      const testCases = [
        ['server.test.com', 'server.other.com'], // dots
        ['config[0]', 'config[1]'], // brackets
        ['app(test)', 'app(prod)'] // parentheses
      ];

      for (const [oldValue, targetValue] of testCases) {
        const changedFile = createChangedFile('app.yaml', { host: oldValue }, { host: targetValue });
        const diffResult: FileDiffResult = {
          addedFiles: [],
          deletedFiles: [],
          changedFiles: [changedFile],
          unchangedFiles: []
        };

        const result = analyzeDifferencesForSuggestions(diffResult, config);
        // Should be filtered unless semantic keywords present
        expect(result.transforms.get('**/*.yaml')?.length).toBe(0);
      }
    });

    it('should allow regex chars with semantic keywords', () => {
      const config = createMinimalConfig();
      // 'db.uat.com' → 'db.prod.com' should pass (has 'uat', 'prod')
      const changedFile = createChangedFile(
        'app.yaml',
        { database: 'db.prod.com', cache: 'cache.prod.io' },
        { database: 'db.uat.com', cache: 'cache.uat.io' }
      );

      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [changedFile],
        unchangedFiles: []
      };

      const result = analyzeDifferencesForSuggestions(diffResult, config);
      expect(result.transforms.get('**/*.yaml')?.length).toBeGreaterThan(0);
      const suggestion = result.transforms.get('**/*.yaml')?.[0];
      expect(suggestion?.find).toBe('uat');
      expect(suggestion?.replace).toBe('prod');
    });

    it('should filter compound values differing only in numbers', () => {
      const config = createMinimalConfig();
      const testCases = [
        ['service-v1', 'service-v2'],
        ['app-10', 'app-20'],
        ['node1', 'node2']
      ];

      for (const [oldValue, targetValue] of testCases) {
        const changedFile = createChangedFile('app.yaml', { name: oldValue }, { name: targetValue });
        const diffResult: FileDiffResult = {
          addedFiles: [],
          deletedFiles: [],
          changedFiles: [changedFile],
          unchangedFiles: []
        };

        const result = analyzeDifferencesForSuggestions(diffResult, config);
        expect(result.transforms.get('**/*.yaml')?.length).toBe(0);
      }
    });

    it('should not filter semantic patterns even with numbers', () => {
      const config = createMinimalConfig();
      // 'uat-v1' → 'prod-v1' should suggest 'uat' → 'prod' (semantic pattern)
      const changedFile = createChangedFile(
        'app.yaml',
        { env: 'prod-v1', cluster: 'prod-v2' },
        { env: 'uat-v1', cluster: 'uat-v2' }
      );

      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [changedFile],
        unchangedFiles: []
      };

      const result = analyzeDifferencesForSuggestions(diffResult, config);
      expect(result.transforms.get('**/*.yaml')?.length).toBeGreaterThan(0);
      const suggestion = result.transforms.get('**/*.yaml')?.[0];
      expect(suggestion?.find).toBe('uat');
      expect(suggestion?.replace).toBe('prod');
    });
  });

  describe('Confidence threshold for stop rules', () => {
    it('should filter stop rule suggestions below threshold', () => {
      const config = createMinimalConfig();
      // Use numeric fields to test numeric stop rules (confidence: 0.5 for single file)
      // Need different replica values in source to establish a range
      const changedFile = createChangedFile(
        'app.yaml',
        {
          services: [
            { name: 'api', replicas: 3 },
            { name: 'worker', replicas: 5 }
          ]
        },
        {
          services: [
            { name: 'api', replicas: 3 },
            { name: 'worker', replicas: 5 }
          ]
        },
        {
          services: [
            { name: 'api', replicas: 3 },
            { name: 'worker', replicas: 5 }
          ]
        },
        {
          services: [
            { name: 'api', replicas: 3 },
            { name: 'worker', replicas: 5 }
          ]
        }
      );

      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [changedFile],
        unchangedFiles: []
      };

      // With default threshold (0.3), numeric stop rules should be suggested (confidence: 0.5 for single file)
      const resultDefault = analyzeDifferencesForSuggestions(diffResult, config, 0.3);
      expect(resultDefault.stopRules.get('**/*.yaml')?.length).toBeGreaterThan(0);

      // With threshold 0.6, should filter out single-file numeric rules (confidence: 0.5)
      const resultHigh = analyzeDifferencesForSuggestions(diffResult, config, 0.6);
      expect(resultHigh.stopRules.get('**/*.yaml')?.length).toBe(0);
    });

    it('should apply threshold consistently to both transforms and stop rules', () => {
      const config = createMinimalConfig();
      const changedFile = createChangedFile(
        'app.yaml',
        {
          cluster: 'prod-cluster',
          region: 'prod-east',
          services: [
            { name: 'api', replicas: 3 },
            { name: 'worker', replicas: 5 }
          ]
        },
        {
          cluster: 'uat-cluster',
          region: 'uat-east',
          services: [
            { name: 'api', replicas: 3 },
            { name: 'worker', replicas: 5 }
          ]
        },
        {
          cluster: 'prod-cluster',
          region: 'prod-east',
          services: [
            { name: 'api', replicas: 3 },
            { name: 'worker', replicas: 5 }
          ]
        },
        {
          cluster: 'uat-cluster',
          region: 'uat-east',
          services: [
            { name: 'api', replicas: 3 },
            { name: 'worker', replicas: 5 }
          ]
        }
      );

      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [changedFile],
        unchangedFiles: []
      };

      // Threshold 0.6 should filter both transforms and stop rules with confidence < 0.6
      const result = analyzeDifferencesForSuggestions(diffResult, config, 0.6);

      // Transforms with confidence 0.5 should be filtered
      expect(result.transforms.get('**/*.yaml')?.length).toBe(0);

      // Numeric stop rules with confidence 0.5 should be filtered
      expect(result.stopRules.get('**/*.yaml')?.length).toBe(0);
    });
  });
});
