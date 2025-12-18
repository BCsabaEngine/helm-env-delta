import { describe, expect, it } from 'vitest';

import type { TransformRule } from '../../src/configFile';
import { applyTransforms, getTransformsForFile } from '../../src/utils/transformer';

describe('utils/transformer', () => {
  describe('applyTransforms', () => {
    describe('string value transformations', () => {
      it('should transform string values in flat object', () => {
        const data = { url: 'uat-db.internal', name: 'test' };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: 'uat-', replace: 'prod-' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({ url: 'prod-db.internal', name: 'test' });
      });

      it('should transform string values in nested objects', () => {
        const data = { database: { url: 'uat-db.internal', port: 5432 } };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: 'uat-db', replace: 'prod-db' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({ database: { url: 'prod-db.internal', port: 5432 } });
      });

      it('should transform string values in arrays', () => {
        const data = { urls: ['uat-db.internal', 'uat-redis.internal'] };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: 'uat-', replace: 'prod-' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({ urls: ['prod-db.internal', 'prod-redis.internal'] });
      });

      it('should transform multiple string values in same object', () => {
        const data = { db: 'uat-db', cache: 'uat-redis', queue: 'uat-mq' };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: 'uat-', replace: 'prod-' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({ db: 'prod-db', cache: 'prod-redis', queue: 'prod-mq' });
      });

      it('should transform deeply nested structures', () => {
        const data = {
          level1: {
            level2: {
              level3: {
                url: 'uat-db.internal'
              }
            }
          }
        };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: 'uat-', replace: 'prod-' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({
          level1: {
            level2: {
              level3: {
                url: 'prod-db.internal'
              }
            }
          }
        });
      });
    });

    describe('multiple transform rules', () => {
      it('should apply multiple transform rules sequentially', () => {
        const data = { url: 'uat-db-primary.internal' };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [
            { find: 'uat-', replace: 'prod-' },
            { find: '-primary', replace: '-master' }
          ]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({ url: 'prod-db-master.internal' });
      });

      it('should apply rules in order (chained transformations)', () => {
        const data = { version: 'v1/alpha' };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [
            { find: 'v1/alpha', replace: 'v1/beta' },
            { find: 'v1/beta', replace: 'v1' }
          ]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({ version: 'v1' });
      });
    });

    describe('regex features', () => {
      it('should support regex capture groups', () => {
        const data = { url: 'uat-db.postgres.internal' };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: String.raw`uat-db\.(.+)\.internal`, replace: 'prod-db.$1.internal' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({ url: 'prod-db.postgres.internal' });
      });

      it('should support multiple capture groups', () => {
        const data = { url: 'uat-db-postgres-primary.internal' };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: String.raw`uat-(\w+)-(\w+)-(\w+)`, replace: 'prod-$1-$2-$3' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({ url: 'prod-db-postgres-primary.internal' });
      });

      it('should support global regex replacement (multiple matches in same string)', () => {
        const data = { text: 'uat-db and uat-redis and uat-mq' };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: 'uat-', replace: 'prod-' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({ text: 'prod-db and prod-redis and prod-mq' });
      });

      it('should support case-sensitive regex by default', () => {
        const data = { level: 'DEBUG', defaultLevel: 'debug', logLevel: 'Debug' };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: 'debug', replace: 'info' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({ level: 'DEBUG', defaultLevel: 'info', logLevel: 'Debug' });
      });

      it('should handle special regex characters when escaped', () => {
        const data = { url: 'uat-db.internal' };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: String.raw`uat-db\.internal`, replace: 'prod-db.internal' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({ url: 'prod-db.internal' });
      });

      it('should support empty replace string (deletion)', () => {
        const data = { name: 'test-uat' };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: '-uat$', replace: '' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({ name: 'test' });
      });
    });

    describe('key preservation', () => {
      it('should preserve keys and only transform values', () => {
        const data = { 'uat-key': 'uat-value' };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: 'uat-', replace: 'prod-' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({ 'uat-key': 'prod-value' });
      });

      it('should preserve nested object keys', () => {
        const data = {
          'uat-database': {
            'uat-url': 'uat-db.internal'
          }
        };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: 'uat-', replace: 'prod-' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({
          'uat-database': {
            'uat-url': 'prod-db.internal'
          }
        });
      });
    });

    describe('type preservation', () => {
      it('should preserve non-string types (numbers, booleans, null)', () => {
        const data = {
          count: 42,
          enabled: true,
          disabled: false,
          empty: undefined,
          text: 'uat-db'
        };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: 'uat-', replace: 'prod-' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({
          count: 42,
          enabled: true,
          disabled: false,
          empty: undefined,
          text: 'prod-db'
        });
      });

      it('should preserve numbers in arrays', () => {
        const data = { ports: [8080, 8081, 8082] };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: 'test', replace: 'production' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({ ports: [8080, 8081, 8082] });
      });

      it('should preserve mixed type arrays', () => {
        const data = { mixed: ['uat-db', 123, true, undefined, 'uat-redis'] };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: 'uat-', replace: 'prod-' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({ mixed: ['prod-db', 123, true, undefined, 'prod-redis'] });
      });
    });

    describe('edge cases', () => {
      it('should handle empty objects', () => {
        const data = {};
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: 'uat-', replace: 'prod-' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({});
      });

      it('should handle empty arrays', () => {
        const data = { items: [] };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: 'uat-', replace: 'prod-' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({ items: [] });
      });

      it('should handle empty strings', () => {
        const data = { empty: '', notEmpty: 'uat-db' };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: 'uat-', replace: 'prod-' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({ empty: '', notEmpty: 'prod-db' });
      });

      it('should return original data when no transforms match file', () => {
        const data = { url: 'uat-db.internal' };
        const transforms: Record<string, TransformRule[]> = {
          'other.yaml': [{ find: 'uat-', replace: 'prod-' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toBe(data);
      });

      it('should return original data when transforms is undefined', () => {
        const data = { url: 'uat-db.internal' };

        const result = applyTransforms(data, 'test.yaml');

        expect(result).toBe(data);
      });

      it('should handle objects with arrays of objects', () => {
        const data = {
          services: [
            { name: 'db', url: 'uat-db.internal' },
            { name: 'cache', url: 'uat-redis.internal' }
          ]
        };
        const transforms: Record<string, TransformRule[]> = {
          'test.yaml': [{ find: 'uat-', replace: 'prod-' }]
        };

        const result = applyTransforms(data, 'test.yaml', transforms);

        expect(result).toEqual({
          services: [
            { name: 'db', url: 'prod-db.internal' },
            { name: 'cache', url: 'prod-redis.internal' }
          ]
        });
      });
    });
  });

  describe('getTransformsForFile', () => {
    it('should return rules for matching pattern', () => {
      const transforms: Record<string, TransformRule[]> = {
        '*.yaml': [{ find: 'uat-', replace: 'prod-' }]
      };

      const rules = getTransformsForFile('test.yaml', transforms);

      expect(rules).toEqual([{ find: 'uat-', replace: 'prod-' }]);
    });

    it('should return empty array when no patterns match', () => {
      const transforms: Record<string, TransformRule[]> = {
        '*.json': [{ find: 'uat-', replace: 'prod-' }]
      };

      const rules = getTransformsForFile('test.yaml', transforms);

      expect(rules).toEqual([]);
    });

    it('should combine rules from multiple matching patterns', () => {
      const transforms: Record<string, TransformRule[]> = {
        '*.yaml': [{ find: 'uat-', replace: 'prod-' }],
        'test.*': [{ find: 'debug', replace: 'info' }]
      };

      const rules = getTransformsForFile('test.yaml', transforms);

      expect(rules).toEqual([
        { find: 'uat-', replace: 'prod-' },
        { find: 'debug', replace: 'info' }
      ]);
    });

    it('should support glob wildcards (**/*.yaml)', () => {
      const transforms: Record<string, TransformRule[]> = {
        'svc/**/*.yaml': [{ find: 'uat-', replace: 'prod-' }]
      };

      const rules1 = getTransformsForFile('svc/app/values.yaml', transforms);
      const rules2 = getTransformsForFile('svc/db/Chart.yaml', transforms);
      const rules3 = getTransformsForFile('other/test.yaml', transforms);

      expect(rules1).toEqual([{ find: 'uat-', replace: 'prod-' }]);
      expect(rules2).toEqual([{ find: 'uat-', replace: 'prod-' }]);
      expect(rules3).toEqual([]);
    });

    it('should return empty array when transforms undefined', () => {
      const rules = getTransformsForFile('test.yaml');

      expect(rules).toEqual([]);
    });

    it('should match exact file paths', () => {
      const transforms: Record<string, TransformRule[]> = {
        'config/prod.yaml': [{ find: 'uat-', replace: 'prod-' }]
      };

      const rules1 = getTransformsForFile('config/prod.yaml', transforms);
      const rules2 = getTransformsForFile('config/uat.yaml', transforms);

      expect(rules1).toEqual([{ find: 'uat-', replace: 'prod-' }]);
      expect(rules2).toEqual([]);
    });

    it('should preserve rule order from multiple patterns', () => {
      const transforms: Record<string, TransformRule[]> = {
        '*.yaml': [{ find: 'first', replace: 'FIRST' }],
        'test.*': [{ find: 'second', replace: 'SECOND' }],
        'test.yaml': [{ find: 'third', replace: 'THIRD' }]
      };

      const rules = getTransformsForFile('test.yaml', transforms);

      expect(rules.length).toBe(3);
      expect(rules[0].find).toBe('first');
      expect(rules[1].find).toBe('second');
      expect(rules[2].find).toBe('third');
    });
  });
});
