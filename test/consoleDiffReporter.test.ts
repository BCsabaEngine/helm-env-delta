import type { SpyInstance } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FinalConfig } from '../src/configFile';
import { showConsoleDiff } from '../src/consoleDiffReporter';
import type { ChangedFile, FileDiffResult } from '../src/fileDiff';

const createMockConfig = (overrides?: Partial<FinalConfig>): FinalConfig => ({
  source: './source',
  destination: './dest',
  include: ['**/*'],
  exclude: [],
  prune: false,
  outputFormat: { indent: 2, keySeparator: false },
  ...overrides
});

describe('consoleDiffReporter', () => {
  let consoleLogSpy: SpyInstance;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('showConsoleDiff - summary box', () => {
    it('should display summary box with all counts', () => {
      const diffResult: FileDiffResult = {
        addedFiles: ['file1.yaml', 'file2.yaml'],
        deletedFiles: ['file3.yaml'],
        changedFiles: [],
        unchangedFiles: ['file4.yaml', 'file5.yaml', 'file6.yaml']
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain('Diff Summary');
      expect(output).toContain('Added:');
      expect(output).toContain('2');
      expect(output).toContain('Changed:');
      expect(output).toContain('0');
      expect(output).toContain('Deleted:');
      expect(output).toContain('1');
      expect(output).toContain('Unchanged:');
      expect(output).toContain('3');
    });

    it('should show prune enabled message when prune is true', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: ['file.yaml'],
        changedFiles: [],
        unchangedFiles: []
      };
      const config = createMockConfig({ prune: true });

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain('prune enabled');
    });

    it('should show prune disabled message when prune is false', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: ['file.yaml'],
        changedFiles: [],
        unchangedFiles: []
      };
      const config = createMockConfig({ prune: false });

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain('prune disabled');
    });

    it('should display include patterns', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const config = createMockConfig({ include: ['**/*.yaml', '**/*.yml'] });

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call.join(' ')).join('\n');
      expect(output).toContain('Include patterns:');
      expect(output).toContain('**/*.yaml');
      expect(output).toContain('**/*.yml');
    });

    it('should display exclude patterns when provided', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const config = createMockConfig({ exclude: ['node_modules/**', 'temp/**'] });

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call.join(' ')).join('\n');
      expect(output).toContain('Exclude patterns:');
      expect(output).toContain('node_modules/**');
      expect(output).toContain('temp/**');
    });

    it('should show (none) for empty exclude patterns', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const config = createMockConfig({ exclude: [] });

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call.join(' ')).join('\n');
      expect(output).toContain('Exclude patterns:');
      expect(output).toContain('(none)');
    });
  });

  describe('showConsoleDiff - no differences', () => {
    it('should show success message when no differences', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: ['file1.yaml', 'file2.yaml']
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain('No differences found');
    });

    it('should not show file details when no differences', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).not.toContain('Added Files');
      expect(output).not.toContain('Deleted Files');
      expect(output).not.toContain('Changed Files');
    });
  });

  describe('showConsoleDiff - added files', () => {
    it('should display added files list', () => {
      const diffResult: FileDiffResult = {
        addedFiles: ['new-file1.yaml', 'new-file2.yaml', 'new-file3.txt'],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain('Added Files (3)');
      expect(output).toContain('new-file1.yaml');
      expect(output).toContain('new-file2.yaml');
      expect(output).toContain('new-file3.txt');
    });

    it('should prefix added files with +', () => {
      const diffResult: FileDiffResult = {
        addedFiles: ['new-file.yaml'],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain('+ new-file.yaml');
    });

    it('should not show added files section when empty', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: ['old.yaml'],
        changedFiles: [],
        unchangedFiles: []
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).not.toContain('Added Files');
    });
  });

  describe('showConsoleDiff - deleted files', () => {
    it('should display deleted files list', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: ['old-file1.yaml', 'old-file2.txt'],
        changedFiles: [],
        unchangedFiles: []
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain('Deleted Files (2)');
      expect(output).toContain('old-file1.yaml');
      expect(output).toContain('old-file2.txt');
    });

    it('should prefix deleted files with -', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: ['old-file.yaml'],
        changedFiles: [],
        unchangedFiles: []
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain('- old-file.yaml');
    });

    it('should not show deleted files section when empty', () => {
      const diffResult: FileDiffResult = {
        addedFiles: ['new.yaml'],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).not.toContain('Deleted Files');
    });
  });

  describe('showConsoleDiff - changed files (non-YAML)', () => {
    it('should display changed non-YAML files with unified diff', () => {
      const changedFile: ChangedFile = {
        path: 'file.txt',
        rawParsedSource: 'new content',
        rawParsedDest: 'old content',
        processedSourceContent: 'new content',
        processedDestContent: 'old content'
      };
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [changedFile],
        unchangedFiles: []
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain('Changed Files (1)');
      expect(output).toContain('File: file.txt');
    });

    it('should show skipPath info when no patterns applied', () => {
      const changedFile: ChangedFile = {
        path: 'file.txt',
        rawParsedSource: 'new',
        rawParsedDest: 'old',
        processedSourceContent: 'new',
        processedDestContent: 'old'
      };
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [changedFile],
        unchangedFiles: []
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain('No skipPath patterns applied');
    });

    it('should show skipPath patterns when applied', () => {
      const changedFile: ChangedFile = {
        path: 'file.yaml',
        rawParsedSource: { version: '2.0.0', data: 'test' },
        rawParsedDest: { version: '1.0.0', data: 'test' },
        processedSourceContent: { data: 'test' },
        processedDestContent: { data: 'test' }
      };
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [changedFile],
        unchangedFiles: []
      };
      const config = createMockConfig({ skipPath: { '*.yaml': ['version'] } });

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain('SkipPath patterns applied');
      expect(output).toContain('version');
    });
  });

  describe('showConsoleDiff - changed files (YAML)', () => {
    it('should display changed YAML files', () => {
      const changedFile: ChangedFile = {
        path: 'values.yaml',
        rawParsedSource: { version: '2.0.0' },
        rawParsedDest: { version: '1.0.0' },
        processedSourceContent: { version: '2.0.0' },
        processedDestContent: { version: '1.0.0' }
      };
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [changedFile],
        unchangedFiles: []
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain('Changed Files (1)');
      expect(output).toContain('File: values.yaml');
    });

    it('should display array-specific details for YAML with array changes', () => {
      const changedFile: ChangedFile = {
        path: 'config.yaml',
        rawParsedSource: { items: [{ name: 'a' }, { name: 'b' }] },
        rawParsedDest: { items: [{ name: 'a' }] },
        processedSourceContent: { items: [{ name: 'a' }, { name: 'b' }] },
        processedDestContent: { items: [{ name: 'a' }] }
      };
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [changedFile],
        unchangedFiles: []
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain('Array-specific details');
      expect(output).toContain('items');
    });

    it('should show added items in arrays', () => {
      const changedFile: ChangedFile = {
        path: 'config.yaml',
        rawParsedSource: { items: ['a', 'b', 'c'] },
        rawParsedDest: { items: ['a', 'b'] },
        processedSourceContent: { items: ['a', 'b', 'c'] },
        processedDestContent: { items: ['a', 'b'] }
      };
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [changedFile],
        unchangedFiles: []
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain('Added');
    });

    it('should show removed items in arrays', () => {
      const changedFile: ChangedFile = {
        path: 'config.yaml',
        rawParsedSource: { items: ['a'] },
        rawParsedDest: { items: ['a', 'b'] },
        processedSourceContent: { items: ['a'] },
        processedDestContent: { items: ['a', 'b'] }
      };
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [changedFile],
        unchangedFiles: []
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain('Removed');
    });
  });

  describe('showConsoleDiff - mixed file types', () => {
    it('should handle mix of added, deleted, and changed files', () => {
      const changedFile: ChangedFile = {
        path: 'changed.yaml',
        rawParsedSource: { version: '2.0.0' },
        rawParsedDest: { version: '1.0.0' },
        processedSourceContent: { version: '2.0.0' },
        processedDestContent: { version: '1.0.0' }
      };
      const diffResult: FileDiffResult = {
        addedFiles: ['new.yaml', 'new2.txt'],
        deletedFiles: ['old.yaml'],
        changedFiles: [changedFile],
        unchangedFiles: ['same.yaml']
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain('Added Files (2)');
      expect(output).toContain('Deleted Files (1)');
      expect(output).toContain('Changed Files (1)');
    });
  });

  describe('showConsoleDiff - edge cases', () => {
    it('should handle empty file lists', () => {
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain('No differences found');
    });

    it('should handle files with long paths', () => {
      const longPath = 'very/long/path/to/deeply/nested/directory/structure/file.yaml';
      const diffResult: FileDiffResult = {
        addedFiles: [longPath],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain(longPath);
    });

    it('should handle files with special characters', () => {
      const specialPath = 'file with spaces & symbols (1).yaml';
      const diffResult: FileDiffResult = {
        addedFiles: [specialPath],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain(specialPath);
    });

    it('should handle unicode in file paths', () => {
      const unicodePath = 'файл.yaml'; // Cyrillic characters
      const diffResult: FileDiffResult = {
        addedFiles: [unicodePath],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain(unicodePath);
    });
  });

  describe('showConsoleDiff - multiple changed files', () => {
    it('should display all changed files', () => {
      const changedFile1: ChangedFile = {
        path: 'file1.yaml',
        rawParsedSource: { version: '2.0.0' },
        rawParsedDest: { version: '1.0.0' },
        processedSourceContent: { version: '2.0.0' },
        processedDestContent: { version: '1.0.0' }
      };
      const changedFile2: ChangedFile = {
        path: 'file2.txt',
        rawParsedSource: 'new content',
        rawParsedDest: 'old content',
        processedSourceContent: 'new content',
        processedDestContent: 'old content'
      };
      const diffResult: FileDiffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [changedFile1, changedFile2],
        unchangedFiles: []
      };
      const config = createMockConfig();

      showConsoleDiff(diffResult, config);

      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
      expect(output).toContain('Changed Files (2)');
      expect(output).toContain('File: file1.yaml');
      expect(output).toContain('File: file2.txt');
    });
  });
});
