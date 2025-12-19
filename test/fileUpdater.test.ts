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

    it('should apply transforms when updating YAML files', async () => {
      const transformedData = { url: 'prod-db.cluster-abc123.rds.amazonaws.com', version: '1.0.0' };
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'values.yaml',
            sourceContent: 'url: uat-db.cluster-abc123.rds.amazonaws.com\nversion: 1.0.0',
            destinationContent: 'url: old-db.cluster-xyz789.rds.amazonaws.com\nversion: 1.0.0',
            processedSourceContent: {},
            processedDestContent: {},
            rawParsedSource: transformedData,
            rawParsedDest: { url: 'old-db.cluster-xyz789.rds.amazonaws.com', version: '1.0.0' }
          }
        ],
        unchangedFiles: []
      };
      const source = new Map([['values.yaml', 'url: uat-db.cluster-abc123.rds.amazonaws.com\nversion: 1.0.0']]);
      const destination = new Map([['values.yaml', 'url: old-db.cluster-xyz789.rds.amazonaws.com\nversion: 1.0.0']]);
      const config = { source: './src', destination: './dest' };

      await updateFiles(diffResult, source, destination, config, false);

      expect(writeFile).toHaveBeenCalled();
      const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(writtenContent).toContain('prod-db.cluster-abc123.rds.amazonaws.com');
      expect(writtenContent).not.toContain('uat-db.cluster-abc123.rds.amazonaws.com');
    });

    it('should preserve skipPath behavior during updates', async () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'values.yaml',
            sourceContent: 'url: uat-db.internal',
            destinationContent: 'url: old-db.internal\nversion: 1.0.0',
            processedSourceContent: {},
            processedDestContent: {},
            rawParsedSource: { url: 'prod-db.internal' },
            rawParsedDest: { url: 'old-db.internal', version: '1.0.0' }
          }
        ],
        unchangedFiles: []
      };
      const source = new Map([['values.yaml', 'url: uat-db.internal']]);
      const destination = new Map([['values.yaml', 'url: old-db.internal\nversion: 1.0.0']]);
      const config = { source: './src', destination: './dest' };

      await updateFiles(diffResult, source, destination, config, false);

      expect(writeFile).toHaveBeenCalled();
      const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(writtenContent).toContain('version: 1.0.0');
      expect(writtenContent).toContain('prod-db.internal');
    });

    it('should merge transformed source with destination', async () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'values.yaml',
            sourceContent: 'image:\n  tag: uat-v2.0.0\nreplicas: 3',
            destinationContent: 'image:\n  tag: old-v1.0.0\n  pullPolicy: Always',
            processedSourceContent: {},
            processedDestContent: {},
            rawParsedSource: { image: { tag: 'prod-v2.0.0' }, replicas: 3 },
            rawParsedDest: { image: { tag: 'old-v1.0.0', pullPolicy: 'Always' } }
          }
        ],
        unchangedFiles: []
      };
      const source = new Map([['values.yaml', 'image:\n  tag: uat-v2.0.0\nreplicas: 3']]);
      const destination = new Map([['values.yaml', 'image:\n  tag: old-v1.0.0\n  pullPolicy: Always']]);
      const config = { source: './src', destination: './dest' };

      await updateFiles(diffResult, source, destination, config, false);

      expect(writeFile).toHaveBeenCalled();
      const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(writtenContent).toContain('prod-v2.0.0');
      expect(writtenContent).toContain('pullPolicy: Always');
      expect(writtenContent).toContain('replicas: 3');
    });

    it('should handle updates without transforms configured', async () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'values.yaml',
            sourceContent: 'url: new-url.internal',
            destinationContent: 'url: old-url.internal',
            processedSourceContent: {},
            processedDestContent: {},
            rawParsedSource: { url: 'new-url.internal' },
            rawParsedDest: { url: 'old-url.internal' }
          }
        ],
        unchangedFiles: []
      };
      const source = new Map([['values.yaml', 'url: new-url.internal']]);
      const destination = new Map([['values.yaml', 'url: old-url.internal']]);
      const config = { source: './src', destination: './dest' };

      await updateFiles(diffResult, source, destination, config, false);

      expect(writeFile).toHaveBeenCalled();
    });

    it('should skip formatting when skipFormat is true', async () => {
      const diffResult = {
        addedFiles: ['new.yaml'],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const source = new Map([['new.yaml', 'key: value']]);
      const destination = new Map();
      const config = {
        source: './src',
        destination: './dest',
        outputFormat: { indent: 4, keySeparator: true }
      };

      await updateFiles(diffResult, source, destination, config, false, true);

      expect(writeFile).toHaveBeenCalled();
    });

    it('should apply formatting when skipFormat is false', async () => {
      const diffResult = {
        addedFiles: ['new.yaml'],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const source = new Map([['new.yaml', 'key: value']]);
      const destination = new Map();
      const config = {
        source: './src',
        destination: './dest',
        outputFormat: { indent: 4, keySeparator: true }
      };

      await updateFiles(diffResult, source, destination, config, false, false);

      expect(writeFile).toHaveBeenCalled();
    });
  });
});
