import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { bench, describe } from 'vitest';

import { loadFiles } from '../../src/fileLoader';
import { generateYaml } from './fixtures/dataGenerator';

const createFileStructure = async (baseDirectory: string, fileCount: number): Promise<void> => {
  const directoriesPerLevel = 3;
  const filesPerDirectory = Math.ceil(fileCount / directoriesPerLevel ** 3);

  for (let d1 = 0; d1 < directoriesPerLevel; d1++)
    for (let d2 = 0; d2 < directoriesPerLevel; d2++)
      for (let d3 = 0; d3 < directoriesPerLevel; d3++) {
        const directory = path.join(baseDirectory, `dir${d1}`, `subdir${d2}`, `leaf${d3}`);
        await mkdir(directory, { recursive: true });

        for (let file = 0; file < filesPerDirectory; file++)
          await writeFile(
            path.join(directory, `file-${file}.yaml`),
            'apiVersion: v1\nkind: Service\nmetadata:\n  name: test\n'
          );
      }
};

const createTemporaryFiles = async (count: number, size: string): Promise<string> => {
  const temporaryDirectory = path.join(tmpdir(), `perf-test-${Date.now()}-${Math.random()}`);
  await mkdir(temporaryDirectory, { recursive: true });

  const sizeOptions = {
    '1KB': { size: 'small' as const, complexity: 'flat' as const },
    '50KB': { size: 'medium' as const, complexity: 'nested' as const }
  };

  const options = sizeOptions[size as keyof typeof sizeOptions] || sizeOptions['1KB'];

  for (let index = 0; index < count; index++) {
    const content = generateYaml(options);
    await writeFile(path.join(temporaryDirectory, `file-${index}.yaml`), content);
  }

  return temporaryDirectory;
};

describe('fileLoader performance', () => {
  describe('Glob matching', () => {
    bench('glob-1000-files', async () => {
      const temporaryDirectory = path.join(tmpdir(), `perf-test-${Date.now()}-${Math.random()}`);
      await createFileStructure(temporaryDirectory, 100);

      await loadFiles({
        baseDirectory: temporaryDirectory,
        include: ['**/*.yaml'],
        exclude: []
      });

      await rm(temporaryDirectory, { recursive: true, force: true });
    });
  });

  describe('Parallel file reading', () => {
    bench('parallel-read-100-files-50kb', async () => {
      const temporaryDirectory = await createTemporaryFiles(20, '50KB');

      await loadFiles({
        baseDirectory: temporaryDirectory,
        include: ['**/*.yaml'],
        exclude: []
      });

      await rm(temporaryDirectory, { recursive: true, force: true });
    });

    bench('parallel-read-1000-files-1kb', async () => {
      const temporaryDirectory = await createTemporaryFiles(50, '1KB');

      await loadFiles({
        baseDirectory: temporaryDirectory,
        include: ['**/*.yaml'],
        exclude: []
      });

      await rm(temporaryDirectory, { recursive: true, force: true });
    });
  });

  describe('Filename transforms', () => {
    bench('filename-transforms-1000-files', async () => {
      const temporaryDirectory = await createTemporaryFiles(50, '1KB');

      await loadFiles({
        baseDirectory: temporaryDirectory,
        include: ['**/*.yaml'],
        exclude: [],
        transforms: {
          '**/*.yaml': {
            filename: [
              { find: 'envs/uat/', replace: 'envs/prod/' },
              { find: String.raw`-uat\.`, replace: '-prod.' },
              { find: '/uat/', replace: '/prod/' },
              { find: 'config/staging/', replace: 'config/production/' },
              { find: String.raw`\.dev\.`, replace: '.prod.' }
            ]
          }
        }
      });

      await rm(temporaryDirectory, { recursive: true, force: true });
    });
  });
});
