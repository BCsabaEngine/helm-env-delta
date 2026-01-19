import { describe, expect, it } from 'vitest';

import { getValueAtPath, isFilterSegment, parseFilterSegment, parseJsonPath } from '../../src/utils/jsonPath';

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
        expect(getValueAtPath(object, ['env', 'filter:name=DEBUG'])).toEqual({ name: 'DEBUG', value: '1' });
      });

      it('should return undefined when filter does not match', () => {
        const object = { env: [{ name: 'DEBUG', value: '1' }] };
        expect(getValueAtPath(object, ['env', 'filter:name=MISSING'])).toBeUndefined();
      });

      it('should handle nested filter navigation', () => {
        const object = {
          containers: [{ name: 'app', env: [{ name: 'SECRET', value: 'xxx' }] }]
        };
        expect(getValueAtPath(object, ['containers', 'filter:name=app', 'env', 'filter:name=SECRET', 'value'])).toBe(
          'xxx'
        );
      });

      it('should convert numeric values to string for comparison', () => {
        const object = { items: [{ id: 123, name: 'test' }] };
        expect(getValueAtPath(object, ['items', 'filter:id=123'])).toEqual({ id: 123, name: 'test' });
      });

      it('should return undefined when filter applied to non-array', () => {
        const object = { data: { name: 'test' } };
        expect(getValueAtPath(object, ['data', 'filter:name=test'])).toBeUndefined();
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
        expect(getValueAtPath(object, ['items', 'filter:type=a'])).toEqual({ type: 'a', id: 1 });
      });

      it('should skip non-object items in array', () => {
        const object = { items: ['string', undefined, { name: 'test' }] };
        expect(getValueAtPath(object, ['items', 'filter:name=test'])).toEqual({ name: 'test' });
      });
    });
  });

  describe('isFilterSegment', () => {
    it('should return true for filter segments', () => {
      expect(isFilterSegment('filter:name=value')).toBe(true);
    });

    it('should return true for filter with empty value', () => {
      expect(isFilterSegment('filter:key=')).toBe(true);
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
    it('should parse valid filter segment', () => {
      expect(parseFilterSegment('filter:name=DEBUG')).toEqual({ property: 'name', value: 'DEBUG' });
    });

    it('should handle empty value', () => {
      expect(parseFilterSegment('filter:key=')).toEqual({ property: 'key', value: '' });
    });

    it('should handle value with equals sign', () => {
      expect(parseFilterSegment('filter:url=http://foo.com?a=b')).toEqual({
        property: 'url',
        value: 'http://foo.com?a=b'
      });
    });

    it('should return null for non-filter segment', () => {
      expect(parseFilterSegment('name')).toBeUndefined();
    });

    it('should return null for filter without equals', () => {
      expect(parseFilterSegment('filter:invalid')).toBeUndefined();
    });

    it('should return null for empty string', () => {
      expect(parseFilterSegment('')).toBeUndefined();
    });
  });

  describe('parseJsonPath with filter expressions', () => {
    it('should parse simple filter expression', () => {
      expect(parseJsonPath('ENV[name=DEBUG]')).toEqual(['ENV', 'filter:name=DEBUG']);
    });

    it('should parse nested filter expression', () => {
      expect(parseJsonPath('spec.containers[name=app]')).toEqual(['spec', 'containers', 'filter:name=app']);
    });

    it('should parse multiple filters in path', () => {
      expect(parseJsonPath('a[x=1].b[y=2]')).toEqual(['a', 'filter:x=1', 'b', 'filter:y=2']);
    });

    it('should parse quoted values with spaces', () => {
      expect(parseJsonPath('ENV[name="value with spaces"]')).toEqual(['ENV', 'filter:name=value with spaces']);
    });

    it('should parse mixed filters and wildcards', () => {
      expect(parseJsonPath('items[*].data[key=secret]')).toEqual(['items', '*', 'data', 'filter:key=secret']);
    });

    it('should parse mixed filters and indices', () => {
      expect(parseJsonPath('items[0].env[name=DEBUG]')).toEqual(['items', '0', 'env', 'filter:name=DEBUG']);
    });

    it('should handle special characters in unquoted values', () => {
      expect(parseJsonPath('env[url=http://foo.com]')).toEqual(['env', 'filter:url=http://foo.com']);
    });

    it('should handle empty value', () => {
      expect(parseJsonPath('env[name=]')).toEqual(['env', 'filter:name=']);
    });

    it('should handle underscore in property name', () => {
      expect(parseJsonPath('data[my_key=value]')).toEqual(['data', 'filter:my_key=value']);
    });

    it('should handle complex nested path with filters', () => {
      expect(parseJsonPath('spec.template.spec.containers[name=app].env[name=SECRET].value')).toEqual([
        'spec',
        'template',
        'spec',
        'containers',
        'filter:name=app',
        'env',
        'filter:name=SECRET',
        'value'
      ]);
    });
  });
});
