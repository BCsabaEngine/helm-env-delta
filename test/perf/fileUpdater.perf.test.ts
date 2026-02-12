import { bench, describe } from 'vitest';
import * as YAML from 'yaml';

import type { AddedFile } from '../../src/pipeline/fileDiff';
import { updateFiles } from '../../src/pipeline/fileUpdater';
import { generateFileMap } from './fixtures/dataGenerator';

const generateDiffResult = (source: Map<string, string>, destination: Map<string, string>) => {
  const changedFiles = [];

  for (const [path, sourceContent] of source) {
    const destinationContent = destination.get(path);
    if (destinationContent)
      changedFiles.push({
        path,
        sourceContent,
        destinationContent,
        processedSourceContent: YAML.parse(sourceContent),
        processedDestContent: YAML.parse(destinationContent)
      });
  }

  return {
    addedFiles: [] as AddedFile[],
    deletedFiles: [] as string[],
    changedFiles,
    unchangedFiles: [] as string[]
  };
};

describe('fileUpdater performance', () => {
  describe('Deep merge operations', () => {
    bench('deep-merge-100-files-50kb', async () => {
      const source = generateFileMap(20, { size: 'medium', complexity: 'nested' });
      const destination = generateFileMap(20, { size: 'medium', complexity: 'nested' });
      const config = { source: './src', destination: './dest' };
      const diff = generateDiffResult(source, destination);

      await updateFiles('./dest', diff, config, true);
    });

    bench('deep-merge-preserve-skipped-100-files', async () => {
      const source = generateFileMap(20, { size: 'medium', complexity: 'nested' });
      const destination = generateFileMap(20, { size: 'medium', complexity: 'nested' });
      const config = {
        source: './src',
        destination: './dest',
        skipPath: {
          '**/*.yaml': ['metadata.namespace', 'spec.replicas', 'microservice.env[*].value']
        }
      };
      const diff = generateDiffResult(source, destination);

      await updateFiles('./dest', diff, config, true);
    });
  });

  describe('File write performance', () => {
    bench('write-1000-unchanged-files', async () => {
      const source = generateFileMap(50, { size: 'small', complexity: 'flat' });
      const diff = {
        addedFiles: [] as AddedFile[],
        deletedFiles: [] as string[],
        changedFiles: [],
        unchangedFiles: [...source.keys()]
      };
      const config = {
        source: './src',
        destination: './dest',
        outputFormat: {
          indent: 2,
          keySeparator: true,
          keyOrders: {
            '**/*.yaml': ['apiVersion', 'kind', 'metadata', 'spec']
          }
        }
      };

      await updateFiles('./dest', diff, config, true);
    });
  });
});
