import { describe, expect, it } from 'vitest';

import { filterFileMap, filterFileMaps } from '../../src/utils/fileFilter';

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
});
