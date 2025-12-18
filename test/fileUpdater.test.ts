import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { updateFiles } from '../src/fileUpdater';

vi.mock('node:fs/promises', () => ({
  stat: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn()
}));

import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';

describe('fileUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as never);
    vi.mocked(mkdir).mockResolvedValue();
    vi.mocked(writeFile).mockResolvedValue();
    vi.mocked(unlink).mockResolvedValue();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('updateFiles', () => {
    it('should add new files', async () => {
      const diffResult = {
        addedFiles: ['new.yaml'],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const source = new Map([['new.yaml', 'content']]);
      const destination = new Map();
      const config = { source: './src', destination: './dest' };

      await updateFiles(diffResult, source, destination, config, false);

      expect(writeFile).toHaveBeenCalled();
    });

    it('should update changed files', async () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'file.yaml',
            sourceContent: 'new',
            destinationContent: 'old',
            processedSourceContent: {},
            processedDestContent: {},
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };
      const source = new Map([['file.yaml', 'new']]);
      const destination = new Map([['file.yaml', 'old']]);
      const config = { source: './src', destination: './dest' };

      await updateFiles(diffResult, source, destination, config, false);

      expect(writeFile).toHaveBeenCalled();
    });

    it('should delete files when prune is enabled', async () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: ['old.yaml'],
        changedFiles: [],
        unchangedFiles: []
      };
      const source = new Map();
      const destination = new Map([['old.yaml', 'content']]);
      const config = { source: './src', destination: './dest', prune: true };

      await updateFiles(diffResult, source, destination, config, false);

      expect(unlink).toHaveBeenCalled();
    });

    it('should not include deleted files when prune is disabled', async () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const source = new Map();
      const destination = new Map([['old.yaml', 'content']]);
      const config = { source: './src', destination: './dest', prune: false };

      await updateFiles(diffResult, source, destination, config, false);

      expect(unlink).not.toHaveBeenCalled();
    });

    it('should not write files in dry-run mode', async () => {
      const diffResult = {
        addedFiles: ['new.yaml'],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const source = new Map([['new.yaml', 'content']]);
      const destination = new Map();
      const config = { source: './src', destination: './dest' };

      await updateFiles(diffResult, source, destination, config, true);

      expect(writeFile).not.toHaveBeenCalled();
    });

    it('should return list of formatted files', async () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const source = new Map();
      const destination = new Map();
      const config = { source: './src', destination: './dest' };

      const result = await updateFiles(diffResult, source, destination, config, false);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle files with nested paths', async () => {
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as never);

      const diffResult = {
        addedFiles: ['nested/path/file.yaml'],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const source = new Map([['nested/path/file.yaml', 'content']]);
      const destination = new Map();
      const config = { source: './src', destination: './dest' };

      await updateFiles(diffResult, source, destination, config, false);

      expect(writeFile).toHaveBeenCalled();
    });
  });
});
