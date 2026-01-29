import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AddedFile } from '../src/fileDiff';
import { updateFiles } from '../src/fileUpdater';
import { Logger } from '../src/logger';

const createAddedFile = (path: string): AddedFile => ({
  path,
  content: 'content',
  processedContent: 'content'
});

vi.mock('node:fs/promises', () => ({
  stat: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn()
}));

import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';

// Helper to create a mock logger
const createMockLogger = (): Logger => {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    progress: vi.fn(),
    fileOp: vi.fn(),
    stopRule: vi.fn(),
    shouldShow: vi.fn(() => true)
  } as unknown as Logger;
};

describe('fileUpdater', () => {
  let mockLogger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as never);
    vi.mocked(mkdir).mockResolvedValue();
    vi.mocked(writeFile).mockResolvedValue();
    vi.mocked(unlink).mockResolvedValue();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    mockLogger = createMockLogger();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('updateFiles', () => {
    it('should add new files', async () => {
      const diffResult = {
        addedFiles: [createAddedFile('new.yaml')],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const source = new Map([['new.yaml', 'content']]);
      const destination = new Map();
      const config = { source: './src', destination: './dest' };

      await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

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

      await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

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

      await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

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

      await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

      expect(unlink).not.toHaveBeenCalled();
    });

    it('should not write files in dry-run mode', async () => {
      const diffResult = {
        addedFiles: [createAddedFile('new.yaml')],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const source = new Map([['new.yaml', 'content']]);
      const destination = new Map();
      const config = { source: './src', destination: './dest' };

      await updateFiles(diffResult, source, destination, config, true, false, mockLogger);

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

      const result = await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle files with nested paths', async () => {
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as never);

      const diffResult = {
        addedFiles: [createAddedFile('nested/path/file.yaml')],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };
      const source = new Map([['nested/path/file.yaml', 'content']]);
      const destination = new Map();
      const config = { source: './src', destination: './dest' };

      await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

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

      await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

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
            sourceContent: 'url: uat-db.internal\nversion: 1.0.0',
            destinationContent: 'url: old-db.internal\nversion: 2.0.0',
            processedSourceContent: {},
            processedDestContent: {},
            rawParsedSource: { url: 'prod-db.internal' },
            rawParsedDest: { url: 'old-db.internal' }
          }
        ],
        unchangedFiles: []
      };
      const source = new Map([['values.yaml', 'url: uat-db.internal\nversion: 1.0.0']]);
      const destination = new Map([['values.yaml', 'url: old-db.internal\nversion: 2.0.0']]);
      const config = { source: './src', destination: './dest' };

      await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

      expect(writeFile).toHaveBeenCalled();
      const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(writtenContent).toContain('version: 2.0.0');
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

      await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

      expect(writeFile).toHaveBeenCalled();
      const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(writtenContent).toContain('prod-v2.0.0');
      expect(writtenContent).not.toContain('pullPolicy');
      expect(writtenContent).toContain('replicas: 3');
    });

    it('should delete fields that exist in destination but not in source', async () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'values.yaml',
            sourceContent: 'image:\n  tag: v1.0.0',
            destinationContent: 'image:\n  tag: v1.0.0\nextraVolumeMounts:\n  - name: ca\n    mountPath: /opt/ca',
            processedSourceContent: {},
            processedDestContent: {},
            rawParsedSource: { image: { tag: 'v1.0.0' } },
            rawParsedDest: { image: { tag: 'v1.0.0' }, extraVolumeMounts: [{ name: 'ca', mountPath: '/opt/ca' }] }
          }
        ],
        unchangedFiles: []
      };
      const source = new Map([['values.yaml', 'image:\n  tag: v1.0.0']]);
      const destination = new Map([
        ['values.yaml', 'image:\n  tag: v1.0.0\nextraVolumeMounts:\n  - name: ca\n    mountPath: /opt/ca']
      ]);
      const config = { source: './src', destination: './dest' };

      await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

      expect(writeFile).toHaveBeenCalled();
      const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(writtenContent).toContain('tag: v1.0.0');
      expect(writtenContent).not.toContain('extraVolumeMounts');
      expect(writtenContent).not.toContain('mountPath');
    });

    it('should delete nested fields that exist in destination but not in source', async () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'values.yaml',
            sourceContent: 'microservice:\n  image:\n    tag: v2.0.0',
            destinationContent:
              'microservice:\n  image:\n    tag: v1.0.0\n    pullPolicy: Always\n  extraField: removed',
            processedSourceContent: {},
            processedDestContent: {},
            rawParsedSource: { microservice: { image: { tag: 'v2.0.0' } } },
            rawParsedDest: { microservice: { image: { tag: 'v1.0.0', pullPolicy: 'Always' }, extraField: 'removed' } }
          }
        ],
        unchangedFiles: []
      };
      const source = new Map([['values.yaml', 'microservice:\n  image:\n    tag: v2.0.0']]);
      const destination = new Map([
        ['values.yaml', 'microservice:\n  image:\n    tag: v1.0.0\n    pullPolicy: Always\n  extraField: removed']
      ]);
      const config = { source: './src', destination: './dest' };

      await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

      expect(writeFile).toHaveBeenCalled();
      const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
      expect(writtenContent).toContain('tag: v2.0.0');
      expect(writtenContent).not.toContain('pullPolicy');
      expect(writtenContent).not.toContain('extraField');
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

      await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

      expect(writeFile).toHaveBeenCalled();
    });

    it('should skip formatting when skipFormat is true', async () => {
      const diffResult = {
        addedFiles: [createAddedFile('new.yaml')],
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

      await updateFiles(diffResult, source, destination, config, false, true, mockLogger);

      expect(writeFile).toHaveBeenCalled();
    });

    it('should apply formatting when skipFormat is false', async () => {
      const diffResult = {
        addedFiles: [createAddedFile('new.yaml')],
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

      await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

      expect(writeFile).toHaveBeenCalled();
    });

    describe('skipPath array filter preservation', () => {
      it('should preserve array items with [name=value] filter', async () => {
        const diffResult = {
          addedFiles: [],
          deletedFiles: [],
          changedFiles: [
            {
              path: 'values.yaml',
              sourceContent: 'env:\n  - name: DEBUG\n    value: "1"\n  - name: API\n    value: new-value',
              destinationContent: 'env:\n  - name: DEBUG\n    value: prod-debug\n  - name: API\n    value: old-value',
              processedSourceContent: {},
              processedDestContent: {},
              // rawParsedSource has DEBUG filtered out (by skipPath)
              rawParsedSource: { env: [{ name: 'API', value: 'new-value' }] },
              // rawParsedDest has DEBUG filtered out (by skipPath)
              rawParsedDest: { env: [{ name: 'API', value: 'old-value' }] },
              skipPaths: ['env[name=DEBUG]']
            }
          ],
          unchangedFiles: []
        };
        const source = new Map([
          ['values.yaml', 'env:\n  - name: DEBUG\n    value: "1"\n  - name: API\n    value: new-value']
        ]);
        const destination = new Map([
          ['values.yaml', 'env:\n  - name: DEBUG\n    value: prod-debug\n  - name: API\n    value: old-value']
        ]);
        const config = { source: './src', destination: './dest' };

        await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

        expect(writeFile).toHaveBeenCalled();
        const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
        // Should preserve DEBUG from destination
        expect(writtenContent).toContain('DEBUG');
        expect(writtenContent).toContain('prod-debug');
        // Should update API from source
        expect(writtenContent).toContain('API');
        expect(writtenContent).toContain('new-value');
      });

      it('should preserve array items with [name^=prefix] (startsWith) filter', async () => {
        const diffResult = {
          addedFiles: [],
          deletedFiles: [],
          changedFiles: [
            {
              path: 'values.yaml',
              sourceContent:
                'env:\n  - name: DB_HOST\n    value: new-host\n  - name: DB_PORT\n    value: "5432"\n  - name: API\n    value: new-api',
              destinationContent:
                'env:\n  - name: DB_HOST\n    value: prod-host\n  - name: DB_PORT\n    value: "3306"\n  - name: API\n    value: old-api',
              processedSourceContent: {},
              processedDestContent: {},
              // rawParsedSource has DB_* filtered out (by skipPath)
              rawParsedSource: { env: [{ name: 'API', value: 'new-api' }] },
              rawParsedDest: { env: [{ name: 'API', value: 'old-api' }] },
              skipPaths: ['env[name^=DB_]']
            }
          ],
          unchangedFiles: []
        };
        const source = new Map([
          [
            'values.yaml',
            'env:\n  - name: DB_HOST\n    value: new-host\n  - name: DB_PORT\n    value: "5432"\n  - name: API\n    value: new-api'
          ]
        ]);
        const destination = new Map([
          [
            'values.yaml',
            'env:\n  - name: DB_HOST\n    value: prod-host\n  - name: DB_PORT\n    value: "3306"\n  - name: API\n    value: old-api'
          ]
        ]);
        const config = { source: './src', destination: './dest' };

        await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

        expect(writeFile).toHaveBeenCalled();
        const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
        // Should preserve DB_HOST and DB_PORT from destination
        expect(writtenContent).toContain('DB_HOST');
        expect(writtenContent).toContain('prod-host');
        expect(writtenContent).toContain('DB_PORT');
        expect(writtenContent).toContain('3306');
        // Should update API from source
        expect(writtenContent).toContain('API');
        expect(writtenContent).toContain('new-api');
      });

      it('should preserve array items with [name$=suffix] (endsWith) filter', async () => {
        const diffResult = {
          addedFiles: [],
          deletedFiles: [],
          changedFiles: [
            {
              path: 'values.yaml',
              sourceContent:
                'env:\n  - name: API_SECRET\n    value: new-secret\n  - name: DB_SECRET\n    value: new-db-secret\n  - name: DEBUG\n    value: "1"',
              destinationContent:
                'env:\n  - name: API_SECRET\n    value: prod-secret\n  - name: DB_SECRET\n    value: prod-db-secret\n  - name: DEBUG\n    value: "0"',
              processedSourceContent: {},
              processedDestContent: {},
              rawParsedSource: { env: [{ name: 'DEBUG', value: '1' }] },
              rawParsedDest: { env: [{ name: 'DEBUG', value: '0' }] },
              skipPaths: ['env[name$=_SECRET]']
            }
          ],
          unchangedFiles: []
        };
        const source = new Map([
          [
            'values.yaml',
            'env:\n  - name: API_SECRET\n    value: new-secret\n  - name: DB_SECRET\n    value: new-db-secret\n  - name: DEBUG\n    value: "1"'
          ]
        ]);
        const destination = new Map([
          [
            'values.yaml',
            'env:\n  - name: API_SECRET\n    value: prod-secret\n  - name: DB_SECRET\n    value: prod-db-secret\n  - name: DEBUG\n    value: "0"'
          ]
        ]);
        const config = { source: './src', destination: './dest' };

        await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

        expect(writeFile).toHaveBeenCalled();
        const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
        // Should preserve *_SECRET from destination
        expect(writtenContent).toContain('API_SECRET');
        expect(writtenContent).toContain('prod-secret');
        expect(writtenContent).toContain('DB_SECRET');
        expect(writtenContent).toContain('prod-db-secret');
        // Should update DEBUG from source
        expect(writtenContent).toContain('DEBUG');
        expect(writtenContent).toMatch(/value:\s+["']?1/);
      });

      it('should preserve array items with [name*=substring] (contains) filter', async () => {
        const diffResult = {
          addedFiles: [],
          deletedFiles: [],
          changedFiles: [
            {
              path: 'values.yaml',
              sourceContent:
                'env:\n  - name: MY_PASSWORD_HASH\n    value: new-hash\n  - name: PASSWORD\n    value: new-pass\n  - name: API\n    value: new-api',
              destinationContent:
                'env:\n  - name: MY_PASSWORD_HASH\n    value: prod-hash\n  - name: PASSWORD\n    value: prod-pass\n  - name: API\n    value: old-api',
              processedSourceContent: {},
              processedDestContent: {},
              rawParsedSource: { env: [{ name: 'API', value: 'new-api' }] },
              rawParsedDest: { env: [{ name: 'API', value: 'old-api' }] },
              skipPaths: ['env[name*=PASSWORD]']
            }
          ],
          unchangedFiles: []
        };
        const source = new Map([
          [
            'values.yaml',
            'env:\n  - name: MY_PASSWORD_HASH\n    value: new-hash\n  - name: PASSWORD\n    value: new-pass\n  - name: API\n    value: new-api'
          ]
        ]);
        const destination = new Map([
          [
            'values.yaml',
            'env:\n  - name: MY_PASSWORD_HASH\n    value: prod-hash\n  - name: PASSWORD\n    value: prod-pass\n  - name: API\n    value: old-api'
          ]
        ]);
        const config = { source: './src', destination: './dest' };

        await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

        expect(writeFile).toHaveBeenCalled();
        const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
        // Should preserve *PASSWORD* from destination
        expect(writtenContent).toContain('MY_PASSWORD_HASH');
        expect(writtenContent).toContain('prod-hash');
        expect(writtenContent).toContain('PASSWORD');
        expect(writtenContent).toContain('prod-pass');
        // Should update API from source
        expect(writtenContent).toContain('API');
        expect(writtenContent).toContain('new-api');
      });

      it('should preserve multiple items matching same filter pattern', async () => {
        const diffResult = {
          addedFiles: [],
          deletedFiles: [],
          changedFiles: [
            {
              path: 'values.yaml',
              sourceContent:
                'env:\n  - name: SECRET_ONE\n    value: s1\n  - name: SECRET_TWO\n    value: s2\n  - name: PUBLIC\n    value: new',
              destinationContent:
                'env:\n  - name: SECRET_ONE\n    value: prod-s1\n  - name: SECRET_TWO\n    value: prod-s2\n  - name: PUBLIC\n    value: old',
              processedSourceContent: {},
              processedDestContent: {},
              rawParsedSource: { env: [{ name: 'PUBLIC', value: 'new' }] },
              rawParsedDest: { env: [{ name: 'PUBLIC', value: 'old' }] },
              skipPaths: ['env[name^=SECRET_]']
            }
          ],
          unchangedFiles: []
        };
        const source = new Map([
          [
            'values.yaml',
            'env:\n  - name: SECRET_ONE\n    value: s1\n  - name: SECRET_TWO\n    value: s2\n  - name: PUBLIC\n    value: new'
          ]
        ]);
        const destination = new Map([
          [
            'values.yaml',
            'env:\n  - name: SECRET_ONE\n    value: prod-s1\n  - name: SECRET_TWO\n    value: prod-s2\n  - name: PUBLIC\n    value: old'
          ]
        ]);
        const config = { source: './src', destination: './dest' };

        await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

        expect(writeFile).toHaveBeenCalled();
        const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
        // Should preserve both SECRET_* from destination
        expect(writtenContent).toContain('SECRET_ONE');
        expect(writtenContent).toContain('prod-s1');
        expect(writtenContent).toContain('SECRET_TWO');
        expect(writtenContent).toContain('prod-s2');
        // Should update PUBLIC from source
        expect(writtenContent).toContain('PUBLIC');
        expect(writtenContent).toContain('new');
      });

      it('should preserve item only in destination if matches filter', async () => {
        const diffResult = {
          addedFiles: [],
          deletedFiles: [],
          changedFiles: [
            {
              path: 'values.yaml',
              sourceContent: 'env:\n  - name: API\n    value: new-api',
              destinationContent:
                'env:\n  - name: SECRET_KEY\n    value: prod-secret\n  - name: API\n    value: old-api',
              processedSourceContent: {},
              processedDestContent: {},
              // Source doesn't have SECRET_KEY, rawParsedSource shows only API
              rawParsedSource: { env: [{ name: 'API', value: 'new-api' }] },
              rawParsedDest: { env: [{ name: 'API', value: 'old-api' }] },
              skipPaths: ['env[name^=SECRET_]']
            }
          ],
          unchangedFiles: []
        };
        const source = new Map([['values.yaml', 'env:\n  - name: API\n    value: new-api']]);
        const destination = new Map([
          ['values.yaml', 'env:\n  - name: SECRET_KEY\n    value: prod-secret\n  - name: API\n    value: old-api']
        ]);
        const config = { source: './src', destination: './dest' };

        await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

        expect(writeFile).toHaveBeenCalled();
        const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
        // Should preserve SECRET_KEY from destination (even though not in source)
        expect(writtenContent).toContain('SECRET_KEY');
        expect(writtenContent).toContain('prod-secret');
        // Should update API from source
        expect(writtenContent).toContain('API');
        expect(writtenContent).toContain('new-api');
      });

      it('should handle nested skipPath in array items', async () => {
        const diffResult = {
          addedFiles: [],
          deletedFiles: [],
          changedFiles: [
            {
              path: 'values.yaml',
              sourceContent:
                'containers:\n  - name: app\n    image: new-image\n    resources:\n      limits:\n        memory: 512Mi',
              destinationContent:
                'containers:\n  - name: app\n    image: old-image\n    resources:\n      limits:\n        memory: 1Gi',
              processedSourceContent: {},
              processedDestContent: {},
              rawParsedSource: { containers: [{ name: 'app', image: 'new-image' }] },
              rawParsedDest: { containers: [{ name: 'app', image: 'old-image' }] },
              skipPaths: ['containers[name=app].resources']
            }
          ],
          unchangedFiles: []
        };
        const source = new Map([
          [
            'values.yaml',
            'containers:\n  - name: app\n    image: new-image\n    resources:\n      limits:\n        memory: 512Mi'
          ]
        ]);
        const destination = new Map([
          [
            'values.yaml',
            'containers:\n  - name: app\n    image: old-image\n    resources:\n      limits:\n        memory: 1Gi'
          ]
        ]);
        const config = { source: './src', destination: './dest' };

        await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

        expect(writeFile).toHaveBeenCalled();
        const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
        // Should update image from source
        expect(writtenContent).toContain('new-image');
        // Should preserve resources from destination
        expect(writtenContent).toContain('1Gi');
      });
    });

    describe('fixedValues', () => {
      it('should apply fixedValues to changed files', async () => {
        const diffResult = {
          addedFiles: [],
          deletedFiles: [],
          changedFiles: [
            {
              path: 'values.yaml',
              sourceContent: 'version: 1.0.0\nreplicas: 1',
              destinationContent: 'version: 0.9.0\nreplicas: 1',
              processedSourceContent: {},
              processedDestContent: {},
              rawParsedSource: { version: '1.0.0', replicas: 1 },
              rawParsedDest: { version: '0.9.0', replicas: 1 }
            }
          ],
          unchangedFiles: []
        };
        const source = new Map([['values.yaml', 'version: 1.0.0\nreplicas: 1']]);
        const destination = new Map([['values.yaml', 'version: 0.9.0\nreplicas: 1']]);
        const config = {
          source: './src',
          destination: './dest',
          fixedValues: {
            '*.yaml': [{ path: 'replicas', value: 3 }]
          }
        };

        await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

        expect(writeFile).toHaveBeenCalled();
        const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
        expect(writtenContent).toContain('replicas: 3');
        expect(writtenContent).toContain('version: 1.0.0');
      });

      it('should apply fixedValues to added files', async () => {
        const diffResult = {
          addedFiles: [createAddedFile('new.yaml')],
          deletedFiles: [],
          changedFiles: [],
          unchangedFiles: []
        };
        const source = new Map([['new.yaml', 'debug: true\nlogLevel: debug']]);
        const destination = new Map();
        const config = {
          source: './src',
          destination: './dest',
          fixedValues: {
            '*.yaml': [
              { path: 'debug', value: false },
              { path: 'logLevel', value: 'info' }
            ]
          }
        };

        await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

        expect(writeFile).toHaveBeenCalled();
        const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
        expect(writtenContent).toContain('debug: false');
        expect(writtenContent).toContain('logLevel: info');
      });

      it('should apply fixedValues with array filter', async () => {
        const diffResult = {
          addedFiles: [],
          deletedFiles: [],
          changedFiles: [
            {
              path: 'values.yaml',
              sourceContent: 'env:\n  - name: LOG_LEVEL\n    value: debug',
              destinationContent: 'env:\n  - name: LOG_LEVEL\n    value: warn',
              processedSourceContent: {},
              processedDestContent: {},
              rawParsedSource: { env: [{ name: 'LOG_LEVEL', value: 'debug' }] },
              rawParsedDest: { env: [{ name: 'LOG_LEVEL', value: 'warn' }] }
            }
          ],
          unchangedFiles: []
        };
        const source = new Map([['values.yaml', 'env:\n  - name: LOG_LEVEL\n    value: debug']]);
        const destination = new Map([['values.yaml', 'env:\n  - name: LOG_LEVEL\n    value: warn']]);
        const config = {
          source: './src',
          destination: './dest',
          fixedValues: {
            '*.yaml': [{ path: 'env[name=LOG_LEVEL].value', value: 'info' }]
          }
        };

        await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

        expect(writeFile).toHaveBeenCalled();
        const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
        expect(writtenContent).toContain('value: info');
      });

      it('should apply fixedValues after merge with skipPath', async () => {
        const diffResult = {
          addedFiles: [],
          deletedFiles: [],
          changedFiles: [
            {
              path: 'values.yaml',
              sourceContent: 'version: 2.0.0\nenv:\n  - name: DEBUG\n    value: "1"\n  - name: LOG\n    value: new',
              destinationContent:
                'version: 1.0.0\nenv:\n  - name: DEBUG\n    value: prod-debug\n  - name: LOG\n    value: old',
              processedSourceContent: {},
              processedDestContent: {},
              // DEBUG is filtered by skipPath
              rawParsedSource: { version: '2.0.0', env: [{ name: 'LOG', value: 'new' }] },
              rawParsedDest: { version: '1.0.0', env: [{ name: 'LOG', value: 'old' }] },
              skipPaths: ['env[name=DEBUG]']
            }
          ],
          unchangedFiles: []
        };
        const source = new Map([
          ['values.yaml', 'version: 2.0.0\nenv:\n  - name: DEBUG\n    value: "1"\n  - name: LOG\n    value: new']
        ]);
        const destination = new Map([
          ['values.yaml', 'version: 1.0.0\nenv:\n  - name: DEBUG\n    value: prod-debug\n  - name: LOG\n    value: old']
        ]);
        const config = {
          source: './src',
          destination: './dest',
          fixedValues: {
            '*.yaml': [{ path: 'env[name=LOG].value', value: 'fixed-log' }]
          }
        };

        await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

        expect(writeFile).toHaveBeenCalled();
        const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
        // Should preserve DEBUG from destination (skipPath)
        expect(writtenContent).toContain('DEBUG');
        expect(writtenContent).toContain('prod-debug');
        // Should apply fixedValue to LOG
        expect(writtenContent).toContain('fixed-log');
        // Should update version from source
        expect(writtenContent).toContain('version: 2.0.0');
      });

      it('should silently skip non-existent fixedValue paths', async () => {
        const diffResult = {
          addedFiles: [],
          deletedFiles: [],
          changedFiles: [
            {
              path: 'values.yaml',
              sourceContent: 'existing: value',
              destinationContent: 'existing: old-value',
              processedSourceContent: {},
              processedDestContent: {},
              rawParsedSource: { existing: 'value' },
              rawParsedDest: { existing: 'old-value' }
            }
          ],
          unchangedFiles: []
        };
        const source = new Map([['values.yaml', 'existing: value']]);
        const destination = new Map([['values.yaml', 'existing: old-value']]);
        const config = {
          source: './src',
          destination: './dest',
          fixedValues: {
            '*.yaml': [{ path: 'nonexistent.nested.path', value: 'ignored' }]
          }
        };

        // Should not throw
        await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

        expect(writeFile).toHaveBeenCalled();
        const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
        expect(writtenContent).toContain('existing: value');
        expect(writtenContent).not.toContain('ignored');
      });

      it('should apply fixedValues only to matching file patterns', async () => {
        const diffResult = {
          addedFiles: [],
          deletedFiles: [],
          changedFiles: [
            {
              path: 'values-prod.yaml',
              sourceContent: 'debug: true',
              destinationContent: 'debug: true',
              processedSourceContent: {},
              processedDestContent: {},
              rawParsedSource: { debug: true },
              rawParsedDest: { debug: true }
            }
          ],
          unchangedFiles: []
        };
        const source = new Map([['values-prod.yaml', 'debug: true']]);
        const destination = new Map([['values-prod.yaml', 'debug: true']]);
        const config = {
          source: './src',
          destination: './dest',
          fixedValues: {
            'values-prod.yaml': [{ path: 'debug', value: false }]
          }
        };

        await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

        expect(writeFile).toHaveBeenCalled();
        const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
        expect(writtenContent).toContain('debug: false');
      });

      it('should apply multiple fixedValues rules in order', async () => {
        const diffResult = {
          addedFiles: [createAddedFile('test.yaml')],
          deletedFiles: [],
          changedFiles: [],
          unchangedFiles: []
        };
        const source = new Map([['test.yaml', 'value: original']]);
        const destination = new Map();
        const config = {
          source: './src',
          destination: './dest',
          fixedValues: {
            '*.yaml': [
              { path: 'value', value: 'first' },
              { path: 'value', value: 'second' },
              { path: 'value', value: 'final' }
            ]
          }
        };

        await updateFiles(diffResult, source, destination, config, false, false, mockLogger);

        expect(writeFile).toHaveBeenCalled();
        const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
        expect(writtenContent).toContain('value: final');
      });
    });
  });
});
