import { bench, describe } from 'vitest';

import { formatYaml } from '../../src/yamlFormatter';
import { generateYaml } from './fixtures/dataGenerator';

describe('yamlFormatter performance', () => {
  describe('Key ordering', () => {
    bench('format-50kb-key-ordering', () => {
      const yaml = generateYaml({ size: 'medium', complexity: 'nested' });
      const outputFormat = {
        keyOrders: {
          '**/*.yaml': ['apiVersion', 'kind', 'metadata', 'spec']
        }
      };

      formatYaml(yaml, 'test.yaml', outputFormat);
    });

    bench('format-5mb-key-ordering', () => {
      const yaml = generateYaml({ size: 'large', complexity: 'deep' });
      const outputFormat = {
        keyOrders: {
          '**/*.yaml': ['apiVersion', 'kind', 'metadata', 'spec', 'status']
        }
      };

      formatYaml(yaml, 'test.yaml', outputFormat);
    });
  });

  describe('Array sorting', () => {
    bench('format-array-sort-100-elements', () => {
      const yaml = generateYaml({
        size: 'medium',
        complexity: 'flat',
        arraySize: 50
      });
      const outputFormat = {
        arraySort: {
          '**/*.yaml': [{ path: 'microservice.env', sortBy: 'name', order: 'asc' as const }]
        }
      };

      formatYaml(yaml, 'test.yaml', outputFormat);
    });

    bench('format-array-sort-1000-elements', () => {
      const yaml = generateYaml({
        size: 'large',
        complexity: 'flat',
        arraySize: 200
      });
      const outputFormat = {
        arraySort: {
          '**/*.yaml': [{ path: 'microservice.env', sortBy: 'name', order: 'asc' as const }]
        }
      };

      formatYaml(yaml, 'test.yaml', outputFormat);
    });
  });

  describe('Value quoting', () => {
    bench('format-value-quote-50kb', () => {
      const yaml = generateYaml({ size: 'medium', complexity: 'nested' });
      const outputFormat = {
        quoteValues: {
          '**/*.yaml': ['**']
        }
      };

      formatYaml(yaml, 'test.yaml', outputFormat);
    });
  });

  describe('Combined formatting', () => {
    bench('format-combined-50kb', () => {
      const yaml = generateYaml({ size: 'medium', complexity: 'nested' });
      const outputFormat = {
        indent: 2,
        keySeparator: true,
        keyOrders: {
          '**/*.yaml': ['apiVersion', 'kind', 'metadata', 'spec']
        },
        arraySort: {
          '**/*.yaml': [{ path: 'microservice.env', sortBy: 'name', order: 'asc' as const }]
        },
        quoteValues: {
          '**/*.yaml': ['microservice.env[*].value']
        }
      };

      formatYaml(yaml, 'test.yaml', outputFormat);
    });
  });
});
