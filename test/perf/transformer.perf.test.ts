import { bench, describe } from 'vitest';

import { applyTransforms } from '../../src/utils/transformer';
import { generateNestedObject } from './fixtures/dataGenerator';

describe('transformer performance', () => {
  describe('Regex transforms', () => {
    bench('transform-5-rules-100-values', () => {
      const data = generateNestedObject(4, 10);
      const transforms = {
        '**/*.yaml': {
          content: [
            { find: 'uat-db', replace: 'prod-db' },
            { find: String.raw`\.uat\.`, replace: '.prod.' },
            { find: String.raw`-uat\b`, replace: '-prod' },
            { find: 'staging-', replace: 'production-' },
            { find: String.raw`/v0\./`, replace: '/v1/' }
          ]
        }
      };

      applyTransforms(data, 'test.yaml', transforms);
    });

    bench('transform-10-complex-regex', () => {
      const data = generateNestedObject(5, 8);
      const transforms = {
        '**/*.yaml': {
          content: [
            { find: String.raw`(uat)-db\.(.+)\.internal`, replace: 'prod-db.$2.internal' },
            { find: String.raw`url: https?://(.+)\.uat\.(.+)`, replace: 'url: https://$1.prod.$2' },
            { find: String.raw`image: (.+):(v[0-9]+)\.(uat|staging)`, replace: 'image: $1:$2.prod' },
            { find: 'namespace: (.+)-uat', replace: 'namespace: $1-prod' },
            { find: 'replica-(.+)-uat', replace: 'replica-$1-prod' },
            { find: 'service-(.+)-staging', replace: 'service-$1-production' },
            { find: 'config-(.+)-dev', replace: 'config-$1-prod' },
            { find: 'endpoint-(.+)-test', replace: 'endpoint-$1-prod' },
            { find: String.raw`db-(.+)-uat\.(.+)`, replace: 'db-$1-prod.$2' },
            { find: 'cache-(.+)-staging', replace: 'cache-$1-prod' }
          ]
        }
      };

      applyTransforms(data, 'test.yaml', transforms);
    });
  });

  describe('Deep traversal', () => {
    bench('transform-deep-10-levels-500-values', () => {
      const data = generateNestedObject(8, 3);
      const transforms = {
        '**/*.yaml': {
          content: [{ find: 'old-value', replace: 'new-value' }]
        }
      };

      applyTransforms(data, 'test.yaml', transforms);
    });

    bench('transform-wide-3-levels-1000-values', () => {
      const data = generateNestedObject(3, 20);
      const transforms = {
        '**/*.yaml': {
          content: [
            { find: 'pattern-1', replace: 'replacement-1' },
            { find: 'pattern-2', replace: 'replacement-2' }
          ]
        }
      };

      applyTransforms(data, 'test.yaml', transforms);
    });
  });
});
