import { describe, expect, it } from 'vitest';

import {
  getValueAtPath,
  isFilterSegment,
  matchesFilter,
  parseFilterSegment,
  parseJsonPath
} from '../../src/utils/jsonPath';

describe('utils/jsonPath', () => {
  describe('parseJsonPath', () => {
    it('should parse simple path', () => {
      expect(parseJsonPath('name')).toEqual(['name']);
    });

    it('should parse nested path', () => {
      expect(parseJsonPath('metadata.name')).toEqual(['metadata', 'name']);
    });

    it('should parse array index', () => {
      expect(parseJsonPath('items[0]')).toEqual(['items', '0']);
    });

    it('should parse array wildcard', () => {
      expect(parseJsonPath('items[*]')).toEqual(['items', '*']);
    });

    it('should parse multiple array indices', () => {
      expect(parseJsonPath('a[0].b[1]')).toEqual(['a', '0', 'b', '1']);
    });

    it('should parse dollar sign prefix and filter it out', () => {
      expect(parseJsonPath('$.metadata.name')).toEqual(['$', 'metadata', 'name']);
    });

    it('should filter leading dots', () => {
      expect(parseJsonPath('..name')).toEqual(['name']);
    });

    it('should filter trailing dots', () => {
      expect(parseJsonPath('name..')).toEqual(['name']);
    });

    it('should filter multiple consecutive dots', () => {
      expect(parseJsonPath('a...b')).toEqual(['a', 'b']);
    });

    it('should parse complex path with arrays and objects', () => {
      const result = parseJsonPath('$.spec.containers[0].env[*].name');
      expect(result).toEqual(['$', 'spec', 'containers', '0', 'env', '*', 'name']);
    });

    it('should return empty array for empty string', () => {
      expect(parseJsonPath('')).toEqual([]);
    });

    it('should return empty array for only dots', () => {
      expect(parseJsonPath('...')).toEqual([]);
    });

    it('should parse only brackets', () => {
      expect(parseJsonPath('[0][1]')).toEqual(['0', '1']);
    });

    it('should parse mixed notations', () => {
      expect(parseJsonPath('a.b[2].c[*].d')).toEqual(['a', 'b', '2', 'c', '*', 'd']);
    });

    it('should parse path with numbers in keys', () => {
      expect(parseJsonPath('version2.config')).toEqual(['version2', 'config']);
    });

    it('should handle path with only array notation', () => {
      expect(parseJsonPath('[*]')).toEqual(['*']);
    });
  });

  describe('getValueAtPath', () => {
    it('should get top-level key', () => {
      const object = { name: 'test' };
      expect(getValueAtPath(object, ['name'])).toBe('test');
    });

    it('should get nested value', () => {
      const object = { a: { b: 'val' } };
      expect(getValueAtPath(object, ['a', 'b'])).toBe('val');
    });

    it('should get array element', () => {
      const object = { items: [1, 2, 3] };
      expect(getValueAtPath(object, ['items', '0'])).toBe(1);
      expect(getValueAtPath(object, ['items', '1'])).toBe(2);
      expect(getValueAtPath(object, ['items', '2'])).toBe(3);
    });

    it('should get nested array element', () => {
      const object = { a: { items: [10, 20] } };
      expect(getValueAtPath(object, ['a', 'items', '0'])).toBe(10);
      expect(getValueAtPath(object, ['a', 'items', '1'])).toBe(20);
    });

    it('should return undefined for wildcard', () => {
      const object = { items: [1, 2, 3] };
      expect(getValueAtPath(object, ['items', '*'])).toBeUndefined();
    });

    it('should return undefined for non-existent path', () => {
      const object = { name: 'test' };
      expect(getValueAtPath(object, ['missing'])).toBeUndefined();
    });

    it('should return undefined when traversing through non-object', () => {
      const object = { value: 'string' };
      expect(getValueAtPath(object, ['value', 'nested'])).toBeUndefined();
    });

    it('should return undefined for non-numeric array index', () => {
      const object = { items: [1, 2, 3] };
      expect(getValueAtPath(object, ['items', 'abc'])).toBeUndefined();
    });

    it('should return undefined for out-of-bounds array index', () => {
      const object = { items: [1, 2, 3] };
      expect(getValueAtPath(object, ['items', '10'])).toBeUndefined();
    });

    it('should return undefined for NaN index', () => {
      const object = { items: [1, 2, 3] };
      expect(getValueAtPath(object, ['items', 'NaN'])).toBeUndefined();
    });

    it('should return original object for empty path', () => {
      const object = { name: 'test' };
      expect(getValueAtPath(object, [])).toBe(object);
    });

    it('should return undefined for empty object', () => {
      expect(getValueAtPath(undefined, ['name'])).toBeUndefined();
    });

    it('should return undefined for undefined object', () => {
      expect(getValueAtPath(undefined, ['name'])).toBeUndefined();
    });

    it('should return undefined when traversing primitive', () => {
      expect(getValueAtPath('string', ['length'])).toBeUndefined();
    });

    it('should handle deep nested object', () => {
      const object = { a: { b: { c: { d: { e: 'deep' } } } } };
      expect(getValueAtPath(object, ['a', 'b', 'c', 'd', 'e'])).toBe('deep');
    });

    it('should return undefined when path stops at undefined', () => {
      const object = { a: { b: undefined } };
      expect(getValueAtPath(object, ['a', 'b', 'c'])).toBeUndefined();
    });

    it('should traverse array of objects', () => {
      const object = { items: [{ name: 'first' }, { name: 'second' }] };
      expect(getValueAtPath(object, ['items', '0', 'name'])).toBe('first');
      expect(getValueAtPath(object, ['items', '1', 'name'])).toBe('second');
    });

    it('should get boolean values', () => {
      const object = { active: true, disabled: false };
      expect(getValueAtPath(object, ['active'])).toBe(true);
      expect(getValueAtPath(object, ['disabled'])).toBe(false);
    });

    it('should get number values', () => {
      const object = { count: 42, price: 0 };
      expect(getValueAtPath(object, ['count'])).toBe(42);
      expect(getValueAtPath(object, ['price'])).toBe(0);
    });

    it('should handle undefined values in object', () => {
      const object = { a: undefined, b: 'value' };
      expect(getValueAtPath(object, ['a'])).toBeUndefined();
      expect(getValueAtPath(object, ['b'])).toBe('value');
    });

    it('should handle negative array index as non-numeric', () => {
      const object = { items: [1, 2, 3] };
      expect(getValueAtPath(object, ['items', '-1'])).toBeUndefined();
    });

    describe('filter segments', () => {
      it('should find value with filter', () => {
        const object = {
          env: [
            { name: 'DEBUG', value: '1' },
            { name: 'PROD', value: '0' }
          ]
        };
        expect(getValueAtPath(object, ['env', 'filter:name:eq:DEBUG'])).toEqual({ name: 'DEBUG', value: '1' });
      });

      it('should return undefined when filter does not match', () => {
        const object = { env: [{ name: 'DEBUG', value: '1' }] };
        expect(getValueAtPath(object, ['env', 'filter:name:eq:MISSING'])).toBeUndefined();
      });

      it('should handle nested filter navigation', () => {
        const object = {
          containers: [{ name: 'app', env: [{ name: 'SECRET', value: 'xxx' }] }]
        };
        expect(
          getValueAtPath(object, ['containers', 'filter:name:eq:app', 'env', 'filter:name:eq:SECRET', 'value'])
        ).toBe('xxx');
      });

      it('should convert numeric values to string for comparison', () => {
        const object = { items: [{ id: 123, name: 'test' }] };
        expect(getValueAtPath(object, ['items', 'filter:id:eq:123'])).toEqual({ id: 123, name: 'test' });
      });

      it('should return undefined when filter applied to non-array', () => {
        const object = { data: { name: 'test' } };
        expect(getValueAtPath(object, ['data', 'filter:name:eq:test'])).toBeUndefined();
      });

      it('should return undefined for invalid filter segment', () => {
        const object = { items: [{ name: 'test' }] };
        expect(getValueAtPath(object, ['items', 'filter:invalid'])).toBeUndefined();
      });

      it('should return first match when multiple items match', () => {
        const object = {
          items: [
            { type: 'a', id: 1 },
            { type: 'a', id: 2 }
          ]
        };
        expect(getValueAtPath(object, ['items', 'filter:type:eq:a'])).toEqual({ type: 'a', id: 1 });
      });

      it('should skip non-object items in array', () => {
        const object = { items: ['string', undefined, { name: 'test' }] };
        expect(getValueAtPath(object, ['items', 'filter:name:eq:test'])).toEqual({ name: 'test' });
      });
    });
  });

  describe('isFilterSegment', () => {
    it('should return true for filter segments with eq operator', () => {
      expect(isFilterSegment('filter:name:eq:value')).toBe(true);
    });

    it('should return true for filter segments with startsWith operator', () => {
      expect(isFilterSegment('filter:name:startsWith:prefix')).toBe(true);
    });

    it('should return true for filter segments with endsWith operator', () => {
      expect(isFilterSegment('filter:name:endsWith:suffix')).toBe(true);
    });

    it('should return true for filter segments with contains operator', () => {
      expect(isFilterSegment('filter:name:contains:middle')).toBe(true);
    });

    it('should return true for filter with empty value', () => {
      expect(isFilterSegment('filter:key:eq:')).toBe(true);
    });

    it('should return false for regular segments', () => {
      expect(isFilterSegment('name')).toBe(false);
    });

    it('should return false for wildcard', () => {
      expect(isFilterSegment('*')).toBe(false);
    });

    it('should return false for numeric index', () => {
      expect(isFilterSegment('0')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isFilterSegment('')).toBe(false);
    });
  });

  describe('parseFilterSegment', () => {
    it('should parse valid filter segment with eq operator', () => {
      expect(parseFilterSegment('filter:name:eq:DEBUG')).toEqual({ property: 'name', value: 'DEBUG', operator: 'eq' });
    });

    it('should parse valid filter segment with startsWith operator', () => {
      expect(parseFilterSegment('filter:name:startsWith:DB_')).toEqual({
        property: 'name',
        value: 'DB_',
        operator: 'startsWith'
      });
    });

    it('should parse valid filter segment with endsWith operator', () => {
      expect(parseFilterSegment('filter:name:endsWith:_KEY')).toEqual({
        property: 'name',
        value: '_KEY',
        operator: 'endsWith'
      });
    });

    it('should parse valid filter segment with contains operator', () => {
      expect(parseFilterSegment('filter:name:contains:SECRET')).toEqual({
        property: 'name',
        value: 'SECRET',
        operator: 'contains'
      });
    });

    it('should handle empty value', () => {
      expect(parseFilterSegment('filter:key:eq:')).toEqual({ property: 'key', value: '', operator: 'eq' });
    });

    it('should handle value with colons', () => {
      expect(parseFilterSegment('filter:url:eq:http://foo.com:8080/path')).toEqual({
        property: 'url',
        value: 'http://foo.com:8080/path',
        operator: 'eq'
      });
    });

    it('should return undefined for non-filter segment', () => {
      expect(parseFilterSegment('name')).toBeUndefined();
    });

    it('should return undefined for filter without operator', () => {
      expect(parseFilterSegment('filter:invalid')).toBeUndefined();
    });

    it('should return undefined for filter with invalid operator', () => {
      expect(parseFilterSegment('filter:name:invalid:value')).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(parseFilterSegment('')).toBeUndefined();
    });
  });

  describe('parseJsonPath with filter expressions', () => {
    describe('equals operator (=)', () => {
      it('should parse simple filter expression', () => {
        expect(parseJsonPath('ENV[name=DEBUG]')).toEqual(['ENV', 'filter:name:eq:DEBUG']);
      });

      it('should parse nested filter expression', () => {
        expect(parseJsonPath('spec.containers[name=app]')).toEqual(['spec', 'containers', 'filter:name:eq:app']);
      });

      it('should parse multiple filters in path', () => {
        expect(parseJsonPath('a[x=1].b[y=2]')).toEqual(['a', 'filter:x:eq:1', 'b', 'filter:y:eq:2']);
      });

      it('should parse quoted values with spaces', () => {
        expect(parseJsonPath('ENV[name="value with spaces"]')).toEqual(['ENV', 'filter:name:eq:value with spaces']);
      });

      it('should parse mixed filters and wildcards', () => {
        expect(parseJsonPath('items[*].data[key=secret]')).toEqual(['items', '*', 'data', 'filter:key:eq:secret']);
      });

      it('should parse mixed filters and indices', () => {
        expect(parseJsonPath('items[0].env[name=DEBUG]')).toEqual(['items', '0', 'env', 'filter:name:eq:DEBUG']);
      });

      it('should handle special characters in unquoted values', () => {
        expect(parseJsonPath('env[url=http://foo.com]')).toEqual(['env', 'filter:url:eq:http://foo.com']);
      });

      it('should handle empty value', () => {
        expect(parseJsonPath('env[name=]')).toEqual(['env', 'filter:name:eq:']);
      });

      it('should handle underscore in property name', () => {
        expect(parseJsonPath('data[my_key=value]')).toEqual(['data', 'filter:my_key:eq:value']);
      });

      it('should handle complex nested path with filters', () => {
        expect(parseJsonPath('spec.template.spec.containers[name=app].env[name=SECRET].value')).toEqual([
          'spec',
          'template',
          'spec',
          'containers',
          'filter:name:eq:app',
          'env',
          'filter:name:eq:SECRET',
          'value'
        ]);
      });
    });

    describe('startsWith operator (^=)', () => {
      it('should parse startsWith filter', () => {
        expect(parseJsonPath('env[name^=DB_]')).toEqual(['env', 'filter:name:startsWith:DB_']);
      });

      it('should parse nested startsWith filter', () => {
        expect(parseJsonPath('spec.containers[name^=sidecar-].resources')).toEqual([
          'spec',
          'containers',
          'filter:name:startsWith:sidecar-',
          'resources'
        ]);
      });

      it('should parse quoted startsWith value', () => {
        expect(parseJsonPath('env[name^="prefix with space"]')).toEqual([
          'env',
          'filter:name:startsWith:prefix with space'
        ]);
      });
    });

    describe('endsWith operator ($=)', () => {
      it('should parse endsWith filter', () => {
        expect(parseJsonPath('env[name$=_SECRET]')).toEqual(['env', 'filter:name:endsWith:_SECRET']);
      });

      it('should parse nested endsWith filter', () => {
        expect(parseJsonPath('volumes[name$=-data].mountPath')).toEqual([
          'volumes',
          'filter:name:endsWith:-data',
          'mountPath'
        ]);
      });

      it('should parse quoted endsWith value', () => {
        expect(parseJsonPath('env[name$="suffix with space"]')).toEqual([
          'env',
          'filter:name:endsWith:suffix with space'
        ]);
      });
    });

    describe('contains operator (*=)', () => {
      it('should parse contains filter', () => {
        expect(parseJsonPath('env[name*=PASSWORD]')).toEqual(['env', 'filter:name:contains:PASSWORD']);
      });

      it('should parse nested contains filter', () => {
        expect(parseJsonPath('containers[image*=nginx].ports')).toEqual([
          'containers',
          'filter:image:contains:nginx',
          'ports'
        ]);
      });

      it('should parse quoted contains value', () => {
        expect(parseJsonPath('env[name*="middle part"]')).toEqual(['env', 'filter:name:contains:middle part']);
      });
    });

    describe('mixed operators', () => {
      it('should parse path with mixed operators', () => {
        expect(parseJsonPath('containers[name^=init-].env[name$=_KEY]')).toEqual([
          'containers',
          'filter:name:startsWith:init-',
          'env',
          'filter:name:endsWith:_KEY'
        ]);
      });

      it('should parse path with all operator types', () => {
        expect(parseJsonPath('a[x=1].b[y^=pre].c[z$=suf].d[w*=mid]')).toEqual([
          'a',
          'filter:x:eq:1',
          'b',
          'filter:y:startsWith:pre',
          'c',
          'filter:z:endsWith:suf',
          'd',
          'filter:w:contains:mid'
        ]);
      });
    });
  });

  describe('matchesFilter', () => {
    describe('eq operator', () => {
      it('should match exact value', () => {
        expect(matchesFilter('DEBUG', { property: 'name', value: 'DEBUG', operator: 'eq' })).toBe(true);
      });

      it('should not match different value', () => {
        expect(matchesFilter('PROD', { property: 'name', value: 'DEBUG', operator: 'eq' })).toBe(false);
      });

      it('should match empty value', () => {
        expect(matchesFilter('', { property: 'name', value: '', operator: 'eq' })).toBe(true);
      });

      it('should convert numeric value to string', () => {
        expect(matchesFilter(123, { property: 'id', value: '123', operator: 'eq' })).toBe(true);
      });
    });

    describe('startsWith operator', () => {
      it('should match prefix', () => {
        expect(matchesFilter('DB_HOST', { property: 'name', value: 'DB_', operator: 'startsWith' })).toBe(true);
      });

      it('should not match non-prefix', () => {
        expect(matchesFilter('API_HOST', { property: 'name', value: 'DB_', operator: 'startsWith' })).toBe(false);
      });

      it('should match exact value as prefix', () => {
        expect(matchesFilter('DB_', { property: 'name', value: 'DB_', operator: 'startsWith' })).toBe(true);
      });

      it('should match empty prefix', () => {
        expect(matchesFilter('anything', { property: 'name', value: '', operator: 'startsWith' })).toBe(true);
      });

      it('should handle substring that is not prefix', () => {
        expect(matchesFilter('MY_DB_HOST', { property: 'name', value: 'DB_', operator: 'startsWith' })).toBe(false);
      });
    });

    describe('endsWith operator', () => {
      it('should match suffix', () => {
        expect(matchesFilter('API_KEY', { property: 'name', value: '_KEY', operator: 'endsWith' })).toBe(true);
      });

      it('should not match non-suffix', () => {
        expect(matchesFilter('API_SECRET', { property: 'name', value: '_KEY', operator: 'endsWith' })).toBe(false);
      });

      it('should match exact value as suffix', () => {
        expect(matchesFilter('_KEY', { property: 'name', value: '_KEY', operator: 'endsWith' })).toBe(true);
      });

      it('should match empty suffix', () => {
        expect(matchesFilter('anything', { property: 'name', value: '', operator: 'endsWith' })).toBe(true);
      });

      it('should handle substring that is not suffix', () => {
        expect(matchesFilter('API_KEY_VALUE', { property: 'name', value: '_KEY', operator: 'endsWith' })).toBe(false);
      });
    });

    describe('contains operator', () => {
      it('should match substring', () => {
        expect(matchesFilter('MY_SECRET_KEY', { property: 'name', value: 'SECRET', operator: 'contains' })).toBe(true);
      });

      it('should not match when substring not present', () => {
        expect(matchesFilter('API_KEY', { property: 'name', value: 'SECRET', operator: 'contains' })).toBe(false);
      });

      it('should match exact value', () => {
        expect(matchesFilter('SECRET', { property: 'name', value: 'SECRET', operator: 'contains' })).toBe(true);
      });

      it('should match empty substring', () => {
        expect(matchesFilter('anything', { property: 'name', value: '', operator: 'contains' })).toBe(true);
      });

      it('should match at beginning', () => {
        expect(matchesFilter('SECRET_KEY', { property: 'name', value: 'SECRET', operator: 'contains' })).toBe(true);
      });

      it('should match at end', () => {
        expect(matchesFilter('MY_SECRET', { property: 'name', value: 'SECRET', operator: 'contains' })).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle special regex characters', () => {
        expect(matchesFilter('test.value', { property: 'name', value: '.', operator: 'contains' })).toBe(true);
      });

      it('should handle undefined converted to string', () => {
        expect(matchesFilter(undefined, { property: 'name', value: 'undefined', operator: 'eq' })).toBe(true);
      });

      it('should handle object converted to string', () => {
        expect(matchesFilter({}, { property: 'name', value: '[object Object]', operator: 'eq' })).toBe(true);
      });

      it('should handle boolean converted to string', () => {
        expect(matchesFilter(true, { property: 'flag', value: 'true', operator: 'eq' })).toBe(true);
      });
    });
  });

  describe('getValueAtPath with operators', () => {
    describe('startsWith operator', () => {
      it('should find value with startsWith filter', () => {
        const object = {
          env: [
            { name: 'DB_HOST', value: 'localhost' },
            { name: 'DB_PORT', value: '5432' },
            { name: 'API_KEY', value: 'xxx' }
          ]
        };
        expect(getValueAtPath(object, ['env', 'filter:name:startsWith:DB_'])).toEqual({
          name: 'DB_HOST',
          value: 'localhost'
        });
      });

      it('should return undefined when no item matches startsWith', () => {
        const object = { env: [{ name: 'API_KEY', value: '1' }] };
        expect(getValueAtPath(object, ['env', 'filter:name:startsWith:DB_'])).toBeUndefined();
      });
    });

    describe('endsWith operator', () => {
      it('should find value with endsWith filter', () => {
        const object = {
          env: [
            { name: 'API_KEY', value: 'xxx' },
            { name: 'SECRET_KEY', value: 'yyy' },
            { name: 'DEBUG', value: '1' }
          ]
        };
        expect(getValueAtPath(object, ['env', 'filter:name:endsWith:_KEY'])).toEqual({
          name: 'API_KEY',
          value: 'xxx'
        });
      });

      it('should return undefined when no item matches endsWith', () => {
        const object = { env: [{ name: 'DEBUG', value: '1' }] };
        expect(getValueAtPath(object, ['env', 'filter:name:endsWith:_KEY'])).toBeUndefined();
      });
    });

    describe('contains operator', () => {
      it('should find value with contains filter', () => {
        const object = {
          env: [
            { name: 'MY_SECRET_KEY', value: 'xxx' },
            { name: 'DEBUG', value: '1' }
          ]
        };
        expect(getValueAtPath(object, ['env', 'filter:name:contains:SECRET'])).toEqual({
          name: 'MY_SECRET_KEY',
          value: 'xxx'
        });
      });

      it('should return undefined when no item matches contains', () => {
        const object = { env: [{ name: 'DEBUG', value: '1' }] };
        expect(getValueAtPath(object, ['env', 'filter:name:contains:SECRET'])).toBeUndefined();
      });
    });

    describe('nested paths with operators', () => {
      it('should navigate nested path with startsWith filter', () => {
        const object = {
          containers: [
            { name: 'init-db', resources: { memory: '128Mi' } },
            { name: 'app', resources: { memory: '512Mi' } }
          ]
        };
        expect(getValueAtPath(object, ['containers', 'filter:name:startsWith:init-', 'resources', 'memory'])).toBe(
          '128Mi'
        );
      });

      it('should navigate nested path with multiple operators', () => {
        const object = {
          containers: [
            {
              name: 'sidecar-metrics',
              env: [
                { name: 'API_KEY', value: 'xxx' },
                { name: 'DEBUG', value: '1' }
              ]
            }
          ]
        };
        expect(
          getValueAtPath(object, [
            'containers',
            'filter:name:startsWith:sidecar-',
            'env',
            'filter:name:endsWith:_KEY',
            'value'
          ])
        ).toBe('xxx');
      });
    });
  });
});
