import { describe, expect, it } from 'vitest';

import { normalizeForComparison, serializeForDiff } from '../../src/utils/serialization';

describe('utils/serialization', () => {
  describe('serializeForDiff', () => {
    it('should return string conversion for non-YAML file', () => {
      expect(serializeForDiff('plain text', false)).toBe('plain text');
      expect(serializeForDiff(123, false)).toBe('123');
    });

    it('should return "[object Object]" for non-YAML object', () => {
      expect(serializeForDiff({ key: 'value' }, false)).toBe('[object Object]');
    });

    it('should serialize simple object for YAML file', () => {
      const result = serializeForDiff({ name: 'test', age: 30 }, true);
      expect(result).toContain('name: test');
      expect(result).toContain('age: 30');
    });

    it('should serialize nested object for YAML file', () => {
      const object = { metadata: { name: 'app', namespace: 'default' } };
      const result = serializeForDiff(object, true);
      expect(result).toContain('metadata:');
      expect(result).toContain('name: app');
      expect(result).toContain('namespace: default');
    });

    it('should serialize array for YAML file', () => {
      const array = [1, 2, 3];
      const result = serializeForDiff(array, true);
      expect(result).toContain('- 1');
      expect(result).toContain('- 2');
      expect(result).toContain('- 3');
    });

    it('should sort map entries alphabetically', () => {
      const object = { zebra: 1, apple: 2, middle: 3 };
      const result = serializeForDiff(object, true);
      const lines = result.split('\n').filter(Boolean);
      expect(lines[0]).toContain('apple');
      expect(lines[1]).toContain('middle');
      expect(lines[2]).toContain('zebra');
    });

    it('should use lineWidth 0 to prevent wrapping', () => {
      const object = { longKey: 'a'.repeat(200) };
      const result = serializeForDiff(object, true);
      expect(result).not.toContain('\n  ');
    });

    it('should use indent 2', () => {
      const object = { parent: { child: 'value' } };
      const result = serializeForDiff(object, true);
      expect(result).toContain('  child: value');
    });

    it('should serialize empty object', () => {
      const result = serializeForDiff({}, true);
      expect(result).toBe('{}\n');
    });

    it('should serialize undefined value', () => {
      const result = serializeForDiff(undefined, true);
      expect(result).toBeUndefined();
    });

    it('should serialize undefined value', () => {
      const result = serializeForDiff(undefined, true);
      expect(result).toBeUndefined();
    });

    it('should handle special characters', () => {
      const object = { key: 'value with "quotes" and \'apostrophes\'' };
      const result = serializeForDiff(object, true);
      expect(result).toContain('key:');
    });
  });

  describe('normalizeForComparison', () => {
    it('should return undefined unchanged', () => {
      expect(normalizeForComparison()).toBeUndefined();
    });

    it('should return undefined unchanged', () => {
      expect(normalizeForComparison()).toBeUndefined();
    });

    it('should return string unchanged', () => {
      expect(normalizeForComparison('test')).toBe('test');
    });

    it('should return number unchanged', () => {
      expect(normalizeForComparison(42)).toBe(42);
      expect(normalizeForComparison(0)).toBe(0);
    });

    it('should return boolean unchanged', () => {
      expect(normalizeForComparison(true)).toBe(true);
      expect(normalizeForComparison(false)).toBe(false);
    });

    it('should return empty array unchanged', () => {
      expect(normalizeForComparison([])).toEqual([]);
    });

    it('should sort array of primitives', () => {
      const result = normalizeForComparison([3, 1, 2]) as number[];
      expect(result).toEqual([1, 2, 3]);
    });

    it('should sort array of strings', () => {
      const result = normalizeForComparison(['zebra', 'apple', 'middle']) as string[];
      expect(result).toEqual(['apple', 'middle', 'zebra']);
    });

    it('should sort array of objects by YAML serialization', () => {
      const array = [{ name: 'zebra' }, { name: 'apple' }];
      const result = normalizeForComparison(array) as Array<{ name: string }>;
      expect(result[0]?.name).toBe('apple');
      expect(result[1]?.name).toBe('zebra');
    });

    it('should recursively normalize nested arrays', () => {
      const array = [
        [3, 1, 2],
        [6, 4, 5]
      ];
      const result = normalizeForComparison(array) as number[][];
      expect(result[0]).toEqual([1, 2, 3]);
      expect(result[1]).toEqual([4, 5, 6]);
    });

    it('should recursively normalize values in object', () => {
      const object = { key: 'value' };
      const result = normalizeForComparison(object);
      expect(result).toEqual({ key: 'value' });
    });

    it('should recursively normalize nested objects with arrays', () => {
      const object = { items: [3, 1, 2], nested: { values: [6, 4, 5] } };
      const result = normalizeForComparison(object) as { items: number[]; nested: { values: number[] } };
      expect(result.items).toEqual([1, 2, 3]);
      expect(result.nested.values).toEqual([4, 5, 6]);
    });

    it('should sort mixed array of primitives and objects', () => {
      const array = [{ x: 2 }, { x: 1 }];
      const result = normalizeForComparison(array) as Array<{ x: number }>;
      expect(result[0]?.x).toBe(1);
      expect(result[1]?.x).toBe(2);
    });

    it('should handle array with duplicate items', () => {
      const array = [1, 2, 1, 3, 2];
      const result = normalizeForComparison(array) as number[];
      expect(result).toEqual([1, 1, 2, 2, 3]);
    });

    it('should maintain array sort stability', () => {
      const array = [
        { a: 1, b: 2 },
        { a: 1, b: 1 }
      ];
      const result = normalizeForComparison(array) as Array<{ a: number; b: number }>;
      expect(result).toHaveLength(2);
    });

    it('should normalize object with array values', () => {
      const object = { list: [3, 1, 2] };
      const result = normalizeForComparison(object) as { list: number[] };
      expect(result.list).toEqual([1, 2, 3]);
    });

    it('should handle deep nested structure', () => {
      const object = { a: { b: { c: [3, 1, 2] } } };
      const result = normalizeForComparison(object) as { a: { b: { c: number[] } } };
      expect(result.a.b.c).toEqual([1, 2, 3]);
    });

    it('should return empty object unchanged', () => {
      expect(normalizeForComparison({})).toEqual({});
    });

    it('should handle array with undefined elements', () => {
      const array = [undefined, 'a', undefined];
      const result = normalizeForComparison(array) as Array<undefined | string>;
      expect(result).toHaveLength(3);
    });

    it('should handle array with undefined elements', () => {
      const array = [undefined, 'a', undefined];
      const result = normalizeForComparison(array) as Array<undefined | string>;
      expect(result).toHaveLength(3);
    });
  });
});
