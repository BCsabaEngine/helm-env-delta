import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Config } from '../../src/config/configFile';
import { AddedFile, ChangedFile, FileDiffResult } from '../../src/pipeline/fileDiff';
import { ValidationResult } from '../../src/pipeline/stopRulesValidator';
import { generateJsonReport, JsonReport } from '../../src/reporters/jsonReporter';

const createMockAddedFile = (path: string): AddedFile => ({
  path,
  content: `name: ${path}`,
  processedContent: `name: ${path}`
});

const createMockConfig = (): Config => ({
  source: './source',
  destination: './dest',
  include: ['**/*'],
  exclude: [],
  prune: false,
  skipPath: [],
  stopRules: []
});

const createMockChangedFile = (
  path: string,
  sourceContent: string,
  destinationContent: string,
  processedSourceContent: unknown,
  processedDestinationContent: unknown
): ChangedFile => ({
  path,
  sourceContent,
  destinationContent,
  processedSourceContent,
  processedDestContent: processedDestinationContent,
  rawParsedSource: processedSourceContent,
  rawParsedDest: processedDestinationContent
});

describe('jsonReporter', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateJsonReport', () => {
    it('should generate valid JSON output', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [createMockAddedFile('file1.yaml')],
        deletedFiles: ['file2.yaml'],
        changedFiles: [],
        unchangedFiles: ['file3.yaml']
      };

      const validationResult: ValidationResult = {
        violations: [],
        isValid: true
      };

      generateJsonReport(diffResult, [], validationResult, createMockConfig(), false, '1.0.0');

      expect(consoleLogSpy).toHaveBeenCalledOnce();
      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed).toHaveProperty('metadata');
      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('files');
      expect(parsed).toHaveProperty('stopRuleViolations');
    });

    it('should include correct metadata fields', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };

      const validationResult: ValidationResult = {
        violations: [],
        isValid: true
      };

      const config = createMockConfig();
      generateJsonReport(diffResult, [], validationResult, config, true, '2.0.0');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed: JsonReport = JSON.parse(output);

      expect(parsed.metadata.source).toBe('./source');
      expect(parsed.metadata.destination).toBe('./dest');
      expect(parsed.metadata.dryRun).toBe(true);
      expect(parsed.metadata.version).toBe('2.0.0');
      expect(parsed.metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include correct summary counts', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [createMockAddedFile('file1.yaml'), createMockAddedFile('file2.yaml')],
        deletedFiles: ['file3.yaml'],
        changedFiles: [
          createMockChangedFile('file4.yaml', 'source1', 'dest1', { key: 'value1' }, { key: 'value2' }),
          createMockChangedFile('file5.yaml', 'source2', 'dest2', { key: 'value3' }, { key: 'value4' }),
          createMockChangedFile('file6.yaml', 'source3', 'dest3', { key: 'value5' }, { key: 'value6' })
        ],
        unchangedFiles: ['file7.yaml', 'file8.yaml', 'file9.yaml', 'file10.yaml']
      };

      const validationResult: ValidationResult = {
        violations: [],
        isValid: true
      };

      generateJsonReport(
        diffResult,
        ['formatted1.yaml', 'formatted2.yaml'],
        validationResult,
        createMockConfig(),
        false,
        '1.0.0'
      );

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed: JsonReport = JSON.parse(output);

      expect(parsed.summary.added).toBe(2);
      expect(parsed.summary.deleted).toBe(1);
      expect(parsed.summary.changed).toBe(3);
      expect(parsed.summary.formatted).toBe(2);
      expect(parsed.summary.unchanged).toBe(4);
    });

    it('should include all file categories in files object', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [createMockAddedFile('new.yaml')],
        deletedFiles: ['removed.yaml'],
        changedFiles: [createMockChangedFile('changed.yaml', 'a', 'b', { x: 1 }, { x: 2 })],
        unchangedFiles: ['same.yaml']
      };

      const validationResult: ValidationResult = {
        violations: [],
        isValid: true
      };

      generateJsonReport(diffResult, ['formatted.yaml'], validationResult, createMockConfig(), false, '1.0.0');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed: JsonReport = JSON.parse(output);

      expect(parsed.files.added).toHaveLength(1);
      expect(parsed.files.added[0].path).toBe('new.yaml');
      expect(parsed.files.added[0].content).toBe('name: new.yaml');
      expect(parsed.files.deleted).toEqual(['removed.yaml']);
      expect(parsed.files.unchanged).toEqual(['same.yaml']);
      expect(parsed.files.formatted).toEqual(['formatted.yaml']);
      expect(parsed.files.changed).toHaveLength(1);
      expect(parsed.files.changed[0].path).toBe('changed.yaml');
    });

    it('should include unified diff for changed files', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          createMockChangedFile(
            'test.yaml',
            'version: 1.0.0',
            'version: 2.0.0',
            { version: '1.0.0' },
            { version: '2.0.0' }
          )
        ],
        unchangedFiles: []
      };

      const validationResult: ValidationResult = {
        violations: [],
        isValid: true
      };

      generateJsonReport(diffResult, [], validationResult, createMockConfig(), false, '1.0.0');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed: JsonReport = JSON.parse(output);

      expect(parsed.files.changed[0].diff).toContain('@@');
      expect(parsed.files.changed[0].diff).toContain('-');
      expect(parsed.files.changed[0].diff).toContain('+');
    });

    it('should detect field-level changes in changed files', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          createMockChangedFile(
            'config.yaml',
            'key: newValue',
            'key: oldValue',
            { key: 'newValue' },
            { key: 'oldValue' }
          )
        ],
        unchangedFiles: []
      };

      const validationResult: ValidationResult = {
        violations: [],
        isValid: true
      };

      generateJsonReport(diffResult, [], validationResult, createMockConfig(), false, '1.0.0');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed: JsonReport = JSON.parse(output);

      expect(parsed.files.changed[0].changes).toHaveLength(1);
      expect(parsed.files.changed[0].changes[0].path).toBe('$.key');
      expect(parsed.files.changed[0].changes[0].oldValue).toBe('oldValue');
      expect(parsed.files.changed[0].changes[0].updatedValue).toBe('newValue');
    });

    it('should detect nested field changes', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          createMockChangedFile(
            'app.yaml',
            'nested',
            'nested',
            { image: { tag: 'v2.0.0' } },
            { image: { tag: 'v1.0.0' } }
          )
        ],
        unchangedFiles: []
      };

      const validationResult: ValidationResult = {
        violations: [],
        isValid: true
      };

      generateJsonReport(diffResult, [], validationResult, createMockConfig(), false, '1.0.0');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed: JsonReport = JSON.parse(output);

      expect(parsed.files.changed[0].changes).toHaveLength(1);
      expect(parsed.files.changed[0].changes[0].path).toBe('$.image.tag');
      expect(parsed.files.changed[0].changes[0].oldValue).toBe('v1.0.0');
      expect(parsed.files.changed[0].changes[0].updatedValue).toBe('v2.0.0');
    });

    it('should detect multiple field changes', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          createMockChangedFile(
            'multi.yaml',
            'content',
            'content',
            { name: 'new', version: '2.0', replicas: 5 },
            { name: 'old', version: '1.0', replicas: 3 }
          )
        ],
        unchangedFiles: []
      };

      const validationResult: ValidationResult = {
        violations: [],
        isValid: true
      };

      generateJsonReport(diffResult, [], validationResult, createMockConfig(), false, '1.0.0');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed: JsonReport = JSON.parse(output);

      expect(parsed.files.changed[0].changes).toHaveLength(3);
      const paths = parsed.files.changed[0].changes.map((c) => c.path);
      expect(paths).toContain('$.name');
      expect(paths).toContain('$.version');
      expect(paths).toContain('$.replicas');
    });

    it('should detect array changes at array level', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          createMockChangedFile('array.yaml', 'content', 'content', { items: [1, 2, 3] }, { items: [1, 2] })
        ],
        unchangedFiles: []
      };

      const validationResult: ValidationResult = {
        violations: [],
        isValid: true
      };

      generateJsonReport(diffResult, [], validationResult, createMockConfig(), false, '1.0.0');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed: JsonReport = JSON.parse(output);

      expect(parsed.files.changed[0].changes).toHaveLength(1);
      expect(parsed.files.changed[0].changes[0].path).toBe('$.items');
      expect(parsed.files.changed[0].changes[0].oldValue).toBe('Array with 2 item(s)');
      expect(parsed.files.changed[0].changes[0].updatedValue).toBe('Array with 3 item(s)');
    });

    it('should detect added fields', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          createMockChangedFile(
            'added.yaml',
            'content',
            'content',
            { name: 'test', addedField: 'value' },
            { name: 'test' }
          )
        ],
        unchangedFiles: []
      };

      const validationResult: ValidationResult = {
        violations: [],
        isValid: true
      };

      generateJsonReport(diffResult, [], validationResult, createMockConfig(), false, '1.0.0');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed: JsonReport = JSON.parse(output);

      const addedFieldChange = parsed.files.changed[0].changes.find((c) => c.path === '$.addedField');
      expect(addedFieldChange).toBeDefined();
      expect(addedFieldChange?.oldValue).toBeUndefined();
      expect(addedFieldChange?.updatedValue).toBe('value');
    });

    it('should detect removed fields', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          createMockChangedFile(
            'removed.yaml',
            'content',
            'content',
            { name: 'test' },
            { name: 'test', oldField: 'value' }
          )
        ],
        unchangedFiles: []
      };

      const validationResult: ValidationResult = {
        violations: [],
        isValid: true
      };

      generateJsonReport(diffResult, [], validationResult, createMockConfig(), false, '1.0.0');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed: JsonReport = JSON.parse(output);

      const removedFieldChange = parsed.files.changed[0].changes.find((c) => c.path === '$.oldField');
      expect(removedFieldChange).toBeDefined();
      expect(removedFieldChange?.oldValue).toBe('value');
      expect(removedFieldChange?.updatedValue).toBeUndefined();
    });

    it('should map stop rule violations correctly', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };

      const validationResult: ValidationResult = {
        violations: [
          {
            file: 'app.yaml',
            rule: {
              type: 'semverMajorUpgrade',
              path: 'version'
            },
            path: 'version',
            oldValue: 'v1.2.3',
            updatedValue: 'v2.0.0',
            message: 'Major version upgrade detected'
          }
        ],
        isValid: false
      };

      generateJsonReport(diffResult, [], validationResult, createMockConfig(), false, '1.0.0');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed: JsonReport = JSON.parse(output);

      expect(parsed.stopRuleViolations).toHaveLength(1);
      expect(parsed.stopRuleViolations[0].file).toBe('app.yaml');
      expect(parsed.stopRuleViolations[0].rule.type).toBe('semverMajorUpgrade');
      expect(parsed.stopRuleViolations[0].rule.path).toBe('version');
      expect(parsed.stopRuleViolations[0].path).toBe('version');
      expect(parsed.stopRuleViolations[0].oldValue).toBe('v1.2.3');
      expect(parsed.stopRuleViolations[0].updatedValue).toBe('v2.0.0');
      expect(parsed.stopRuleViolations[0].message).toBe('Major version upgrade detected');
    });

    it('should handle empty diff result', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };

      const validationResult: ValidationResult = {
        violations: [],
        isValid: true
      };

      generateJsonReport(diffResult, [], validationResult, createMockConfig(), false, '1.0.0');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed: JsonReport = JSON.parse(output);

      expect(parsed.summary.added).toBe(0);
      expect(parsed.summary.deleted).toBe(0);
      expect(parsed.summary.changed).toBe(0);
      expect(parsed.summary.formatted).toBe(0);
      expect(parsed.summary.unchanged).toBe(0);
      expect(parsed.files.added).toEqual([]);
      expect(parsed.files.deleted).toEqual([]);
      expect(parsed.files.changed).toEqual([]);
      expect(parsed.files.formatted).toEqual([]);
      expect(parsed.files.unchanged).toEqual([]);
    });

    it('should handle type changes between primitives', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          createMockChangedFile('type-change.yaml', 'content', 'content', { port: '8080' }, { port: 8080 })
        ],
        unchangedFiles: []
      };

      const validationResult: ValidationResult = {
        violations: [],
        isValid: true
      };

      generateJsonReport(diffResult, [], validationResult, createMockConfig(), false, '1.0.0');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed: JsonReport = JSON.parse(output);

      expect(parsed.files.changed[0].changes).toHaveLength(1);
      expect(parsed.files.changed[0].changes[0].path).toBe('$.port');
      expect(parsed.files.changed[0].changes[0].oldValue).toBe(8080);
      expect(parsed.files.changed[0].changes[0].updatedValue).toBe('8080');
    });

    it('should handle undefined values', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          createMockChangedFile('undefineds.yaml', 'content', 'content', { key: 'value' }, { key: undefined })
        ],
        unchangedFiles: []
      };

      const validationResult: ValidationResult = {
        violations: [],
        isValid: true
      };

      generateJsonReport(diffResult, [], validationResult, createMockConfig(), false, '1.0.0');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed: JsonReport = JSON.parse(output);

      expect(parsed.files.changed[0].changes).toHaveLength(1);
      expect(parsed.files.changed[0].changes[0].oldValue).toBeUndefined();
      expect(parsed.files.changed[0].changes[0].updatedValue).toBe('value');
    });

    it('should not detect changes when values are equal', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          createMockChangedFile('no-change.yaml', 'content', 'content', { key: 'value' }, { key: 'value' })
        ],
        unchangedFiles: []
      };

      const validationResult: ValidationResult = {
        violations: [],
        isValid: true
      };

      generateJsonReport(diffResult, [], validationResult, createMockConfig(), false, '1.0.0');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed: JsonReport = JSON.parse(output);

      expect(parsed.files.changed[0].changes).toEqual([]);
    });

    it('should format JSON with 2-space indentation', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };

      const validationResult: ValidationResult = {
        violations: [],
        isValid: true
      };

      generateJsonReport(diffResult, [], validationResult, createMockConfig(), false, '1.0.0');

      const output = consoleLogSpy.mock.calls[0][0];

      expect(output).toContain('\n  ');
      expect(output).not.toContain('\t');
    });
  });
});
