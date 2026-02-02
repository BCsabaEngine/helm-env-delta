import { describe, expect, it } from 'vitest';

import type { FileDiffResult } from '../../src/fileDiff';
import {
  fileMatchesFilter,
  filterDiffResultByMode,
  filterFileMap,
  filterFileMaps,
  isFilterParseError,
  parseFilterExpression
} from '../../src/utils/fileFilter';

// ============================================================================
// parseFilterExpression Tests
// ============================================================================

describe('parseFilterExpression', () => {
  describe('basic parsing', () => {
    it('should return NONE operator with empty terms for undefined filter', () => {
      const result = parseFilterExpression();

      expect(result.operator).toBe('NONE');
      expect(result.terms).toEqual([]);
    });

    it('should return NONE operator with empty terms for empty string', () => {
      const result = parseFilterExpression('');

      expect(result.operator).toBe('NONE');
      expect(result.terms).toEqual([]);
    });

    it('should return NONE operator with single term for simple filter', () => {
      const result = parseFilterExpression('prod');

      expect(result.operator).toBe('NONE');
      expect(result.terms).toEqual(['prod']);
    });

    it('should convert terms to lowercase', () => {
      const result = parseFilterExpression('PROD');

      expect(result.terms).toEqual(['prod']);
    });

    it('should trim whitespace from terms', () => {
      const result = parseFilterExpression('  prod  ');

      expect(result.terms).toEqual(['prod']);
    });
  });

  describe('OR operator (,)', () => {
    it('should parse OR expression with two terms', () => {
      const result = parseFilterExpression('prod,staging');

      expect(result.operator).toBe('OR');
      expect(result.terms).toEqual(['prod', 'staging']);
    });

    it('should parse OR expression with multiple terms', () => {
      const result = parseFilterExpression('prod,staging,dev');

      expect(result.operator).toBe('OR');
      expect(result.terms).toEqual(['prod', 'staging', 'dev']);
    });

    it('should handle whitespace around terms', () => {
      const result = parseFilterExpression(' prod , staging ');

      expect(result.operator).toBe('OR');
      expect(result.terms).toEqual(['prod', 'staging']);
    });

    it('should filter out empty terms', () => {
      const result = parseFilterExpression('prod,,staging');

      expect(result.operator).toBe('OR');
      expect(result.terms).toEqual(['prod', 'staging']);
    });

    it('should return NONE if only one non-empty term after filtering', () => {
      const result = parseFilterExpression('prod,');

      expect(result.operator).toBe('NONE');
      expect(result.terms).toEqual(['prod']);
    });
  });

  describe('AND operator (+)', () => {
    it('should parse AND expression with two terms', () => {
      const result = parseFilterExpression('values+prod');

      expect(result.operator).toBe('AND');
      expect(result.terms).toEqual(['values', 'prod']);
    });

    it('should parse AND expression with multiple terms', () => {
      const result = parseFilterExpression('values+prod+yaml');

      expect(result.operator).toBe('AND');
      expect(result.terms).toEqual(['values', 'prod', 'yaml']);
    });

    it('should handle whitespace around terms', () => {
      const result = parseFilterExpression(' values + prod ');

      expect(result.operator).toBe('AND');
      expect(result.terms).toEqual(['values', 'prod']);
    });

    it('should filter out empty terms', () => {
      const result = parseFilterExpression('values++prod');

      expect(result.operator).toBe('AND');
      expect(result.terms).toEqual(['values', 'prod']);
    });

    it('should return NONE if only one non-empty term after filtering', () => {
      const result = parseFilterExpression('prod+');

      expect(result.operator).toBe('NONE');
      expect(result.terms).toEqual(['prod']);
    });
  });

  describe('escaped operators', () => {
    it('should treat escaped comma as literal character', () => {
      const result = parseFilterExpression(String.raw`foo\,bar`);

      expect(result.operator).toBe('NONE');
      expect(result.terms).toEqual(['foo,bar']);
    });

    it('should treat escaped plus as literal character', () => {
      const result = parseFilterExpression(String.raw`foo\+bar`);

      expect(result.operator).toBe('NONE');
      expect(result.terms).toEqual(['foo+bar']);
    });

    it('should handle escaped operator with actual operators', () => {
      const result = parseFilterExpression(String.raw`foo\,bar,baz`);

      expect(result.operator).toBe('OR');
      expect(result.terms).toEqual(['foo,bar', 'baz']);
    });

    it('should handle multiple escaped operators', () => {
      const result = parseFilterExpression(String.raw`a\,b\+c`);

      expect(result.operator).toBe('NONE');
      expect(result.terms).toEqual(['a,b+c']);
    });
  });

  describe('mixed operators error', () => {
    it('should throw FilterParseError for mixed AND and OR operators', () => {
      expect(() => parseFilterExpression('a+b,c')).toThrow();
    });

    it('should include MIXED_OPERATORS code in error', () => {
      try {
        parseFilterExpression('a+b,c');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(isFilterParseError(error)).toBe(true);
        if (isFilterParseError(error)) expect(error.code).toBe('MIXED_OPERATORS');
      }
    });

    it('should include hints in error message', () => {
      try {
        parseFilterExpression('prod+staging,dev');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(isFilterParseError(error)).toBe(true);
        if (isFilterParseError(error)) {
          expect(error.hints).toBeDefined();
          expect(error.hints!.length).toBeGreaterThan(0);
        }
      }
    });

    it('should not throw if one operator is escaped', () => {
      expect(() => parseFilterExpression(String.raw`a\+b,c`)).not.toThrow();

      const result = parseFilterExpression(String.raw`a\+b,c`);
      expect(result.operator).toBe('OR');
      expect(result.terms).toEqual(['a+b', 'c']);
    });
  });
});

// ============================================================================
// fileMatchesFilter Tests
// ============================================================================

describe('fileMatchesFilter', () => {
  describe('NONE operator', () => {
    it('should return true for empty terms', () => {
      const result = fileMatchesFilter('file.yaml', 'content', { operator: 'NONE', terms: [] });

      expect(result).toBe(true);
    });

    it('should match by filename', () => {
      const result = fileMatchesFilter('prod-values.yaml', 'some content', { operator: 'NONE', terms: ['prod'] });

      expect(result).toBe(true);
    });

    it('should match by content', () => {
      const result = fileMatchesFilter('file.yaml', 'environment: production', { operator: 'NONE', terms: ['prod'] });

      expect(result).toBe(true);
    });

    it('should be case-insensitive', () => {
      const result = fileMatchesFilter('PROD-values.yaml', 'CONTENT', { operator: 'NONE', terms: ['prod'] });

      expect(result).toBe(true);
    });

    it('should return false if no match', () => {
      const result = fileMatchesFilter('dev-values.yaml', 'development', { operator: 'NONE', terms: ['prod'] });

      expect(result).toBe(false);
    });
  });

  describe('OR operator', () => {
    it('should match if first term matches filename', () => {
      const result = fileMatchesFilter('prod-values.yaml', 'content', { operator: 'OR', terms: ['prod', 'staging'] });

      expect(result).toBe(true);
    });

    it('should match if second term matches filename', () => {
      const result = fileMatchesFilter('staging-values.yaml', 'content', {
        operator: 'OR',
        terms: ['prod', 'staging']
      });

      expect(result).toBe(true);
    });

    it('should match if any term matches content', () => {
      const result = fileMatchesFilter('file.yaml', 'env: production', { operator: 'OR', terms: ['prod', 'staging'] });

      expect(result).toBe(true);
    });

    it('should return false if no terms match', () => {
      const result = fileMatchesFilter('dev-values.yaml', 'development', {
        operator: 'OR',
        terms: ['prod', 'staging']
      });

      expect(result).toBe(false);
    });

    it('should match if term in filename and different term in content', () => {
      const result = fileMatchesFilter('prod-values.yaml', 'staging env', {
        operator: 'OR',
        terms: ['prod', 'staging']
      });

      expect(result).toBe(true);
    });
  });

  describe('AND operator', () => {
    it('should match if all terms match in filename', () => {
      const result = fileMatchesFilter('prod-values.yaml', 'content', { operator: 'AND', terms: ['prod', 'values'] });

      expect(result).toBe(true);
    });

    it('should match if all terms match in content', () => {
      const result = fileMatchesFilter('file.yaml', 'production values here', {
        operator: 'AND',
        terms: ['prod', 'values']
      });

      expect(result).toBe(true);
    });

    it('should match if terms split between filename and content', () => {
      const result = fileMatchesFilter('prod-config.yaml', 'values: true', {
        operator: 'AND',
        terms: ['prod', 'values']
      });

      expect(result).toBe(true);
    });

    it('should return false if only some terms match', () => {
      const result = fileMatchesFilter('prod-config.yaml', 'content', { operator: 'AND', terms: ['prod', 'values'] });

      expect(result).toBe(false);
    });

    it('should return false if no terms match', () => {
      const result = fileMatchesFilter('dev-config.yaml', 'content', { operator: 'AND', terms: ['prod', 'values'] });

      expect(result).toBe(false);
    });

    it('should work with three terms', () => {
      const result = fileMatchesFilter('prod-values.yaml', 'env: staging', {
        operator: 'AND',
        terms: ['prod', 'values', 'staging']
      });

      expect(result).toBe(true);
    });
  });
});

// ============================================================================
// filterFileMap Tests
// ============================================================================

describe('filterFileMap', () => {
  it('should return all files when filter is undefined', () => {
    const fileMap = new Map([
      ['file1.yaml', 'content1'],
      ['file2.yaml', 'content2']
    ]);

    const result = filterFileMap(fileMap);

    expect(result).toBe(fileMap);
    expect(result.size).toBe(2);
  });

  it('should return all files when filter is empty string', () => {
    const fileMap = new Map([
      ['file1.yaml', 'content1'],
      ['file2.yaml', 'content2']
    ]);

    const result = filterFileMap(fileMap, '');

    expect(result).toBe(fileMap);
    expect(result.size).toBe(2);
  });

  it('should match files by filename (case-insensitive)', () => {
    const fileMap = new Map([
      ['prod-values.yaml', 'content1'],
      ['dev-values.yaml', 'content2'],
      ['staging-values.yaml', 'content3']
    ]);

    const result = filterFileMap(fileMap, 'PROD');

    expect(result.size).toBe(1);
    expect(result.has('prod-values.yaml')).toBe(true);
  });

  it('should match files by content (case-insensitive)', () => {
    const fileMap = new Map([
      ['file1.yaml', 'environment: production'],
      ['file2.yaml', 'environment: development'],
      ['file3.yaml', 'environment: staging']
    ]);

    const result = filterFileMap(fileMap, 'PRODUCTION');

    expect(result.size).toBe(1);
    expect(result.has('file1.yaml')).toBe(true);
  });

  it('should match by either filename OR content', () => {
    const fileMap = new Map([
      ['prod-values.yaml', 'some content'],
      ['dev-values.yaml', 'environment: production'],
      ['staging-values.yaml', 'environment: staging']
    ]);

    const result = filterFileMap(fileMap, 'prod');

    expect(result.size).toBe(2);
    expect(result.has('prod-values.yaml')).toBe(true);
    expect(result.has('dev-values.yaml')).toBe(true);
  });

  it('should return empty map when no matches', () => {
    const fileMap = new Map([
      ['file1.yaml', 'content1'],
      ['file2.yaml', 'content2']
    ]);

    const result = filterFileMap(fileMap, 'nonexistent');

    expect(result.size).toBe(0);
  });

  it('should handle empty map', () => {
    const fileMap = new Map<string, string>();

    const result = filterFileMap(fileMap, 'test');

    expect(result.size).toBe(0);
  });

  it('should handle empty content in files', () => {
    const fileMap = new Map([
      ['prod.yaml', ''],
      ['dev.yaml', 'content']
    ]);

    const result = filterFileMap(fileMap, 'prod');

    expect(result.size).toBe(1);
    expect(result.has('prod.yaml')).toBe(true);
  });

  it('should preserve file content in filtered result', () => {
    const fileMap = new Map([
      ['prod-values.yaml', 'original: content'],
      ['dev-values.yaml', 'other: data']
    ]);

    const result = filterFileMap(fileMap, 'prod');

    expect(result.get('prod-values.yaml')).toBe('original: content');
  });

  it('should match partial filename', () => {
    const fileMap = new Map([
      ['my-production-config.yaml', 'content'],
      ['other.yaml', 'data']
    ]);

    const result = filterFileMap(fileMap, 'production');

    expect(result.size).toBe(1);
    expect(result.has('my-production-config.yaml')).toBe(true);
  });

  it('should match partial content', () => {
    const fileMap = new Map([
      ['file1.yaml', 'database_password: secret123'],
      ['file2.yaml', 'other: value']
    ]);

    const result = filterFileMap(fileMap, 'password');

    expect(result.size).toBe(1);
    expect(result.has('file1.yaml')).toBe(true);
  });

  it('should handle filter with spaces', () => {
    const fileMap = new Map([
      ['file1.yaml', 'description: my prod server'],
      ['file2.yaml', 'other: value']
    ]);

    const result = filterFileMap(fileMap, 'prod server');

    expect(result.size).toBe(1);
    expect(result.has('file1.yaml')).toBe(true);
  });

  it('should match files in subdirectories by path', () => {
    const fileMap = new Map([
      ['apps/prod/values.yaml', 'content1'],
      ['apps/dev/values.yaml', 'content2'],
      ['base/common.yaml', 'content3']
    ]);

    const result = filterFileMap(fileMap, 'prod');

    expect(result.size).toBe(1);
    expect(result.has('apps/prod/values.yaml')).toBe(true);
  });

  describe('OR operator', () => {
    it('should match files with OR expression', () => {
      const fileMap = new Map([
        ['prod-values.yaml', 'content'],
        ['staging-values.yaml', 'content'],
        ['dev-values.yaml', 'content']
      ]);

      const result = filterFileMap(fileMap, 'prod,staging');

      expect(result.size).toBe(2);
      expect(result.has('prod-values.yaml')).toBe(true);
      expect(result.has('staging-values.yaml')).toBe(true);
    });

    it('should match by content with OR expression', () => {
      const fileMap = new Map([
        ['file1.yaml', 'env: production'],
        ['file2.yaml', 'env: staging'],
        ['file3.yaml', 'env: development']
      ]);

      const result = filterFileMap(fileMap, 'production,staging');

      expect(result.size).toBe(2);
      expect(result.has('file1.yaml')).toBe(true);
      expect(result.has('file2.yaml')).toBe(true);
    });
  });

  describe('AND operator', () => {
    it('should match files with AND expression', () => {
      const fileMap = new Map([
        ['prod-values.yaml', 'content'],
        ['prod-config.yaml', 'content'],
        ['staging-values.yaml', 'content']
      ]);

      const result = filterFileMap(fileMap, 'prod+values');

      expect(result.size).toBe(1);
      expect(result.has('prod-values.yaml')).toBe(true);
    });

    it('should match by combined filename and content with AND', () => {
      const fileMap = new Map([
        ['prod.yaml', 'env: staging'],
        ['staging.yaml', 'env: production'],
        ['dev.yaml', 'env: development']
      ]);

      const result = filterFileMap(fileMap, 'prod+staging');

      expect(result.size).toBe(2);
      expect(result.has('prod.yaml')).toBe(true);
      expect(result.has('staging.yaml')).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw FilterParseError for mixed operators', () => {
      const fileMap = new Map([['file.yaml', 'content']]);

      expect(() => filterFileMap(fileMap, 'a+b,c')).toThrow();
    });
  });
});

describe('filterFileMaps', () => {
  it('should return both maps unchanged when filter is undefined', () => {
    const sourceFiles = new Map([['file.yaml', 'source content']]);
    const destinationFiles = new Map([['file.yaml', 'dest content']]);

    const result = filterFileMaps(sourceFiles, destinationFiles);

    expect(result.sourceFiles).toBe(sourceFiles);
    expect(result.destinationFiles).toBe(destinationFiles);
  });

  it('should return both maps unchanged when filter is empty string', () => {
    const sourceFiles = new Map([['file.yaml', 'source content']]);
    const destinationFiles = new Map([['file.yaml', 'dest content']]);

    const result = filterFileMaps(sourceFiles, destinationFiles, '');

    expect(result.sourceFiles).toBe(sourceFiles);
    expect(result.destinationFiles).toBe(destinationFiles);
  });

  it('should include file in both maps if it matches in source only', () => {
    const sourceFiles = new Map([['file.yaml', 'contains searchterm']]);
    const destinationFiles = new Map([['file.yaml', 'different content']]);

    const result = filterFileMaps(sourceFiles, destinationFiles, 'searchterm');

    expect(result.sourceFiles.has('file.yaml')).toBe(true);
    expect(result.destinationFiles.has('file.yaml')).toBe(true);
  });

  it('should include file in both maps if it matches in destination only', () => {
    const sourceFiles = new Map([['file.yaml', 'different content']]);
    const destinationFiles = new Map([['file.yaml', 'contains searchterm']]);

    const result = filterFileMaps(sourceFiles, destinationFiles, 'searchterm');

    expect(result.sourceFiles.has('file.yaml')).toBe(true);
    expect(result.destinationFiles.has('file.yaml')).toBe(true);
  });

  it('should not include file if it matches in neither map', () => {
    const sourceFiles = new Map([['file.yaml', 'content A']]);
    const destinationFiles = new Map([['file.yaml', 'content B']]);

    const result = filterFileMaps(sourceFiles, destinationFiles, 'searchterm');

    expect(result.sourceFiles.size).toBe(0);
    expect(result.destinationFiles.size).toBe(0);
  });

  it('should handle file only in source (added file scenario)', () => {
    const sourceFiles = new Map([['new-file.yaml', 'contains searchterm']]);
    const destinationFiles = new Map<string, string>();

    const result = filterFileMaps(sourceFiles, destinationFiles, 'searchterm');

    expect(result.sourceFiles.has('new-file.yaml')).toBe(true);
    expect(result.destinationFiles.size).toBe(0);
  });

  it('should handle file only in destination (deleted file scenario)', () => {
    const sourceFiles = new Map<string, string>();
    const destinationFiles = new Map([['old-file.yaml', 'contains searchterm']]);

    const result = filterFileMaps(sourceFiles, destinationFiles, 'searchterm');

    expect(result.sourceFiles.size).toBe(0);
    expect(result.destinationFiles.has('old-file.yaml')).toBe(true);
  });

  it('should match by filename and include in both maps', () => {
    const sourceFiles = new Map([['prod-values.yaml', 'content A']]);
    const destinationFiles = new Map([['prod-values.yaml', 'content B']]);

    const result = filterFileMaps(sourceFiles, destinationFiles, 'prod');

    expect(result.sourceFiles.has('prod-values.yaml')).toBe(true);
    expect(result.destinationFiles.has('prod-values.yaml')).toBe(true);
  });

  it('should be case-insensitive', () => {
    const sourceFiles = new Map([['file.yaml', 'contains SEARCHTERM']]);
    const destinationFiles = new Map([['file.yaml', 'different content']]);

    const result = filterFileMaps(sourceFiles, destinationFiles, 'searchterm');

    expect(result.sourceFiles.has('file.yaml')).toBe(true);
    expect(result.destinationFiles.has('file.yaml')).toBe(true);
  });

  it('should handle multiple files with mixed matches', () => {
    const sourceFiles = new Map([
      ['file1.yaml', 'contains searchterm'],
      ['file2.yaml', 'no match here'],
      ['file3.yaml', 'also no match']
    ]);
    const destinationFiles = new Map([
      ['file1.yaml', 'different content'],
      ['file2.yaml', 'has searchterm now'],
      ['file3.yaml', 'still no match']
    ]);

    const result = filterFileMaps(sourceFiles, destinationFiles, 'searchterm');

    expect(result.sourceFiles.size).toBe(2);
    expect(result.destinationFiles.size).toBe(2);
    expect(result.sourceFiles.has('file1.yaml')).toBe(true);
    expect(result.sourceFiles.has('file2.yaml')).toBe(true);
    expect(result.destinationFiles.has('file1.yaml')).toBe(true);
    expect(result.destinationFiles.has('file2.yaml')).toBe(true);
  });

  it('should preserve original content in filtered maps', () => {
    const sourceFiles = new Map([['file.yaml', 'source: searchterm']]);
    const destinationFiles = new Map([['file.yaml', 'dest: content']]);

    const result = filterFileMaps(sourceFiles, destinationFiles, 'searchterm');

    expect(result.sourceFiles.get('file.yaml')).toBe('source: searchterm');
    expect(result.destinationFiles.get('file.yaml')).toBe('dest: content');
  });

  describe('OR operator', () => {
    it('should match files with OR expression in either map', () => {
      const sourceFiles = new Map([
        ['prod-values.yaml', 'content A'],
        ['staging-values.yaml', 'content B'],
        ['dev-values.yaml', 'content C']
      ]);
      const destinationFiles = new Map([
        ['prod-values.yaml', 'content D'],
        ['staging-values.yaml', 'content E'],
        ['dev-values.yaml', 'content F']
      ]);

      const result = filterFileMaps(sourceFiles, destinationFiles, 'prod,staging');

      expect(result.sourceFiles.size).toBe(2);
      expect(result.destinationFiles.size).toBe(2);
      expect(result.sourceFiles.has('prod-values.yaml')).toBe(true);
      expect(result.sourceFiles.has('staging-values.yaml')).toBe(true);
    });

    it('should include file in both maps if it matches in only one map with OR', () => {
      const sourceFiles = new Map([['file.yaml', 'has production']]);
      const destinationFiles = new Map([['file.yaml', 'different']]);

      const result = filterFileMaps(sourceFiles, destinationFiles, 'production,staging');

      expect(result.sourceFiles.has('file.yaml')).toBe(true);
      expect(result.destinationFiles.has('file.yaml')).toBe(true);
    });
  });

  describe('AND operator', () => {
    it('should match files with AND expression', () => {
      const sourceFiles = new Map([
        ['prod-values.yaml', 'content'],
        ['prod-config.yaml', 'content'],
        ['staging-values.yaml', 'content']
      ]);
      const destinationFiles = new Map([
        ['prod-values.yaml', 'dest'],
        ['prod-config.yaml', 'dest'],
        ['staging-values.yaml', 'dest']
      ]);

      const result = filterFileMaps(sourceFiles, destinationFiles, 'prod+values');

      expect(result.sourceFiles.size).toBe(1);
      expect(result.destinationFiles.size).toBe(1);
      expect(result.sourceFiles.has('prod-values.yaml')).toBe(true);
    });

    it('should match by combined filename and content with AND across maps', () => {
      const sourceFiles = new Map([['prod.yaml', 'content']]);
      const destinationFiles = new Map([['prod.yaml', 'has staging']]);

      const result = filterFileMaps(sourceFiles, destinationFiles, 'prod+staging');

      expect(result.sourceFiles.has('prod.yaml')).toBe(true);
      expect(result.destinationFiles.has('prod.yaml')).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw FilterParseError for mixed operators', () => {
      const sourceFiles = new Map([['file.yaml', 'content']]);
      const destinationFiles = new Map([['file.yaml', 'content']]);

      expect(() => filterFileMaps(sourceFiles, destinationFiles, 'a+b,c')).toThrow();
    });
  });
});

const createDiffResult = (): FileDiffResult => ({
  addedFiles: [
    { path: 'added1.yaml', content: 'content', processedContent: 'content' },
    { path: 'added2.yaml', content: 'content', processedContent: 'content' }
  ],
  deletedFiles: ['deleted1.yaml', 'deleted2.yaml'],
  changedFiles: [
    {
      path: 'changed1.yaml',
      sourceContent: 'source',
      destinationContent: 'dest',
      processedSourceContent: 'source',
      processedDestContent: 'dest',
      rawParsedSource: 'source',
      rawParsedDest: 'dest',
      skipPaths: []
    }
  ],
  unchangedFiles: ['unchanged1.yaml', 'unchanged2.yaml']
});

describe('filterDiffResultByMode', () => {
  it('should return all changes when mode is all', () => {
    const diffResult = createDiffResult();

    const result = filterDiffResultByMode(diffResult, 'all');

    expect(result).toBe(diffResult);
    expect(result.addedFiles.length).toBe(2);
    expect(result.deletedFiles.length).toBe(2);
    expect(result.changedFiles.length).toBe(1);
    expect(result.unchangedFiles.length).toBe(2);
  });

  it('should return only added files when mode is new', () => {
    const diffResult = createDiffResult();

    const result = filterDiffResultByMode(diffResult, 'new');

    expect(result.addedFiles.length).toBe(2);
    expect(result.deletedFiles.length).toBe(0);
    expect(result.changedFiles.length).toBe(0);
    expect(result.unchangedFiles.length).toBe(2);
  });

  it('should return only changed files when mode is modified', () => {
    const diffResult = createDiffResult();

    const result = filterDiffResultByMode(diffResult, 'modified');

    expect(result.addedFiles.length).toBe(0);
    expect(result.deletedFiles.length).toBe(0);
    expect(result.changedFiles.length).toBe(1);
    expect(result.unchangedFiles.length).toBe(2);
  });

  it('should return only deleted files when mode is deleted', () => {
    const diffResult = createDiffResult();

    const result = filterDiffResultByMode(diffResult, 'deleted');

    expect(result.addedFiles.length).toBe(0);
    expect(result.deletedFiles.length).toBe(2);
    expect(result.changedFiles.length).toBe(0);
    expect(result.unchangedFiles.length).toBe(2);
  });

  it('should always preserve unchangedFiles regardless of mode', () => {
    const diffResult = createDiffResult();

    const addedResult = filterDiffResultByMode(diffResult, 'new');
    const modifiedResult = filterDiffResultByMode(diffResult, 'modified');
    const deletedResult = filterDiffResultByMode(diffResult, 'deleted');

    expect(addedResult.unchangedFiles).toEqual(diffResult.unchangedFiles);
    expect(modifiedResult.unchangedFiles).toEqual(diffResult.unchangedFiles);
    expect(deletedResult.unchangedFiles).toEqual(diffResult.unchangedFiles);
  });

  it('should handle empty arrays correctly', () => {
    const emptyDiffResult: FileDiffResult = {
      addedFiles: [],
      deletedFiles: [],
      changedFiles: [],
      unchangedFiles: []
    };

    const result = filterDiffResultByMode(emptyDiffResult, 'new');

    expect(result.addedFiles.length).toBe(0);
    expect(result.deletedFiles.length).toBe(0);
    expect(result.changedFiles.length).toBe(0);
    expect(result.unchangedFiles.length).toBe(0);
  });

  it('should not modify the original diffResult', () => {
    const diffResult = createDiffResult();
    const originalAddedLength = diffResult.addedFiles.length;

    filterDiffResultByMode(diffResult, 'deleted');

    expect(diffResult.addedFiles.length).toBe(originalAddedLength);
  });
});
