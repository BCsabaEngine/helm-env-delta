import { describe, expect, it } from 'vitest';

import {
  ApplicableFilter,
  findMatchingTargetItem,
  getApplicableArrayFilters,
  itemMatchesAnyFilter,
  shouldPreserveItem
} from '../../src/utils/arrayMerger';

// Helper to create filter with full parameters (for itemMatchesAnyFilter and shouldPreserveItem tests)
const createFullFilter = (
  property: string,
  value: string,
  operator: 'eq' | 'startsWith' | 'endsWith' | 'contains' = 'eq'
): ApplicableFilter => ({
  filter: { property, value, operator },
  remainingPath: []
});

// Helper to create filter with just property (for findMatchingTargetItem tests)
const createPropertyFilter = (property: string): ApplicableFilter => ({
  filter: { property, value: '', operator: 'eq' },
  remainingPath: []
});

describe('utils/arrayMerger', () => {
  describe('getApplicableArrayFilters', () => {
    it('should return empty array when no skipPaths provided', () => {
      const result = getApplicableArrayFilters(['spec', 'containers'], []);
      expect(result).toEqual([]);
    });

    it('should return empty array when skipPath has no filter segment', () => {
      const result = getApplicableArrayFilters(['spec'], ['spec.containers.resources']);
      expect(result).toEqual([]);
    });

    it('should return filter for exact path prefix with filter segment', () => {
      const result = getApplicableArrayFilters(['spec', 'containers'], ['spec.containers[name=nginx].resources']);
      expect(result).toHaveLength(1);
      expect(result[0].filter).toEqual({ property: 'name', value: 'nginx', operator: 'eq' });
      expect(result[0].remainingPath).toEqual(['resources']);
    });

    it('should return filter with empty remaining path for terminal filter', () => {
      const result = getApplicableArrayFilters(['env'], ['env[name=DEBUG]']);
      expect(result).toHaveLength(1);
      expect(result[0].filter).toEqual({ property: 'name', value: 'DEBUG', operator: 'eq' });
      expect(result[0].remainingPath).toEqual([]);
    });

    it('should handle startsWith operator', () => {
      const result = getApplicableArrayFilters(['env'], ['env[name^=DB_]']);
      expect(result).toHaveLength(1);
      expect(result[0].filter).toEqual({ property: 'name', value: 'DB_', operator: 'startsWith' });
    });

    it('should handle endsWith operator', () => {
      const result = getApplicableArrayFilters(['env'], ['env[name$=_SECRET]']);
      expect(result).toHaveLength(1);
      expect(result[0].filter).toEqual({ property: 'name', value: '_SECRET', operator: 'endsWith' });
    });

    it('should handle contains operator', () => {
      const result = getApplicableArrayFilters(['env'], ['env[name*=PASSWORD]']);
      expect(result).toHaveLength(1);
      expect(result[0].filter).toEqual({ property: 'name', value: 'PASSWORD', operator: 'contains' });
    });

    it('should return multiple filters from multiple skipPaths', () => {
      const skipPaths = ['env[name=DEBUG]', 'env[name=SECRET]', 'env[name^=DB_]'];
      const result = getApplicableArrayFilters(['env'], skipPaths);
      expect(result).toHaveLength(3);
    });

    it('should not match when currentPath is longer than skipPath', () => {
      const result = getApplicableArrayFilters(['spec', 'containers', 'env'], ['spec.containers']);
      expect(result).toEqual([]);
    });

    it('should not match when currentPath is not a prefix', () => {
      const result = getApplicableArrayFilters(['spec', 'volumes'], ['spec.containers[name=nginx]']);
      expect(result).toEqual([]);
    });

    it('should handle nested paths correctly', () => {
      const result = getApplicableArrayFilters(
        ['spec', 'template', 'spec', 'containers'],
        ['spec.template.spec.containers[name=app].env[name=DEBUG]']
      );
      expect(result).toHaveLength(1);
      expect(result[0].filter).toEqual({ property: 'name', value: 'app', operator: 'eq' });
      // Remaining path contains parsed segments (filter segments use internal format)
      expect(result[0].remainingPath).toEqual(['env', 'filter:name:eq:DEBUG']);
    });

    it('should return empty when filter is not at the expected position', () => {
      // When currentPath is [], the next segment must be a filter segment
      // But 'containers[name=nginx]' parses to ['containers', 'filter:name:eq:nginx']
      // So segment[0] is 'containers', not a filter - returns empty
      const result = getApplicableArrayFilters([], ['containers[name=nginx]']);
      expect(result).toEqual([]);
    });

    it('should match filter at root level when first segment is a filter', () => {
      // A skipPath that starts with a filter segment (e.g., [name=nginx].resources)
      // would match at root level - but typical usage has a path prefix
      const result = getApplicableArrayFilters(['containers'], ['containers[name=nginx]']);
      expect(result).toHaveLength(1);
      expect(result[0].filter).toEqual({ property: 'name', value: 'nginx', operator: 'eq' });
    });
  });

  describe('itemMatchesAnyFilter', () => {
    it('should return false for null item', () => {
      // eslint-disable-next-line unicorn/no-null
      const result = itemMatchesAnyFilter(null, [createFullFilter('name', 'test')]);
      expect(result).toEqual({ matches: false });
    });

    it('should return false for undefined item', () => {
      const result = itemMatchesAnyFilter(undefined, [createFullFilter('name', 'test')]);
      expect(result).toEqual({ matches: false });
    });

    it('should return false for primitive item', () => {
      const result = itemMatchesAnyFilter('string', [createFullFilter('name', 'test')]);
      expect(result).toEqual({ matches: false });
    });

    it('should return false when no filters match', () => {
      const item = { name: 'other' };
      const result = itemMatchesAnyFilter(item, [createFullFilter('name', 'test')]);
      expect(result).toEqual({ matches: false });
    });

    it('should match with eq operator', () => {
      const item = { name: 'DEBUG' };
      const filter = createFullFilter('name', 'DEBUG', 'eq');
      const result = itemMatchesAnyFilter(item, [filter]);
      expect(result.matches).toBe(true);
      expect(result.matchedFilter).toBe(filter);
    });

    it('should match with startsWith operator', () => {
      const item = { name: 'DB_HOST' };
      const filter = createFullFilter('name', 'DB_', 'startsWith');
      const result = itemMatchesAnyFilter(item, [filter]);
      expect(result.matches).toBe(true);
    });

    it('should match with endsWith operator', () => {
      const item = { name: 'API_SECRET' };
      const filter = createFullFilter('name', '_SECRET', 'endsWith');
      const result = itemMatchesAnyFilter(item, [filter]);
      expect(result.matches).toBe(true);
    });

    it('should match with contains operator', () => {
      const item = { name: 'MY_PASSWORD_HASH' };
      const filter = createFullFilter('name', 'PASSWORD', 'contains');
      const result = itemMatchesAnyFilter(item, [filter]);
      expect(result.matches).toBe(true);
    });

    it('should return first matching filter', () => {
      const item = { name: 'DEBUG', value: 'true' };
      const filter1 = createFullFilter('name', 'OTHER');
      const filter2 = createFullFilter('name', 'DEBUG');
      const filter3 = createFullFilter('value', 'true');
      const result = itemMatchesAnyFilter(item, [filter1, filter2, filter3]);
      expect(result.matches).toBe(true);
      expect(result.matchedFilter).toBe(filter2);
    });

    it('should not match when property does not exist', () => {
      const item = { value: 'test' };
      const result = itemMatchesAnyFilter(item, [createFullFilter('name', 'test')]);
      expect(result).toEqual({ matches: false });
    });

    it('should handle empty filters array', () => {
      const item = { name: 'test' };
      const result = itemMatchesAnyFilter(item, []);
      expect(result).toEqual({ matches: false });
    });
  });

  describe('findMatchingTargetItem', () => {
    it('should return undefined for null source item', () => {
      // eslint-disable-next-line unicorn/no-null
      const result = findMatchingTargetItem(null, [{ name: 'test' }], [createPropertyFilter('name')]);
      expect(result).toBeUndefined();
    });

    it('should return undefined for primitive source item', () => {
      const result = findMatchingTargetItem('string', [{ name: 'test' }], [createPropertyFilter('name')]);
      expect(result).toBeUndefined();
    });

    it('should return undefined when no matching item in target', () => {
      const source = { name: 'foo' };
      const target = [{ name: 'bar' }, { name: 'baz' }];
      const result = findMatchingTargetItem(source, target, [createPropertyFilter('name')]);
      expect(result).toBeUndefined();
    });

    it('should find matching item by property value', () => {
      const source = { name: 'nginx', image: 'nginx:latest' };
      const target = [
        { name: 'sidecar', image: 'sidecar:v1' },
        { name: 'nginx', image: 'nginx:1.19' }
      ];
      const result = findMatchingTargetItem(source, target, [createPropertyFilter('name')]);
      expect(result).toEqual({ name: 'nginx', image: 'nginx:1.19' });
    });

    it('should match on any filter property and return first matching target item', () => {
      const source = { name: 'app', id: '123' };
      const target = [
        { name: 'other', id: '123' },
        { name: 'app', id: '456' }
      ];
      const filters = [createPropertyFilter('name'), createPropertyFilter('id')];
      // First target item matches on 'id' (both have id: '123'), so it's returned first
      const result = findMatchingTargetItem(source, target, filters);
      expect(result).toEqual({ name: 'other', id: '123' });
    });

    it('should prioritize name match when it comes first in target array', () => {
      const source = { name: 'app', id: '123' };
      const target = [
        { name: 'app', id: '456' },
        { name: 'other', id: '123' }
      ];
      const filters = [createPropertyFilter('name'), createPropertyFilter('id')];
      // First target item matches on 'name' (both have name: 'app')
      const result = findMatchingTargetItem(source, target, filters);
      expect(result).toEqual({ name: 'app', id: '456' });
    });

    it('should skip non-object items in target array', () => {
      const source = { name: 'test' };
      // eslint-disable-next-line unicorn/no-null
      const target = [null, 'string', { name: 'test', value: 'found' }];
      const result = findMatchingTargetItem(source, target, [createPropertyFilter('name')]);
      expect(result).toEqual({ name: 'test', value: 'found' });
    });

    it('should return first matching item when multiple matches exist', () => {
      const source = { name: 'test' };
      const target = [
        { name: 'test', order: 1 },
        { name: 'test', order: 2 }
      ];
      const result = findMatchingTargetItem(source, target, [createPropertyFilter('name')]);
      expect(result).toEqual({ name: 'test', order: 1 });
    });

    it('should handle empty target array', () => {
      const source = { name: 'test' };
      const result = findMatchingTargetItem(source, [], [createPropertyFilter('name')]);
      expect(result).toBeUndefined();
    });
  });

  describe('shouldPreserveItem', () => {
    it('should return false for null item', () => {
      // eslint-disable-next-line unicorn/no-null
      const result = shouldPreserveItem(null, [createFullFilter('name', 'test')], []);
      expect(result).toBe(false);
    });

    it('should return false for primitive item', () => {
      const result = shouldPreserveItem('string', [createFullFilter('name', 'test')], []);
      expect(result).toBe(false);
    });

    it('should return false when item does not match any filter', () => {
      const item = { name: 'other' };
      const result = shouldPreserveItem(item, [createFullFilter('name', 'DEBUG')], []);
      expect(result).toBe(false);
    });

    it('should return true when item matches filter and not in result', () => {
      const item = { name: 'DEBUG', value: 'true' };
      const result = shouldPreserveItem(item, [createFullFilter('name', 'DEBUG')], []);
      expect(result).toBe(true);
    });

    it('should return false when item is duplicate in result (same filter property)', () => {
      const item = { name: 'DEBUG', value: 'old' };
      const existingResult = [{ name: 'DEBUG', value: 'new' }];
      const result = shouldPreserveItem(item, [createFullFilter('name', 'DEBUG')], existingResult);
      expect(result).toBe(false);
    });

    it('should return true when different filter property value', () => {
      const item = { name: 'SECRET', value: 'xyz' };
      const existingResult = [{ name: 'DEBUG', value: 'abc' }];
      const result = shouldPreserveItem(item, [createFullFilter('name', 'SECRET')], existingResult);
      expect(result).toBe(true);
    });

    it('should check all filter properties for duplicate detection', () => {
      const item = { name: 'app', port: 8080 };
      const existingResult = [{ name: 'app', port: 8081 }];
      const filters = [createFullFilter('name', 'app'), createFullFilter('port', '8080')];
      // Both filter properties must match for duplicate
      // Since 8080 !== 8081, it's not a duplicate based on all filter props
      const result = shouldPreserveItem(item, filters, existingResult);
      expect(result).toBe(true);
    });

    it('should preserve item matching startsWith filter', () => {
      const item = { name: 'DB_HOST', value: 'localhost' };
      const result = shouldPreserveItem(item, [createFullFilter('name', 'DB_', 'startsWith')], []);
      expect(result).toBe(true);
    });

    it('should preserve item matching endsWith filter', () => {
      const item = { name: 'API_SECRET', value: 'xyz' };
      const result = shouldPreserveItem(item, [createFullFilter('name', '_SECRET', 'endsWith')], []);
      expect(result).toBe(true);
    });

    it('should preserve item matching contains filter', () => {
      const item = { name: 'MY_PASSWORD_HASH', value: 'hash' };
      const result = shouldPreserveItem(item, [createFullFilter('name', 'PASSWORD', 'contains')], []);
      expect(result).toBe(true);
    });

    it('should skip non-object items in existingResult for duplicate check', () => {
      const item = { name: 'DEBUG', value: 'true' };
      // eslint-disable-next-line unicorn/no-null
      const existingResult = [null, 'string', undefined];
      const result = shouldPreserveItem(item, [createFullFilter('name', 'DEBUG')], existingResult);
      expect(result).toBe(true);
    });

    it('should handle empty filters array', () => {
      const item = { name: 'test' };
      const result = shouldPreserveItem(item, [], []);
      expect(result).toBe(false);
    });
  });
});
