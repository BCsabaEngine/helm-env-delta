import { describe, expect, it } from 'vitest';

import { computeLineToJsonPath, serializeLineMapping } from '../../src/utils/yamlLineMapping';

describe('utils/yamlLineMapping', () => {
  describe('computeLineToJsonPath', () => {
    it('should map simple key-value pairs', () => {
      const yaml = `name: test
version: 1.0.0`;

      const mapping = computeLineToJsonPath(yaml);

      expect(mapping.lineToPath.get(1)).toEqual({ path: 'name', value: 'test' });
      expect(mapping.lineToPath.get(2)).toEqual({ path: 'version', value: '1.0.0' });
    });

    it('should map nested objects', () => {
      const yaml = `image:
  repository: nginx
  tag: latest`;

      const mapping = computeLineToJsonPath(yaml);

      expect(mapping.lineToPath.get(1)).toEqual({
        path: 'image',
        value: { repository: 'nginx', tag: 'latest' }
      });
      expect(mapping.lineToPath.get(2)).toEqual({ path: 'image.repository', value: 'nginx' });
      expect(mapping.lineToPath.get(3)).toEqual({ path: 'image.tag', value: 'latest' });
    });

    it('should map arrays with name field using filter notation', () => {
      const yaml = `env:
  - name: DEBUG
    value: "true"
  - name: PORT
    value: "8080"`;

      const mapping = computeLineToJsonPath(yaml);

      // Check that filter notation paths are generated somewhere in the mapping
      const paths = [...mapping.lineToPath.values()].map((info) => info.path);
      const hasDebugPath = paths.some((p) => p.includes('env[name=DEBUG]'));
      const hasPortPath = paths.some((p) => p.includes('env[name=PORT]'));

      expect(hasDebugPath).toBe(true);
      expect(hasPortPath).toBe(true);
    });

    it('should map arrays without key field using numeric index', () => {
      const yaml = `items:
  - first
  - second`;

      const mapping = computeLineToJsonPath(yaml);

      expect(mapping.lineToPath.get(2)).toEqual({ path: 'items.0', value: 'first' });
      expect(mapping.lineToPath.get(3)).toEqual({ path: 'items.1', value: 'second' });
    });

    it('should handle empty YAML content', () => {
      const yaml = '';
      const mapping = computeLineToJsonPath(yaml);

      expect(mapping.lineToPath.size).toBe(0);
      expect(mapping.pathToLine.size).toBe(0);
    });

    it('should handle invalid YAML gracefully', () => {
      // Use YAML that will fail to parse - tabs in YAML content
      const yaml = '\t\t\t\u0000\u0001\u0002';

      const mapping = computeLineToJsonPath(yaml);

      // Should not throw and should return a result (possibly empty or partial)
      expect(mapping).toBeDefined();
      expect(mapping.lineToPath).toBeInstanceOf(Map);
      expect(mapping.pathToLine).toBeInstanceOf(Map);
    });

    it('should handle deeply nested structures', () => {
      const yaml = `spec:
  template:
    spec:
      containers:
        - name: app
          image: nginx`;

      const mapping = computeLineToJsonPath(yaml);

      // Check that nested paths are generated correctly
      const paths = [...mapping.lineToPath.values()].map((info) => info.path);
      expect(paths).toContain('spec');
      expect(paths).toContain('spec.template');
      expect(paths).toContain('spec.template.spec');
    });

    it('should map boolean and numeric values', () => {
      const yaml = `debug: true
replicas: 3
enabled: false`;

      const mapping = computeLineToJsonPath(yaml);

      expect(mapping.lineToPath.get(1)).toEqual({ path: 'debug', value: true });
      expect(mapping.lineToPath.get(2)).toEqual({ path: 'replicas', value: 3 });
      expect(mapping.lineToPath.get(3)).toEqual({ path: 'enabled', value: false });
    });

    it('should map null values', () => {
      const yaml = `value: null`;

      const mapping = computeLineToJsonPath(yaml);

      // eslint-disable-next-line unicorn/no-null -- YAML null is valid
      expect(mapping.lineToPath.get(1)).toEqual({ path: 'value', value: null });
    });

    it('should populate pathToLine reverse mapping', () => {
      const yaml = `name: test
version: 1.0.0`;

      const mapping = computeLineToJsonPath(yaml);

      expect(mapping.pathToLine.get('name')).toBe(1);
      expect(mapping.pathToLine.get('version')).toBe(2);
    });

    it('should use id field as key field', () => {
      const yaml = `items:
  - id: item1
    data: value1
  - id: item2
    data: value2`;

      const mapping = computeLineToJsonPath(yaml);

      const line2 = mapping.lineToPath.get(2);
      expect(line2?.path).toContain('items[id=item1]');
    });

    it('should use key field as key field', () => {
      const yaml = `entries:
  - key: first
    value: 1
  - key: second
    value: 2`;

      const mapping = computeLineToJsonPath(yaml);

      const line2 = mapping.lineToPath.get(2);
      expect(line2?.path).toContain('entries[key=first]');
    });

    it('should handle multi-line strings', () => {
      const yaml = `description: |
  This is a
  multi-line
  description`;

      const mapping = computeLineToJsonPath(yaml);

      expect(mapping.lineToPath.get(1)?.path).toBe('description');
    });
  });

  describe('serializeLineMapping', () => {
    it('should convert Map to plain object', () => {
      const yaml = `name: test
version: 1.0.0`;

      const mapping = computeLineToJsonPath(yaml);
      const serialized = serializeLineMapping(mapping);

      expect(serialized[1]).toEqual({ path: 'name', value: 'test' });
      expect(serialized[2]).toEqual({ path: 'version', value: '1.0.0' });
    });

    it('should handle empty mapping', () => {
      const yaml = '';
      const mapping = computeLineToJsonPath(yaml);
      const serialized = serializeLineMapping(mapping);

      expect(Object.keys(serialized)).toHaveLength(0);
    });

    it('should produce JSON-serializable output', () => {
      const yaml = `image:
  tag: v1.0.0
env:
  - name: DEBUG
    value: "true"`;

      const mapping = computeLineToJsonPath(yaml);
      const serialized = serializeLineMapping(mapping);

      // Should not throw when stringified
      expect(() => JSON.stringify(serialized)).not.toThrow();

      // Should be valid after JSON round-trip (testing JSON serialization, not cloning)
      // eslint-disable-next-line unicorn/prefer-structured-clone -- testing JSON serialization
      const parsed = JSON.parse(JSON.stringify(serialized)) as Record<number, unknown>;
      expect(parsed[2]).toEqual({ path: 'image.tag', value: 'v1.0.0' });
    });
  });
});
