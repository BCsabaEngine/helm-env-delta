import { describe, expect, it } from 'vitest';

import { filterFileMap } from '../../src/utils/fileFilter';

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
