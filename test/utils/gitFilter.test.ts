import { beforeEach, describe, expect, it, vi } from 'vitest';

import { filterFileMapsByGitAuthor, getGitUser, isGitFilterError } from '../../src/utils/gitFilter';

const mockRaw = vi.fn();
const mockRevparse = vi.fn();

vi.mock('simple-git', () => ({
  default: () => ({
    raw: mockRaw,
    revparse: mockRevparse
  })
}));

const makeFileMap = (entries: Record<string, string>) => new Map(Object.entries(entries));

describe('gitFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGitUser', () => {
    it('should return user.name when configured', async () => {
      mockRaw.mockResolvedValueOnce('John Doe\n');

      const result = await getGitUser();

      expect(result).toBe('John Doe');
      expect(mockRaw).toHaveBeenCalledWith(['config', 'user.name']);
    });

    it('should fall back to user.email when name is empty', async () => {
      mockRaw.mockResolvedValueOnce('').mockResolvedValueOnce('john@example.com\n');

      const result = await getGitUser();

      expect(result).toBe('john@example.com');
      expect(mockRaw).toHaveBeenCalledTimes(2);
      expect(mockRaw).toHaveBeenNthCalledWith(1, ['config', 'user.name']);
      expect(mockRaw).toHaveBeenNthCalledWith(2, ['config', 'user.email']);
    });

    it('should throw NO_GIT_USER when both name and email are absent', async () => {
      mockRaw.mockResolvedValueOnce('').mockResolvedValueOnce('');

      await expect(getGitUser()).rejects.toSatisfy(isGitFilterError);
    });

    it('should throw NOT_GIT_REPO when not in a git repo', async () => {
      mockRaw.mockRejectedValueOnce(new Error('fatal: not a git repository'));

      await expect(getGitUser()).rejects.toSatisfy((error: unknown) => {
        if (!isGitFilterError(error)) return false;
        return error.code === 'NOT_GIT_REPO';
      });
    });

    it('should throw GIT_COMMAND_FAILED for other git errors', async () => {
      mockRaw.mockRejectedValueOnce(new Error('some other git error'));

      await expect(getGitUser()).rejects.toSatisfy((error: unknown) => {
        if (!isGitFilterError(error)) return false;
        return error.code === 'GIT_COMMAND_FAILED';
      });
    });
  });

  describe('filterFileMapsByGitAuthor', () => {
    const gitRoot = '/repo';
    const absoluteSourceDirectory = '/repo/helm-charts/source';

    beforeEach(() => {
      mockRevparse.mockResolvedValue(`${gitRoot}\n`);
    });

    it('should filter source files to those matching git log output', async () => {
      // git log output: paths relative to git root
      mockRaw.mockResolvedValueOnce(
        '\nhelm-charts/source/apps/nginx/values.yaml\nhelm-charts/source/apps/redis/values.yaml\n'
      );

      const sourceFiles = makeFileMap({
        'apps/nginx/values.yaml': 'nginx: 1',
        'apps/redis/values.yaml': 'redis: 1',
        'apps/postgres/values.yaml': 'postgres: 1'
      });
      const destinationFiles = makeFileMap({
        'apps/nginx/values.yaml': 'nginx: 2',
        'apps/redis/values.yaml': 'redis: 2',
        'apps/postgres/values.yaml': 'postgres: 2'
      });

      const result = await filterFileMapsByGitAuthor(
        sourceFiles,
        destinationFiles,
        absoluteSourceDirectory,
        'John Doe',
        30
      );

      expect([...result.sourceFiles.keys()].toSorted()).toEqual(
        ['apps/nginx/values.yaml', 'apps/redis/values.yaml'].toSorted()
      );
      expect([...result.destinationFiles.keys()].toSorted()).toEqual(
        ['apps/nginx/values.yaml', 'apps/redis/values.yaml'].toSorted()
      );
    });

    it('should return empty maps when git log output is empty', async () => {
      mockRaw.mockResolvedValueOnce('');

      const sourceFiles = makeFileMap({ 'apps/nginx/values.yaml': 'nginx: 1' });
      const destinationFiles = makeFileMap({ 'apps/nginx/values.yaml': 'nginx: 2' });

      const result = await filterFileMapsByGitAuthor(
        sourceFiles,
        destinationFiles,
        absoluteSourceDirectory,
        'John Doe',
        30
      );

      expect(result.sourceFiles.size).toBe(0);
      expect(result.destinationFiles.size).toBe(0);
    });

    it('should keep destination counterparts for matched source keys', async () => {
      mockRaw.mockResolvedValueOnce('\nhelm-charts/source/apps/nginx/values.yaml\n');

      const sourceFiles = makeFileMap({ 'apps/nginx/values.yaml': 'nginx: 1' });
      const destinationFiles = makeFileMap({
        'apps/nginx/values.yaml': 'nginx: 2',
        'apps/redis/values.yaml': 'redis: 2'
      });

      const result = await filterFileMapsByGitAuthor(
        sourceFiles,
        destinationFiles,
        absoluteSourceDirectory,
        'John Doe',
        30
      );

      expect([...result.destinationFiles.keys()]).toEqual(['apps/nginx/values.yaml']);
    });

    it('should pass correct args to git log', async () => {
      mockRaw.mockResolvedValueOnce('');

      await filterFileMapsByGitAuthor(new Map(), new Map(), absoluteSourceDirectory, 'Jane Smith', 7);

      expect(mockRaw).toHaveBeenCalledWith([
        'log',
        '--author=Jane Smith',
        '--since=7 days ago',
        '--name-only',
        '--pretty=format:',
        '--',
        absoluteSourceDirectory
      ]);
    });
  });

  describe('isGitFilterError', () => {
    it('should return true for GitFilterError instances', async () => {
      mockRaw.mockResolvedValueOnce('').mockResolvedValueOnce('');

      const error = await getGitUser().catch((error_: unknown) => error_);

      expect(isGitFilterError(error)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      expect(isGitFilterError(new Error('regular error'))).toBe(false);
    });

    it('should return false for non-Error values', () => {
      expect(isGitFilterError('string')).toBe(false);
      expect(isGitFilterError(42)).toBe(false);
    });
  });
});
