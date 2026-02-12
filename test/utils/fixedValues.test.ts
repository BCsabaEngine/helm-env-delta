import { describe, expect, it } from 'vitest';

import type { FixedValueConfig, FixedValueRule } from '../../src/config/configFile';
import { applyFixedValues, getFixedValuesForFile, setValueAtPath } from '../../src/utils/fixedValues';
import { parseJsonPath } from '../../src/utils/jsonPath';

describe('utils/fixedValues', () => {
  describe('getFixedValuesForFile', () => {
    it('should return empty array when fixedValues is undefined', () => {
      expect(getFixedValuesForFile('test.yaml')).toEqual([]);
    });

    it('should return empty array when no patterns match', () => {
      const fixedValues: FixedValueConfig = {
        '*.json': [{ path: 'key', value: 'value' }]
      };
      expect(getFixedValuesForFile('test.yaml', fixedValues)).toEqual([]);
    });

    it('should return rules for matching pattern', () => {
      const fixedValues: FixedValueConfig = {
        '*.yaml': [{ path: 'key', value: 'value' }]
      };
      expect(getFixedValuesForFile('test.yaml', fixedValues)).toEqual([{ path: 'key', value: 'value' }]);
    });

    it('should return rules from multiple matching patterns', () => {
      const fixedValues: FixedValueConfig = {
        'dir/*.yaml': [{ path: 'key1', value: 'value1' }],
        '**/*.yaml': [{ path: 'key2', value: 'value2' }]
      };
      const result = getFixedValuesForFile('dir/test.yaml', fixedValues);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ path: 'key1', value: 'value1' });
      expect(result).toContainEqual({ path: 'key2', value: 'value2' });
    });

    it('should match specific file pattern', () => {
      const fixedValues: FixedValueConfig = {
        'values-prod.yaml': [{ path: 'debug', value: false }],
        '*.yaml': [{ path: 'version', value: '1.0.0' }]
      };
      expect(getFixedValuesForFile('values-prod.yaml', fixedValues)).toHaveLength(2);
      expect(getFixedValuesForFile('values-dev.yaml', fixedValues)).toHaveLength(1);
    });

    it('should match glob patterns with directories', () => {
      const fixedValues: FixedValueConfig = {
        'envs/**/*.yaml': [{ path: 'env', value: 'production' }]
      };
      expect(getFixedValuesForFile('envs/prod/values.yaml', fixedValues)).toHaveLength(1);
      expect(getFixedValuesForFile('other/values.yaml', fixedValues)).toHaveLength(0);
    });
  });

  describe('setValueAtPath', () => {
    describe('simple paths', () => {
      it('should set top-level key', () => {
        const object = { name: 'old' };
        const result = setValueAtPath(object, ['name'], 'new');
        expect(result).toBe(true);
        expect(object.name).toBe('new');
      });

      it('should set nested key', () => {
        const object = { spec: { replicas: 1 } };
        const result = setValueAtPath(object, ['spec', 'replicas'], 3);
        expect(result).toBe(true);
        expect(object.spec.replicas).toBe(3);
      });

      it('should create new key in existing object', () => {
        const object: Record<string, unknown> = { existing: 'value' };
        const result = setValueAtPath(object, ['newKey'], 'newValue');
        expect(result).toBe(true);
        expect(object.newKey).toBe('newValue');
      });

      it('should return false for non-existent intermediate path', () => {
        const object = { a: 'value' };
        const result = setValueAtPath(object, ['missing', 'nested'], 'value');
        expect(result).toBe(false);
      });

      it('should return false for empty path', () => {
        const object = { name: 'test' };
        const result = setValueAtPath(object, [], 'value');
        expect(result).toBe(false);
      });

      it('should return false for null object', () => {
        // eslint-disable-next-line unicorn/no-null
        const result = setValueAtPath(null, ['key'], 'value');
        expect(result).toBe(false);
      });

      it('should return false for primitive object', () => {
        const result = setValueAtPath('string', ['key'], 'value');
        expect(result).toBe(false);
      });
    });

    describe('array indices', () => {
      it('should set array element', () => {
        const object = { items: ['a', 'b', 'c'] };
        const result = setValueAtPath(object, ['items', '1'], 'new');
        expect(result).toBe(true);
        expect(object.items[1]).toBe('new');
      });

      it('should set nested array element', () => {
        const object = { data: { items: [1, 2, 3] } };
        const result = setValueAtPath(object, ['data', 'items', '0'], 100);
        expect(result).toBe(true);
        expect(object.data.items[0]).toBe(100);
      });

      it('should return false for out-of-bounds index', () => {
        const object = { items: ['a', 'b'] };
        const result = setValueAtPath(object, ['items', '10'], 'value');
        expect(result).toBe(false);
      });

      it('should return false for negative index', () => {
        const object = { items: ['a', 'b'] };
        const result = setValueAtPath(object, ['items', '-1'], 'value');
        expect(result).toBe(false);
      });

      it('should return false for non-numeric index', () => {
        const object = { items: ['a', 'b'] };
        const result = setValueAtPath(object, ['items', 'abc'], 'value');
        expect(result).toBe(false);
      });
    });

    describe('filter segments', () => {
      it('should set value with equals filter', () => {
        const object = {
          env: [
            { name: 'DEBUG', value: 'old' },
            { name: 'PROD', value: '0' }
          ]
        };
        const pathParts = parseJsonPath('env[name=DEBUG].value');
        const result = setValueAtPath(object, pathParts, 'new');
        expect(result).toBe(true);
        expect(object.env[0].value).toBe('new');
      });

      it('should set value with startsWith filter', () => {
        const object = {
          env: [
            { name: 'DB_HOST', value: 'localhost' },
            { name: 'API_KEY', value: 'xxx' }
          ]
        };
        const pathParts = parseJsonPath('env[name^=DB_].value');
        const result = setValueAtPath(object, pathParts, 'newhost');
        expect(result).toBe(true);
        expect(object.env[0].value).toBe('newhost');
      });

      it('should set value with endsWith filter', () => {
        const object = {
          env: [
            { name: 'API_KEY', value: 'old' },
            { name: 'DEBUG', value: '1' }
          ]
        };
        const pathParts = parseJsonPath('env[name$=_KEY].value');
        const result = setValueAtPath(object, pathParts, 'newkey');
        expect(result).toBe(true);
        expect(object.env[0].value).toBe('newkey');
      });

      it('should set value with contains filter', () => {
        const object = {
          env: [
            { name: 'MY_SECRET_KEY', value: 'old' },
            { name: 'DEBUG', value: '1' }
          ]
        };
        const pathParts = parseJsonPath('env[name*=SECRET].value');
        const result = setValueAtPath(object, pathParts, 'newsecret');
        expect(result).toBe(true);
        expect(object.env[0].value).toBe('newsecret');
      });

      it('should return false when filter matches no item', () => {
        const object = {
          env: [{ name: 'DEBUG', value: '1' }]
        };
        const pathParts = parseJsonPath('env[name=MISSING].value');
        const result = setValueAtPath(object, pathParts, 'value');
        expect(result).toBe(false);
      });

      it('should return false when applying filter to non-array', () => {
        const object = {
          env: { name: 'DEBUG', value: '1' }
        };
        const pathParts = parseJsonPath('env[name=DEBUG].value');
        const result = setValueAtPath(object, pathParts, 'value');
        expect(result).toBe(false);
      });

      it('should update ALL items matching startsWith filter', () => {
        const object = {
          env: [
            { name: 'DB_HOST', value: 'localhost' },
            { name: 'DB_PORT', value: '5432' },
            { name: 'DB_USER', value: 'admin' },
            { name: 'API_KEY', value: 'xxx' }
          ]
        };
        const pathParts = parseJsonPath('env[name^=DB_]');
        const result = setValueAtPath(object, pathParts, { name: 'REDACTED', value: 'hidden' });
        expect(result).toBe(true);
        expect(object.env[0]).toEqual({ name: 'REDACTED', value: 'hidden' });
        expect(object.env[1]).toEqual({ name: 'REDACTED', value: 'hidden' });
        expect(object.env[2]).toEqual({ name: 'REDACTED', value: 'hidden' });
        expect(object.env[3]).toEqual({ name: 'API_KEY', value: 'xxx' }); // unchanged
      });

      it('should update ALL items matching endsWith filter', () => {
        const object = {
          env: [
            { name: 'API_KEY', value: 'old1' },
            { name: 'SECRET_KEY', value: 'old2' },
            { name: 'DEBUG', value: '1' },
            { name: 'AUTH_KEY', value: 'old3' }
          ]
        };
        const pathParts = parseJsonPath('env[name$=_KEY]');
        const result = setValueAtPath(object, pathParts, { name: 'HIDDEN', value: 'redacted' });
        expect(result).toBe(true);
        expect(object.env[0]).toEqual({ name: 'HIDDEN', value: 'redacted' });
        expect(object.env[1]).toEqual({ name: 'HIDDEN', value: 'redacted' });
        expect(object.env[2]).toEqual({ name: 'DEBUG', value: '1' }); // unchanged
        expect(object.env[3]).toEqual({ name: 'HIDDEN', value: 'redacted' });
      });

      it('should update ALL items matching contains filter', () => {
        const object = {
          env: [
            { name: 'DB_PASSWORD', value: 'secret1' },
            { name: 'PASSWORD_HASH', value: 'secret2' },
            { name: 'MY_PASSWORD_KEY', value: 'secret3' },
            { name: 'DEBUG', value: '1' }
          ]
        };
        const pathParts = parseJsonPath('env[name*=PASSWORD]');
        const result = setValueAtPath(object, pathParts, { name: 'REDACTED', value: '***' });
        expect(result).toBe(true);
        expect(object.env[0]).toEqual({ name: 'REDACTED', value: '***' });
        expect(object.env[1]).toEqual({ name: 'REDACTED', value: '***' });
        expect(object.env[2]).toEqual({ name: 'REDACTED', value: '***' });
        expect(object.env[3]).toEqual({ name: 'DEBUG', value: '1' }); // unchanged
      });

      it('should update nested value in ALL items matching filter', () => {
        const object = {
          env: [
            { name: 'LOG_LEVEL_APP', value: 'debug' },
            { name: 'LOG_LEVEL_DB', value: 'debug' },
            { name: 'LOG_LEVEL_API', value: 'debug' },
            { name: 'DEBUG', value: '1' }
          ]
        };
        const pathParts = parseJsonPath('env[name^=LOG_LEVEL_].value');
        const result = setValueAtPath(object, pathParts, 'info');
        expect(result).toBe(true);
        expect(object.env[0].value).toBe('info');
        expect(object.env[1].value).toBe('info');
        expect(object.env[2].value).toBe('info');
        expect(object.env[3].value).toBe('1'); // unchanged
      });

      it('should replace entire array item when filter is final segment', () => {
        const object = {
          env: [
            { name: 'DEBUG', value: '1' },
            { name: 'PROD', value: '0' }
          ]
        };
        const pathParts = parseJsonPath('env[name=DEBUG]');
        const result = setValueAtPath(object, pathParts, { name: 'NEW', value: 'replaced' });
        expect(result).toBe(true);
        expect(object.env[0]).toEqual({ name: 'NEW', value: 'replaced' });
      });
    });

    describe('nested paths with filters', () => {
      it('should set deeply nested value with filter', () => {
        const object = {
          spec: {
            containers: [
              {
                name: 'app',
                resources: { limits: { cpu: '100m' } }
              }
            ]
          }
        };
        const pathParts = parseJsonPath('spec.containers[name=app].resources.limits.cpu');
        const result = setValueAtPath(object, pathParts, '500m');
        expect(result).toBe(true);
        expect(object.spec.containers[0].resources.limits.cpu).toBe('500m');
      });

      it('should set value with multiple filters', () => {
        const object = {
          containers: [
            {
              name: 'sidecar',
              env: [
                { name: 'API_KEY', value: 'old' },
                { name: 'DEBUG', value: '1' }
              ]
            }
          ]
        };
        const pathParts = parseJsonPath('containers[name=sidecar].env[name=API_KEY].value');
        const result = setValueAtPath(object, pathParts, 'newkey');
        expect(result).toBe(true);
        expect(object.containers[0].env[0].value).toBe('newkey');
      });
    });

    describe('different value types', () => {
      it('should set string value', () => {
        const object: Record<string, unknown> = { key: 'old' };
        setValueAtPath(object, ['key'], 'new');
        expect(object.key).toBe('new');
      });

      it('should set number value', () => {
        const object: Record<string, unknown> = { count: 0 };
        setValueAtPath(object, ['count'], 42);
        expect(object.count).toBe(42);
      });

      it('should set boolean value', () => {
        const object: Record<string, unknown> = { enabled: true };
        setValueAtPath(object, ['enabled'], false);
        expect(object.enabled).toBe(false);
      });

      it('should set null value', () => {
        const object: Record<string, unknown> = { data: 'value' };
        // eslint-disable-next-line unicorn/no-null
        setValueAtPath(object, ['data'], null);

        expect(object.data).toBeNull();
      });

      it('should set object value', () => {
        const object: Record<string, unknown> = { config: {} };
        const replacementValue = { nested: { deep: 'value' } };
        setValueAtPath(object, ['config'], replacementValue);
        expect(object.config).toEqual(replacementValue);
      });

      it('should set array value', () => {
        const object: Record<string, unknown> = { items: [] };
        setValueAtPath(object, ['items'], ['a', 'b', 'c']);
        expect(object.items).toEqual(['a', 'b', 'c']);
      });
    });
  });

  describe('applyFixedValues', () => {
    it('should apply single rule', () => {
      const data = { version: '1.0.0' };
      const rules: FixedValueRule[] = [{ path: 'version', value: '2.0.0' }];
      applyFixedValues(data, rules);
      expect(data.version).toBe('2.0.0');
    });

    it('should apply multiple rules', () => {
      const data = { name: 'old', count: 1 };
      const rules: FixedValueRule[] = [
        { path: 'name', value: 'new' },
        { path: 'count', value: 10 }
      ];
      applyFixedValues(data, rules);
      expect(data.name).toBe('new');
      expect(data.count).toBe(10);
    });

    it('should silently skip non-existent paths', () => {
      const data = { existing: 'value' };
      const rules: FixedValueRule[] = [{ path: 'missing.nested.path', value: 'value' }];
      // Should not throw
      applyFixedValues(data, rules);
      expect(data).toEqual({ existing: 'value' });
    });

    it('should apply rules with filter paths', () => {
      const data = {
        env: [
          { name: 'LOG_LEVEL', value: 'debug' },
          { name: 'PORT', value: '8080' }
        ]
      };
      const rules: FixedValueRule[] = [{ path: 'env[name=LOG_LEVEL].value', value: 'info' }];
      applyFixedValues(data, rules);
      expect(data.env[0].value).toBe('info');
      expect(data.env[1].value).toBe('8080');
    });

    it('should apply last rule when multiple rules target same path', () => {
      const data = { value: 'original' };
      const rules: FixedValueRule[] = [
        { path: 'value', value: 'first' },
        { path: 'value', value: 'second' },
        { path: 'value', value: 'third' }
      ];
      applyFixedValues(data, rules);
      expect(data.value).toBe('third');
    });

    it('should handle empty rules array', () => {
      const data = { key: 'value' };
      applyFixedValues(data, []);
      expect(data).toEqual({ key: 'value' });
    });

    it('should handle complex nested structure', () => {
      const data = {
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'app',
                  env: [
                    { name: 'DEBUG', value: 'true' },
                    { name: 'LOG_LEVEL', value: 'debug' }
                  ]
                }
              ]
            }
          }
        }
      };
      const rules: FixedValueRule[] = [
        { path: 'spec.template.spec.containers[name=app].env[name=LOG_LEVEL].value', value: 'warn' }
      ];
      applyFixedValues(data, rules);
      expect(data.spec.template.spec.containers[0].env[1].value).toBe('warn');
    });

    it('should silently skip when filter matches nothing', () => {
      const data = {
        env: [{ name: 'DEBUG', value: '1' }]
      };
      const rules: FixedValueRule[] = [{ path: 'env[name=NONEXISTENT].value', value: 'test' }];
      applyFixedValues(data, rules);
      // Should not modify and not throw
      expect(data.env[0].value).toBe('1');
    });
  });

  describe('integration scenarios', () => {
    it('should handle Helm values.yaml scenario', () => {
      const data = {
        image: {
          repository: 'myapp',
          tag: 'dev-latest'
        },
        replicaCount: 1,
        env: [
          { name: 'LOG_LEVEL', value: 'debug' },
          { name: 'ENV_TYPE', value: 'development' }
        ],
        debug: true
      };

      const rules: FixedValueRule[] = [
        { path: 'image.tag', value: 'v1.0.0' },
        { path: 'replicaCount', value: 3 },
        { path: 'env[name=LOG_LEVEL].value', value: 'info' },
        { path: 'debug', value: false }
      ];

      applyFixedValues(data, rules);

      expect(data.image.tag).toBe('v1.0.0');
      expect(data.replicaCount).toBe(3);
      expect(data.env[0].value).toBe('info');
      expect(data.debug).toBe(false);
      // Unchanged values should remain
      expect(data.image.repository).toBe('myapp');
      expect(data.env[1].value).toBe('development');
    });

    it('should handle Kubernetes deployment scenario', () => {
      const data = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        spec: {
          replicas: 1,
          template: {
            spec: {
              containers: [
                {
                  name: 'main',
                  image: 'app:dev',
                  resources: {
                    limits: { cpu: '100m', memory: '128Mi' }
                  }
                },
                {
                  name: 'sidecar',
                  image: 'sidecar:dev'
                }
              ]
            }
          }
        }
      };

      const rules: FixedValueRule[] = [
        { path: 'spec.replicas', value: 3 },
        { path: 'spec.template.spec.containers[name=main].resources.limits.cpu', value: '500m' },
        { path: 'spec.template.spec.containers[name=main].resources.limits.memory', value: '512Mi' }
      ];

      applyFixedValues(data, rules);

      expect(data.spec.replicas).toBe(3);
      expect(data.spec.template.spec.containers[0].resources.limits.cpu).toBe('500m');
      expect(data.spec.template.spec.containers[0].resources.limits.memory).toBe('512Mi');
      // Sidecar should be unchanged
      expect(data.spec.template.spec.containers[1].image).toBe('sidecar:dev');
    });
  });
});
