import { describe, expect, it } from 'vitest';

import { diffArrays, findArrayPaths, hasArrays } from '../../src/reporters/arrayDiffer';

describe('arrayDiffer', () => {
  describe('diffArrays', () => {
    it('should return empty arrays for empty inputs', () => {
      const result = diffArrays([], []);
      expect(result).toEqual({ added: [], removed: [], unchanged: [] });
    });

    it('should return all items as unchanged for identical arrays', () => {
      const result = diffArrays([1, 2, 3], [1, 2, 3]);
      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
      expect(result.unchanged).toEqual([1, 2, 3]);
    });

    it('should identify items only in source as added', () => {
      const result = diffArrays([1, 2, 3], [1, 2]);
      expect(result.added).toEqual([3]);
      expect(result.removed).toEqual([]);
      expect(result.unchanged).toEqual([1, 2]);
    });

    it('should identify items only in destination as removed', () => {
      const result = diffArrays([1, 2], [1, 2, 3]);
      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([3]);
      expect(result.unchanged).toEqual([1, 2]);
    });

    it('should identify common items as unchanged', () => {
      const result = diffArrays([1, 2, 3], [2, 3, 4]);
      expect(result.unchanged).toEqual([2, 3]);
      expect(result.added).toEqual([1]);
      expect(result.removed).toEqual([4]);
    });

    it('should handle duplicate items correctly', () => {
      const result = diffArrays([1, 1, 2], [1, 2, 2]);
      expect(result.unchanged).toHaveLength(2);
      expect(result.unchanged).toContain(1);
      expect(result.unchanged).toContain(2);
    });

    it('should compare objects by YAML serialization', () => {
      const result = diffArrays([{ name: 'a' }, { name: 'b' }], [{ name: 'a' }]);
      expect(result.added).toEqual([{ name: 'b' }]);
      expect(result.removed).toEqual([]);
      expect(result.unchanged).toEqual([{ name: 'a' }]);
    });

    it('should handle array of primitives', () => {
      const result = diffArrays(['a', 'b', 'c'], ['b', 'c', 'd']);
      expect(result.added).toEqual(['a']);
      expect(result.removed).toEqual(['d']);
      expect(result.unchanged).toEqual(['b', 'c']);
    });

    it('should handle mixed arrays with primitives and objects', () => {
      const result = diffArrays([1, { x: 2 }], [{ x: 2 }, 3]);
      expect(result.added).toEqual([1]);
      expect(result.removed).toEqual([3]);
      expect(result.unchanged).toEqual([{ x: 2 }]);
    });

    it('should treat order as irrelevant (set-based comparison)', () => {
      const result = diffArrays([1, 2, 3], [3, 2, 1]);
      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
      expect(result.unchanged).toEqual([1, 2, 3]);
    });

    it('should handle nested objects in arrays', () => {
      const source = [{ a: { b: 1 } }];
      const destination = [{ a: { b: 1 } }, { a: { b: 2 } }];
      const result = diffArrays(source, destination);
      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([{ a: { b: 2 } }]);
      expect(result.unchanged).toEqual([{ a: { b: 1 } }]);
    });

    it('should handle arrays with null values', () => {
      const result = diffArrays([undefined, 1, undefined], [undefined, 2]);
      expect(result.unchanged).toEqual([undefined]);
      expect(result.added).toEqual([1]);
      expect(result.removed).toEqual([2]);
    });

    it('should handle arrays with undefined values', () => {
      const result = diffArrays([undefined, 1], [undefined, 2]);
      expect(result.unchanged).toEqual([undefined]);
      expect(result.added).toEqual([1]);
      expect(result.removed).toEqual([2]);
    });

    it('should handle large arrays efficiently', () => {
      const source = Array.from({ length: 100 }, (_, index) => index);
      const destination = Array.from({ length: 100 }, (_, index) => index);
      const result = diffArrays(source, destination);
      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
      expect(result.unchanged).toHaveLength(100);
    });

    it('should use YAML stringify with sortMapEntries for serialization', () => {
      const object1 = { z: 3, a: 1, m: 2 };
      const object2 = { a: 1, m: 2, z: 3 };
      const result = diffArrays([object1], [object2]);
      expect(result.unchanged).toEqual([object1]);
      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
    });
  });

  describe('hasArrays', () => {
    it('should return false for primitive values', () => {
      expect(hasArrays('string')).toBe(false);
      expect(hasArrays(123)).toBe(false);
      expect(hasArrays(true)).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(hasArrays({})).toBe(false);
    });

    it('should return false for object without arrays', () => {
      expect(hasArrays({ a: 1, b: 'text' })).toBe(false);
    });

    it('should return true for object with array property', () => {
      expect(hasArrays({ items: [1, 2, 3] })).toBe(true);
    });

    it('should return true for nested object with array', () => {
      expect(hasArrays({ a: { b: { items: [1] } } })).toBe(true);
    });

    it('should return true for array at top level', () => {
      expect(hasArrays([1, 2, 3])).toBe(true);
    });

    it('should return false for undefined', () => {
      expect(hasArrays()).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(hasArrays()).toBe(false);
    });

    it('should detect nested arrays recursively', () => {
      const object = { a: { b: 1 }, c: { d: { e: [1, 2] } } };
      expect(hasArrays(object)).toBe(true);
    });

    it('should return false for object with only object values', () => {
      const object = { a: { b: { c: 'value' } } };
      expect(hasArrays(object)).toBe(false);
    });
  });

  describe('findArrayPaths', () => {
    it('should return empty array for objects without arrays', () => {
      expect(findArrayPaths({ a: 1, b: 'text' })).toEqual([]);
    });

    it('should return [[]] for top-level array', () => {
      expect(findArrayPaths([1, 2, 3])).toEqual([[]]);
    });

    it('should return path for object with array property', () => {
      expect(findArrayPaths({ items: [1, 2] })).toEqual([['items']]);
    });

    it('should find nested array paths', () => {
      const object = { a: { b: [1, 2] } };
      expect(findArrayPaths(object)).toEqual([['a', 'b']]);
    });

    it('should find multiple arrays in object', () => {
      const object = { items1: [1], items2: [2] };
      const result = findArrayPaths(object);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(['items1']);
      expect(result).toContainEqual(['items2']);
    });

    it('should handle deep nesting (5+ levels)', () => {
      const object = { a: { b: { c: { d: { e: [1] } } } } };
      expect(findArrayPaths(object)).toEqual([['a', 'b', 'c', 'd', 'e']]);
    });

    it('should return multiple paths for multiple arrays', () => {
      const object = {
        list1: [1, 2],
        nested: {
          list2: [3, 4]
        }
      };
      const result = findArrayPaths(object);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(['list1']);
      expect(result).toContainEqual(['nested', 'list2']);
    });

    it('should return array paths as string arrays', () => {
      const object = { a: { b: [1] } };
      const result = findArrayPaths(object);
      expect(result[0]).toEqual(['a', 'b']);
      expect(Array.isArray(result[0])).toBe(true);
    });

    it('should find only direct array properties, not nested arrays within arrays', () => {
      const object = {
        items: [
          [1, 2],
          [3, 4]
        ]
      };
      const result = findArrayPaths(object);
      expect(result).toContainEqual(['items']);
      expect(result).toHaveLength(1);
    });

    it('should return empty array for undefined', () => {
      expect(findArrayPaths()).toEqual([]);
    });

    it('should return empty array for primitives', () => {
      expect(findArrayPaths('string')).toEqual([]);
      expect(findArrayPaths(123)).toEqual([]);
    });
  });
});
