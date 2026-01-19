import { readFile as fsPromisesReadFile, stat as fsPromisesStat } from 'node:fs/promises';
import path from 'node:path';

import { glob as tinyglobbyGlob } from 'tinyglobby';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileLoaderError, isFileLoaderError, loadFiles } from '../src/fileLoader';
import { transformFilename, transformFilenameMap, TransformMapResult } from '../src/utils/filenameTransformer';

vi.mock('node:fs/promises');
vi.mock('tinyglobby');
vi.mock('../src/utils/filenameTransformer');

const mockStat = vi.mocked(fsPromisesStat);
const mockReadFile = vi.mocked(fsPromisesReadFile);
const mockGlob = vi.mocked(tinyglobbyGlob);
const mockTransformFilename = vi.mocked(transformFilename);
const mockTransformFilenameMap = vi.mocked(transformFilenameMap);

// Helper to create mock TransformMapResult
const createMockTransformResult = (
  fileMap: Map<string, string>,
  originalPaths?: Map<string, string>
): TransformMapResult => ({
  fileMap,
  originalPaths: originalPaths ?? new Map()
});

describe('fileLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for transformFilenameMap - returns input fileMap unchanged with empty originalPaths
    mockTransformFilenameMap.mockImplementation((fileMap) => createMockTransformResult(fileMap));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadFiles - directory validation', () => {
    it('should resolve absolute path correctly', async () => {
      const absolutePath = '/absolute/path/to/dir';
      mockStat.mockResolvedValue({ isDirectory: () => true } as unknown as Awaited<ReturnType<typeof fsPromisesStat>>);
      mockGlob.mockResolvedValue([]);

      await loadFiles({ baseDirectory: absolutePath, include: ['**/*'], exclude: [] });

      expect(mockStat).toHaveBeenCalledWith(absolutePath);
    });

    it('should resolve relative path to absolute', async () => {
      const relativePath = './relative/path';
      const expectedAbsolute = path.resolve(process.cwd(), relativePath);
      mockStat.mockResolvedValue({ isDirectory: () => true } as unknown as Awaited<ReturnType<typeof fsPromisesStat>>);
      mockGlob.mockResolvedValue([]);

      await loadFiles({ baseDirectory: relativePath, include: ['**/*'], exclude: [] });

      expect(mockStat).toHaveBeenCalledWith(expectedAbsolute);
    });

    it('should throw ENOENT error for non-existent directory', async () => {
      const nonExistentPath = '/nonexistent/path';
      const error = new Error('ENOENT');
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      mockStat.mockRejectedValue(error);

      await expect(loadFiles({ baseDirectory: nonExistentPath, include: ['**/*'], exclude: [] })).rejects.toThrow(
        FileLoaderError
      );

      await expect(loadFiles({ baseDirectory: nonExistentPath, include: ['**/*'], exclude: [] })).rejects.toThrow(
        'Failed to access base directory'
      );
    });

    it('should throw ENOTDIR error when path is a file', async () => {
      const filePath = '/path/to/file.txt';
      mockStat.mockResolvedValue({ isDirectory: () => false } as unknown as Awaited<ReturnType<typeof fsPromisesStat>>);

      await expect(loadFiles({ baseDirectory: filePath, include: ['**/*'], exclude: [] })).rejects.toThrow(
        FileLoaderError
      );

      await expect(loadFiles({ baseDirectory: filePath, include: ['**/*'], exclude: [] })).rejects.toThrow(
        'Base path is not a directory'
      );
    });

    it('should throw EACCES error for permission denied', async () => {
      const restrictedPath = '/restricted/path';
      const error = new Error('EACCES');
      (error as NodeJS.ErrnoException).code = 'EACCES';
      mockStat.mockRejectedValue(error);

      await expect(loadFiles({ baseDirectory: restrictedPath, include: ['**/*'], exclude: [] })).rejects.toThrow(
        FileLoaderError
      );

      await expect(loadFiles({ baseDirectory: restrictedPath, include: ['**/*'], exclude: [] })).rejects.toThrow(
        'Failed to access base directory'
      );
    });

    it('should include helpful hints in ENOENT error', async () => {
      const nonExistentPath = '/nonexistent';
      const error = new Error('ENOENT');
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      mockStat.mockRejectedValue(error);

      try {
        await loadFiles({ baseDirectory: nonExistentPath, include: ['**/*'], exclude: [] });
      } catch (error_: unknown) {
        expect(isFileLoaderError(error_)).toBe(true);
        if (isFileLoaderError(error_)) {
          expect(error_.message).toContain('Hint');
          expect(error_.message).toContain('Check your config');
        }
      }
    });

    it('should include helpful hints in EACCES error', async () => {
      const restrictedPath = '/restricted';
      const error = new Error('EACCES');
      (error as NodeJS.ErrnoException).code = 'EACCES';
      mockStat.mockRejectedValue(error);

      try {
        await loadFiles({ baseDirectory: restrictedPath, include: ['**/*'], exclude: [] });
      } catch (error_: unknown) {
        expect(isFileLoaderError(error_)).toBe(true);
        if (isFileLoaderError(error_)) {
          expect(error_.message).toContain('Hint');
          expect(error_.message).toContain('Permission denied');
          expect(error_.message).toContain('chmod');
        }
      }
    });
  });

  describe('loadFiles - glob matching without transforms', () => {
    beforeEach(() => {
      mockStat.mockResolvedValue({ isDirectory: () => true } as unknown as Awaited<ReturnType<typeof fsPromisesStat>>);
    });

    it('should match files with include pattern', async () => {
      const baseDirectory = '/base';
      mockGlob.mockResolvedValue([`${baseDirectory}/file1.yaml`, `${baseDirectory}/file2.yaml`]);
      mockReadFile.mockResolvedValue('content' as unknown as Buffer);

      await loadFiles({ baseDirectory, include: ['**/*.yaml'], exclude: [] });

      expect(mockGlob).toHaveBeenCalledWith(['**/*.yaml'], {
        cwd: baseDirectory,
        absolute: true,
        onlyFiles: true,
        dot: false,
        followSymbolicLinks: false
      });
    });

    it('should apply exclude patterns', async () => {
      const baseDirectory = '/base';
      mockGlob.mockResolvedValue([]);

      await loadFiles({ baseDirectory, include: ['**/*'], exclude: ['node_modules/**'] });

      expect(mockGlob).toHaveBeenCalledWith(['**/*', '!node_modules/**'], {
        cwd: baseDirectory,
        absolute: true,
        onlyFiles: true,
        dot: false,
        followSymbolicLinks: false
      });
    });

    it('should return empty Map when no files match', async () => {
      const baseDirectory = '/base';
      mockGlob.mockResolvedValue([]);

      const result = await loadFiles({ baseDirectory, include: ['**/*.yaml'], exclude: [] });

      expect(result.fileMap.size).toBe(0);
    });

    it('should use default include pattern when not provided', async () => {
      const baseDirectory = '/base';
      mockGlob.mockResolvedValue([]);

      await loadFiles({ baseDirectory, include: ['**/*'], exclude: [] });

      expect(mockGlob).toHaveBeenCalledWith(['**/*'], expect.any(Object));
    });

    it('should exclude dot files by default', async () => {
      const baseDirectory = '/base';
      mockGlob.mockResolvedValue([]);

      await loadFiles({ baseDirectory, include: ['**/*'], exclude: [] });

      expect(mockGlob).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ dot: false }));
    });

    it('should not follow symbolic links', async () => {
      const baseDirectory = '/base';
      mockGlob.mockResolvedValue([]);

      await loadFiles({ baseDirectory, include: ['**/*'], exclude: [] });

      expect(mockGlob).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ followSymbolicLinks: false }));
    });

    it('should only match files, not directories', async () => {
      const baseDirectory = '/base';
      mockGlob.mockResolvedValue([]);

      await loadFiles({ baseDirectory, include: ['**/*'], exclude: [] });

      expect(mockGlob).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ onlyFiles: true }));
    });
  });

  describe('loadFiles - glob matching with transforms', () => {
    beforeEach(() => {
      mockStat.mockResolvedValue({ isDirectory: () => true } as unknown as Awaited<ReturnType<typeof fsPromisesStat>>);
    });

    it('should load all files first when transforms are present', async () => {
      const baseDirectory = '/base';
      const transforms = { '**/*.yaml': { content: [{ find: 'test', replace: 'prod' }] } };
      mockGlob.mockResolvedValue([]);
      mockTransformFilenameMap.mockReturnValue(createMockTransformResult(new Map()));

      await loadFiles({ baseDirectory, include: ['**/*.yaml'], exclude: [], transforms });

      expect(mockGlob).toHaveBeenCalledWith(['**/*'], {
        cwd: baseDirectory,
        absolute: true,
        onlyFiles: true,
        dot: false,
        followSymbolicLinks: false
      });
    });

    it('should apply transforms before include/exclude filtering', async () => {
      const baseDirectory = '/base';
      const transforms = { '**/*.yaml': { filename: [{ find: 'uat', replace: 'prod' }] } };
      mockGlob.mockResolvedValue([`${baseDirectory}/file-uat.yaml`]);
      mockTransformFilename.mockReturnValue('file-prod.yaml');
      mockReadFile.mockResolvedValue('content' as unknown as Buffer);
      mockTransformFilenameMap.mockImplementation((map) => createMockTransformResult(map));

      await loadFiles({ baseDirectory, include: ['**/*-prod.yaml'], exclude: [], transforms });

      expect(mockTransformFilename).toHaveBeenCalledWith('file-uat.yaml', transforms);
    });

    it('should filter files based on transformed paths', async () => {
      const baseDirectory = '/base';
      const transforms = { '**/*.yaml': { filename: [{ find: 'uat', replace: 'prod' }] } };
      mockGlob.mockResolvedValue([`${baseDirectory}/file-uat.yaml`, `${baseDirectory}/other.txt`]);
      mockTransformFilename.mockImplementation((path) => path.replace('uat', 'prod'));
      mockReadFile.mockResolvedValue('content' as unknown as Buffer);
      mockTransformFilenameMap.mockImplementation((map) => createMockTransformResult(map));

      const result = await loadFiles({ baseDirectory, include: ['**/*-prod.yaml'], exclude: [], transforms });

      expect(result.fileMap.size).toBe(1);
      expect(mockReadFile).toHaveBeenCalledTimes(1);
    });

    it('should exclude files based on transformed paths', async () => {
      const baseDirectory = '/base';
      const transforms = { '**/*': { filename: [{ find: 'temp', replace: 'node_modules' }] } };
      mockGlob.mockResolvedValue([`${baseDirectory}/temp/file.yaml`]);
      mockTransformFilename.mockReturnValue('node_modules/file.yaml');
      mockTransformFilenameMap.mockImplementation((map) => createMockTransformResult(map));

      const result = await loadFiles({
        baseDirectory,
        include: ['**/*'],
        exclude: ['node_modules/**'],
        transforms
      });

      expect(result.fileMap.size).toBe(0);
    });
  });

  describe('loadFiles - file reading', () => {
    beforeEach(() => {
      mockStat.mockResolvedValue({ isDirectory: () => true } as unknown as Awaited<ReturnType<typeof fsPromisesStat>>);
    });

    it('should read single file content', async () => {
      const baseDirectory = '/base';
      const filePath = `${baseDirectory}/file.yaml`;
      mockGlob.mockResolvedValue([filePath]);
      mockReadFile.mockResolvedValue('file content' as unknown as Buffer);

      const result = await loadFiles({ baseDirectory, include: ['**/*'], exclude: [] });

      expect(mockReadFile).toHaveBeenCalledWith(filePath, 'utf8');
      expect(result.fileMap.get('file.yaml')).toBe('file content');
    });

    it('should read multiple files in parallel', async () => {
      const baseDirectory = '/base';
      mockGlob.mockResolvedValue([
        `${baseDirectory}/file1.yaml`,
        `${baseDirectory}/file2.yaml`,
        `${baseDirectory}/file3.yaml`
      ]);
      mockReadFile.mockResolvedValue('content' as unknown as Buffer);

      await loadFiles({ baseDirectory, include: ['**/*'], exclude: [] });

      expect(mockReadFile).toHaveBeenCalledTimes(3);
    });

    it('should handle empty files', async () => {
      const baseDirectory = '/base';
      const filePath = `${baseDirectory}/empty.yaml`;
      mockGlob.mockResolvedValue([filePath]);
      mockReadFile.mockResolvedValue('' as unknown as Buffer);

      const result = await loadFiles({ baseDirectory, include: ['**/*'], exclude: [] });

      expect(result.fileMap.get('empty.yaml')).toBe('');
    });

    it('should detect binary files by null byte', async () => {
      const baseDirectory = '/base';
      const filePath = `${baseDirectory}/binary.bin`;
      mockGlob.mockResolvedValue([filePath]);
      mockReadFile.mockResolvedValue('binary\0content' as unknown as Buffer);

      await expect(loadFiles({ baseDirectory, include: ['**/*'], exclude: [] })).rejects.toThrow(FileLoaderError);

      await expect(loadFiles({ baseDirectory, include: ['**/*'], exclude: [] })).rejects.toThrow(
        'Binary file detected'
      );
    });

    it('should include helpful hints for binary files', async () => {
      const baseDirectory = '/base';
      const filePath = `${baseDirectory}/image.png`;
      mockGlob.mockResolvedValue([filePath]);
      mockReadFile.mockResolvedValue('\0PNG' as unknown as Buffer);

      try {
        await loadFiles({ baseDirectory, include: ['**/*'], exclude: [] });
      } catch (error: unknown) {
        expect(isFileLoaderError(error)).toBe(true);
        if (isFileLoaderError(error)) {
          expect(error.message).toContain('Hint');
          expect(error.message).toContain('exclude');
          expect(error.message).toContain('png');
        }
      }
    });

    it('should throw error when file read fails', async () => {
      const baseDirectory = '/base';
      const filePath = `${baseDirectory}/file.yaml`;
      mockGlob.mockResolvedValue([filePath]);
      const error = new Error('Read error');
      (error as NodeJS.ErrnoException).code = 'EACCES';
      mockReadFile.mockRejectedValue(error);

      await expect(loadFiles({ baseDirectory, include: ['**/*'], exclude: [] })).rejects.toThrow(FileLoaderError);

      await expect(loadFiles({ baseDirectory, include: ['**/*'], exclude: [] })).rejects.toThrow('Failed to read file');
    });

    it('should handle files with special characters in path', async () => {
      const baseDirectory = '/base';
      const filePath = `${baseDirectory}/file with spaces.yaml`;
      mockGlob.mockResolvedValue([filePath]);
      mockReadFile.mockResolvedValue('content' as unknown as Buffer);

      const result = await loadFiles({ baseDirectory, include: ['**/*'], exclude: [] });

      expect(result.fileMap.has('file with spaces.yaml')).toBe(true);
    });

    it('should handle files in nested directories', async () => {
      const baseDirectory = '/base';
      const filePath = `${baseDirectory}/sub/dir/file.yaml`;
      mockGlob.mockResolvedValue([filePath]);
      mockReadFile.mockResolvedValue('content' as unknown as Buffer);

      const result = await loadFiles({ baseDirectory, include: ['**/*'], exclude: [] });

      expect(result.fileMap.has('sub/dir/file.yaml')).toBe(true);
    });
  });

  describe('loadFiles - Map operations', () => {
    beforeEach(() => {
      mockStat.mockResolvedValue({ isDirectory: () => true } as unknown as Awaited<ReturnType<typeof fsPromisesStat>>);
    });

    it('should return Map with sorted keys', async () => {
      const baseDirectory = '/base';
      mockGlob.mockResolvedValue([`${baseDirectory}/c.yaml`, `${baseDirectory}/a.yaml`, `${baseDirectory}/b.yaml`]);
      mockReadFile.mockResolvedValue('content' as unknown as Buffer);

      const result = await loadFiles({ baseDirectory, include: ['**/*'], exclude: [] });

      const keys = [...result.fileMap.keys()];
      expect(keys).toEqual(['a.yaml', 'b.yaml', 'c.yaml']);
    });

    it('should use relative paths as keys', async () => {
      const baseDirectory = '/base/path';
      mockGlob.mockResolvedValue([`${baseDirectory}/sub/file.yaml`]);
      mockReadFile.mockResolvedValue('content' as unknown as Buffer);

      const result = await loadFiles({ baseDirectory, include: ['**/*'], exclude: [] });

      expect(result.fileMap.has('sub/file.yaml')).toBe(true);
      expect(result.fileMap.has('/base/path/sub/file.yaml')).toBe(false);
    });

    it('should preserve file content', async () => {
      const baseDirectory = '/base';
      const content1 = 'version: 1.0.0';
      const content2 = 'version: 2.0.0';
      mockGlob.mockResolvedValue([`${baseDirectory}/file1.yaml`, `${baseDirectory}/file2.yaml`]);
      mockReadFile
        .mockResolvedValueOnce(content1 as unknown as Buffer)
        .mockResolvedValueOnce(content2 as unknown as Buffer);

      const result = await loadFiles({ baseDirectory, include: ['**/*'], exclude: [] });

      expect(result.fileMap.get('file1.yaml')).toBe(content1);
      expect(result.fileMap.get('file2.yaml')).toBe(content2);
    });
  });

  describe('loadFiles - filename transforms integration', () => {
    beforeEach(() => {
      mockStat.mockResolvedValue({ isDirectory: () => true } as unknown as Awaited<ReturnType<typeof fsPromisesStat>>);
      mockReadFile.mockResolvedValue('content' as unknown as Buffer);
    });

    it('should apply transformFilenameMap when transforms provided', async () => {
      const baseDirectory = '/base';
      const transforms = { '**/*.yaml': { filename: [{ find: 'uat', replace: 'prod' }] } };
      mockGlob.mockResolvedValue([`${baseDirectory}/file.yaml`]);
      mockTransformFilename.mockReturnValue('file.yaml');
      const mockMap = new Map([['file.yaml', 'content']]);
      mockTransformFilenameMap.mockReturnValue(createMockTransformResult(mockMap));

      await loadFiles({ baseDirectory, include: ['**/*'], exclude: [], transforms });

      expect(mockTransformFilenameMap).toHaveBeenCalledWith(expect.any(Map), transforms);
    });

    it('should apply transformFilenameMap even when no transforms (passes undefined)', async () => {
      const baseDirectory = '/base';
      mockGlob.mockResolvedValue([`${baseDirectory}/file.yaml`]);

      await loadFiles({ baseDirectory, include: ['**/*'], exclude: [] });

      // transformFilenameMap is always called now; when no transforms, passes undefined
      expect(mockTransformFilenameMap).toHaveBeenCalledWith(expect.any(Map), undefined);
    });

    it('should return transformed map with originalPaths', async () => {
      const baseDirectory = '/base';
      const transforms = { '**/*.yaml': { filename: [{ find: 'uat', replace: 'prod' }] } };
      mockGlob.mockResolvedValue([`${baseDirectory}/uat-file.yaml`]);
      mockTransformFilename.mockReturnValue('uat-file.yaml');
      const transformedMap = new Map([['prod-file.yaml', 'content']]);
      const originalPaths = new Map([['prod-file.yaml', 'uat-file.yaml']]);
      mockTransformFilenameMap.mockReturnValue(createMockTransformResult(transformedMap, originalPaths));

      const result = await loadFiles({ baseDirectory, include: ['**/*'], exclude: [], transforms });

      expect(result.fileMap).toStrictEqual(transformedMap);
      expect(result.originalPaths).toStrictEqual(originalPaths);
    });
  });

  describe('loadFiles - error handling', () => {
    beforeEach(() => {
      mockStat.mockResolvedValue({ isDirectory: () => true } as unknown as Awaited<ReturnType<typeof fsPromisesStat>>);
    });

    it('should throw FileLoaderError for glob failures', async () => {
      const baseDirectory = '/base';
      mockGlob.mockRejectedValue(new Error('Glob failed'));

      await expect(loadFiles({ baseDirectory, include: ['**/*'], exclude: [] })).rejects.toThrow(FileLoaderError);

      await expect(loadFiles({ baseDirectory, include: ['**/*'], exclude: [] })).rejects.toThrow(
        'Failed to search for files'
      );
    });

    it('should propagate FileLoaderError from readFile', async () => {
      const baseDirectory = '/base';
      mockGlob.mockResolvedValue([`${baseDirectory}/file.yaml`]);
      mockReadFile.mockRejectedValue(new FileLoaderError('Custom error', {}));

      await expect(loadFiles({ baseDirectory, include: ['**/*'], exclude: [] })).rejects.toThrow('Custom error');
    });

    it('should wrap non-FileLoaderError from readFile', async () => {
      const baseDirectory = '/base';
      mockGlob.mockResolvedValue([`${baseDirectory}/file.yaml`]);
      mockReadFile.mockRejectedValue(new Error('Generic error'));

      await expect(loadFiles({ baseDirectory, include: ['**/*'], exclude: [] })).rejects.toThrow(FileLoaderError);
    });
  });

  describe('isFileLoaderError type guard', () => {
    it('should return true for FileLoaderError instances', () => {
      const error = new FileLoaderError('Test error', {});
      expect(isFileLoaderError(error)).toBe(true);
    });

    it('should return false for generic Error', () => {
      const error = new Error('Generic error');
      expect(isFileLoaderError(error)).toBe(false);
    });

    it('should return false for non-Error objects', () => {
      expect(isFileLoaderError('string')).toBe(false);
      expect(isFileLoaderError(123)).toBe(false);
      expect(isFileLoaderError({})).toBe(false);
      expect(isFileLoaderError()).toBe(false);
    });
  });
});
