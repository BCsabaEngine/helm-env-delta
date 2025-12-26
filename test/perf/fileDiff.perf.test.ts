import { bench, describe } from 'vitest';
import * as YAML from 'yaml';

import { computeFileDiff } from '../../src/fileDiff';
import { deepEqual } from '../../src/utils/deepEqual';
import { normalizeForComparison } from '../../src/utils/serialization';
import { generateFileMap, generateYaml } from './fixtures/dataGenerator';

describe('fileDiff performance', () => {
  describe('YAML parsing and comparison pipeline', () => {
    // Small files (1-5KB) - quick baseline
    const sourceSmall = generateFileMap(100, { size: 'small', complexity: 'flat' });
    const destinationSmall = new Map(sourceSmall);

    // Medium files (~10-50KB) - moderate workload
    const sourceMedium = generateFileMap(50, { size: 'medium', complexity: 'nested' });
    const destinationMedium = generateFileMap(50, { size: 'medium', complexity: 'nested' });

    // Realistic files (~100-200KB) - typical production size
    const sourceRealistic = generateFileMap(20, { size: 'realistic', complexity: 'nested' });
    const destinationRealistic = generateFileMap(20, { size: 'realistic', complexity: 'nested' });

    bench(
      'yaml-parse-compare-100-files-50kb',
      () => {
        const config = { source: './src', destination: './dest' };
        computeFileDiff(sourceMedium, destinationMedium, config);
      },
      { iterations: 10, time: 1000 }
    );

    bench(
      'yaml-parse-compare-1000-files-1kb',
      () => {
        const config = { source: './src', destination: './dest' };
        computeFileDiff(sourceSmall, destinationSmall, config);
      },
      { iterations: 5, time: 1000 }
    );

    bench(
      'yaml-parse-compare-50-files-with-transforms',
      () => {
        const source = generateFileMap(50, { size: 'medium', complexity: 'nested' });
        const destination = generateFileMap(50, { size: 'medium', complexity: 'nested' });
        const config = {
          source: './src',
          destination: './dest',
          transforms: {
            '**/*.yaml': {
              content: [
                { find: 'uat-', replace: 'prod-' },
                { find: String.raw`\.uat\.`, replace: '.prod.' }
              ]
            }
          },
          skipPath: {
            '**/*.yaml': ['metadata.namespace', 'spec.replicas']
          }
        };

        computeFileDiff(source, destination, config);
      },
      { iterations: 10, time: 1000 }
    );

    bench(
      'yaml-parse-compare-20-files-realistic',
      () => {
        const config = { source: './src', destination: './dest' };
        computeFileDiff(sourceRealistic, destinationRealistic, config);
      },
      { iterations: 10, time: 1000 }
    );
  });

  describe('Bottleneck isolation', () => {
    bench(
      'bottleneck-yaml-parse-100x50kb',
      () => {
        const yaml = generateYaml({ size: 'medium', complexity: 'nested' });

        for (let index = 0; index < 50; index++) YAML.parse(yaml);
      },
      { iterations: 10, time: 1000 }
    );

    bench(
      'bottleneck-structuredClone-deep-object',
      () => {
        const yaml = generateYaml({ size: 'medium', complexity: 'nested' });
        const object = YAML.parse(yaml);

        for (let index = 0; index < 50; index++) structuredClone(object);
      },
      { iterations: 10, time: 1000 }
    );

    bench(
      'bottleneck-normalize-100-objects',
      () => {
        const yaml = generateYaml({ size: 'medium', complexity: 'nested' });
        const object = YAML.parse(yaml);
        const objects = Array.from({ length: 20 }).map(() => structuredClone(object));

        for (const object of objects) normalizeForComparison(object);
      },
      { iterations: 10, time: 1000 }
    );

    bench(
      'bottleneck-deepEqual-100-objects',
      () => {
        const yaml = generateYaml({ size: 'medium', complexity: 'nested' });
        const object1 = YAML.parse(yaml);
        const object2 = structuredClone(object1);
        const normalized1 = normalizeForComparison(object1);
        const normalized2 = normalizeForComparison(object2);

        for (let index = 0; index < 50; index++) deepEqual(normalized1, normalized2);
      },
      { iterations: 10, time: 1000 }
    );
  });
});
