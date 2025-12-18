import { describe, expect, it } from 'vitest';

import { deepEqual } from '../../src/utils/deepEqual';

describe('utils/deepEqual', () => {
  describe('deepEqual', () => {
    it('should return true for identical strings', () => {
      expect(deepEqual('test', 'test')).toBe(true);
    });

    it('should return true for identical numbers', () => {
      expect(deepEqual(42, 42)).toBe(true);
      expect(deepEqual(0, 0)).toBe(true);
    });

    it('should return true for identical booleans', () => {
      expect(deepEqual(true, true)).toBe(true);
      expect(deepEqual(false, false)).toBe(true);
    });

    it('should return false for different primitives', () => {
      expect(deepEqual('test', 'other')).toBe(false);
      expect(deepEqual(42, 43)).toBe(false);
      expect(deepEqual(true, false)).toBe(false);
    });

    it('should return true for undefined === undefined', () => {
      expect(deepEqual()).toBe(true);
    });

    it('should return true for undefined === undefined', () => {
      expect(deepEqual()).toBe(true);
    });

    it('should return false for different value types', () => {
      expect(deepEqual('value')).toBe(false);
      expect(deepEqual(undefined, 'value')).toBe(false);
    });

    it('should return true for empty objects', () => {
      expect(deepEqual({}, {})).toBe(true);
    });

    it('should return true for empty arrays', () => {
      expect(deepEqual([], [])).toBe(true);
    });

    it('should return true for simple objects with same key-value pairs', () => {
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    });

    it('should return false for simple objects with different values', () => {
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
    });

    it('should return false for objects with different key sets', () => {
      expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
      expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    });

    it('should return true for nested objects with same structure', () => {
      const object1 = { a: { b: { c: 1 } } };
      const object2 = { a: { b: { c: 1 } } };
      expect(deepEqual(object1, object2)).toBe(true);
    });

    it('should return false for nested objects with different structure', () => {
      const object1 = { a: { b: { c: 1 } } };
      const object2 = { a: { b: { c: 2 } } };
      expect(deepEqual(object1, object2)).toBe(false);
    });

    it('should return true for arrays with same elements in same order after normalization', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    it('should return true for arrays with same elements in different order (normalized)', () => {
      expect(deepEqual([3, 1, 2], [1, 2, 3])).toBe(true);
    });

    it('should return false for arrays with different lengths', () => {
      expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it('should return true for arrays of objects with matching content', () => {
      expect(deepEqual([{ a: 1 }, { b: 2 }], [{ a: 1 }, { b: 2 }])).toBe(true);
    });

    it('should return true for nested arrays equality', () => {
      expect(
        deepEqual(
          [
            [1, 2],
            [3, 4]
          ],
          [
            [1, 2],
            [3, 4]
          ]
        )
      ).toBe(true);
    });

    it('should return true for empty object vs empty array (both normalized to empty)', () => {
      expect(deepEqual({}, [])).toBe(true);
      expect(deepEqual([], {})).toBe(true);
    });

    it('should return false for mixed type comparison (string vs number)', () => {
      expect(deepEqual('42', 42)).toBe(false);
      expect(deepEqual(0, '')).toBe(false);
    });

    it('should return true for object with array values', () => {
      const object1 = { items: [1, 2, 3] };
      const object2 = { items: [1, 2, 3] };
      expect(deepEqual(object1, object2)).toBe(true);
    });

    it('should return true for array with object elements', () => {
      const array1 = [{ name: 'test' }];
      const array2 = [{ name: 'test' }];
      expect(deepEqual(array1, array2)).toBe(true);
    });

    it('should handle deep nested structures (5+ levels)', () => {
      const object1 = { a: { b: { c: { d: { e: 'deep' } } } } };
      const object2 = { a: { b: { c: { d: { e: 'deep' } } } } };
      expect(deepEqual(object1, object2)).toBe(true);
    });

    it('should handle objects with special characters in keys', () => {
      const object1 = { 'key-with-dash': 1, 'key.with.dot': 2 };
      const object2 = { 'key-with-dash': 1, 'key.with.dot': 2 };
      expect(deepEqual(object1, object2)).toBe(true);
    });

    it('should handle objects with numeric keys', () => {
      const object1 = { 0: 'zero', 1: 'one' };
      const object2 = { 0: 'zero', 1: 'one' };
      expect(deepEqual(object1, object2)).toBe(true);
    });

    it('should handle arrays with undefined elements', () => {
      expect(deepEqual([undefined, 1, undefined], [undefined, 1, undefined])).toBe(true);
    });

    it('should handle arrays with undefined elements', () => {
      expect(deepEqual([undefined, 1, undefined], [undefined, 1, undefined])).toBe(true);
    });

    it('should handle object with undefined values', () => {
      const object1 = { a: undefined, b: 1 };
      const object2 = { a: undefined, b: 1 };
      expect(deepEqual(object1, object2)).toBe(true);
    });

    it('should handle object with undefined values', () => {
      const object1 = { a: undefined, b: 1 };
      const object2 = { a: undefined, b: 1 };
      expect(deepEqual(object1, object2)).toBe(true);
    });

    it('should return true for normalized arrays equality (sorted)', () => {
      expect(deepEqual([3, 1, 2], [2, 3, 1])).toBe(true);
    });

    it('should handle complex YAML-like structures', () => {
      const yaml1 = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: { name: 'app', namespace: 'default' },
        spec: { ports: [{ port: 80 }, { port: 443 }] }
      };
      const yaml2 = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: { name: 'app', namespace: 'default' },
        spec: { ports: [{ port: 80 }, { port: 443 }] }
      };
      expect(deepEqual(yaml1, yaml2)).toBe(true);
    });

    it('should return false when objects differ in nested arrays', () => {
      const object1 = { items: [1, 2, 3] };
      const object2 = { items: [1, 2, 4] };
      expect(deepEqual(object1, object2)).toBe(false);
    });

    it('should handle large arrays efficiently', () => {
      const array1 = Array.from({ length: 100 }, (_, index) => index);
      const array2 = Array.from({ length: 100 }, (_, index) => index);
      expect(deepEqual(array1, array2)).toBe(true);
    });

    it('should return true for objects with different key order', () => {
      const object1 = { z: 3, a: 1, m: 2 };
      const object2 = { a: 1, m: 2, z: 3 };
      expect(deepEqual(object1, object2)).toBe(true);
    });
  });
});
