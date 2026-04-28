import { describe, expect, it } from 'vitest';
import type { Pair, YAMLMap } from 'yaml';
import { parseDocument } from 'yaml';

import {
  extractKeyValue,
  extractScalarValue,
  isScalar,
  isYamlCollection,
  isYamlMap,
  isYamlSeq
} from '../../src/utils/yamlTypeGuards';

const parseNode = (yaml: string) => parseDocument(yaml).contents;

describe('utils/yamlTypeGuards', () => {
  describe('isScalar', () => {
    it('returns true for a scalar node', () => {
      const node = parseNode('hello');
      expect(isScalar(node)).toBe(true);
    });

    it('returns false for a map node', () => {
      const node = parseNode('a: 1');
      expect(isScalar(node)).toBe(false);
    });

    it('returns false for a primitive number', () => {
      expect(isScalar(42)).toBe(false);
    });

    it('returns false for a plain object without YAML node shape', () => {
      expect(isScalar({ foo: 'bar' })).toBe(false);
    });
  });

  describe('isYamlCollection', () => {
    it('returns true for a map node', () => {
      const node = parseNode('a: 1\nb: 2');
      expect(isYamlCollection(node)).toBe(true);
    });

    it('returns true for a sequence node', () => {
      const node = parseNode('- 1\n- 2');
      expect(isYamlCollection(node)).toBe(true);
    });

    it('returns false for a scalar node', () => {
      const node = parseNode('hello');
      expect(isYamlCollection(node)).toBe(false);
    });

    it('returns false for a primitive number', () => {
      expect(isYamlCollection(42)).toBe(false);
    });
  });

  describe('isYamlMap', () => {
    it('returns true for a parsed map', () => {
      const node = parseNode('a: 1\nb: 2');
      expect(isYamlMap(node)).toBe(true);
    });

    it('returns false for a parsed sequence', () => {
      const node = parseNode('- 1\n- 2');
      expect(isYamlMap(node)).toBe(false);
    });

    it('returns false for an empty map (no items to check key presence)', () => {
      const node = parseNode('{}');
      expect(isYamlMap(node)).toBe(false);
    });
  });

  describe('isYamlSeq', () => {
    it('returns true for a parsed sequence', () => {
      const node = parseNode('- 1\n- 2');
      expect(isYamlSeq(node)).toBe(true);
    });

    it('returns false for a parsed map', () => {
      const node = parseNode('a: 1');
      expect(isYamlSeq(node)).toBe(false);
    });
  });

  describe('extractKeyValue', () => {
    it('returns the string key from a Pair with a scalar key', () => {
      const document_ = parseDocument('myKey: myVal');
      const map = document_.contents as YAMLMap;
      const pair = map.items[0]!;
      expect(extractKeyValue(pair)).toBe('myKey');
    });

    it('returns undefined for a Pair with a non-scalar key', () => {
      // Construct a synthetic pair where key is a plain object (no 'value')
      const pair = { key: { notAScalar: true }, value: 'x' } as unknown as Pair;
      expect(extractKeyValue(pair)).toBeUndefined();
    });
  });

  describe('extractScalarValue', () => {
    it('returns the value from a scalar node', () => {
      const node = parseNode('42');
      expect(extractScalarValue(node)).toBe(42);
    });

    it('returns undefined for a non-scalar node', () => {
      const node = parseNode('a: 1');
      expect(extractScalarValue(node)).toBeUndefined();
    });
  });
});
