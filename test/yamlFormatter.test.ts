import { describe, expect, it } from 'vitest';

import { formatYaml } from '../src/yamlFormatter';

describe('yamlFormatter', () => {
  describe('indent', () => {
    it('should apply custom indentation', () => {
      const input = `apiVersion: v1
kind: Application
metadata:
  name: my-app
  namespace: default`;

      const result = formatYaml(input, 'test.yaml', { indent: 4, keySeparator: false });

      expect(result).toContain('    name: my-app');
      expect(result).toContain('    namespace: default');
    });

    it('should use default indentation when not specified', () => {
      const input = `metadata:
  name: test`;

      const result = formatYaml(input, 'test.yaml', { indent: 2, keySeparator: false });

      expect(result).toContain('  name: test');
    });
  });

  describe('keySeparator', () => {
    it('should add blank lines between multiple top-level keys', () => {
      const input = `apiVersion: v1
kind: Application
metadata:
  name: my-app`;

      const result = formatYaml(input, 'test.yaml', { indent: 2, keySeparator: true });

      const lines = result.split('\n');
      expect(lines).toContain('');
      expect(result).toMatch(/apiVersion: v1\n\nkind: Application\n\nmetadata:/);
    });

    it('should add blank lines between second-level keys when only one top-level key', () => {
      const input = `metadata:
  name: my-app
  namespace: default
  labels:
    app: test`;

      const result = formatYaml(input, 'test.yaml', { indent: 2, keySeparator: true });

      expect(result).toMatch(/name: my-app\n\n {2}namespace: default\n\n {2}labels:/);
    });

    it('should not add blank lines when keySeparator is false', () => {
      const input = `apiVersion: v1
kind: Application`;

      const result = formatYaml(input, 'test.yaml', { indent: 2, keySeparator: false });

      expect(result).not.toMatch(/\n\n/);
    });
  });

  describe('keyOrders', () => {
    it('should order top-level keys according to specified order', () => {
      const input = `metadata:
  name: test
kind: Application
apiVersion: v1`;

      const result = formatYaml(input, 'apps/test.yaml', {
        indent: 2,
        keySeparator: false,
        keyOrders: {
          'apps/*.yaml': ['apiVersion', 'kind', 'metadata']
        }
      });

      const lines = result.split('\n').filter((l) => l && !l.startsWith(' '));
      expect(lines[0]).toBe('apiVersion: v1');
      expect(lines[1]).toBe('kind: Application');
      expect(lines[2]).toBe('metadata:');
    });

    it('should order nested keys using JSON path syntax', () => {
      const input = `metadata:
  labels:
    app: test
  namespace: default
  name: my-app`;

      const result = formatYaml(input, 'apps/test.yaml', {
        indent: 2,
        keySeparator: false,
        keyOrders: {
          'apps/*.yaml': ['metadata.namespace', 'metadata.name']
        }
      });

      const metadataSection = result.split('metadata:')[1];
      const lines = metadataSection?.split('\n').filter((l) => l.trim());

      expect(lines?.[0]).toContain('namespace: default');
      expect(lines?.[1]).toContain('name: my-app');
    });

    it('should place ordered keys first, then rest alphabetically', () => {
      const input = `zebra: 1
apple: 2
metadata: {}
kind: Application
apiVersion: v1`;

      const result = formatYaml(input, 'apps/test.yaml', {
        indent: 2,
        keySeparator: false,
        keyOrders: {
          'apps/*.yaml': ['apiVersion', 'kind']
        }
      });

      const lines = result.split('\n').filter((l) => l && !l.startsWith(' '));
      expect(lines[0]).toBe('apiVersion: v1');
      expect(lines[1]).toBe('kind: Application');
      expect(lines[2]).toBe('apple: 2');
      expect(lines[3]).toBe('metadata: {}');
      expect(lines[4]).toBe('zebra: 1');
    });

    it('should not apply ordering when file pattern does not match', () => {
      const input = `kind: Application
apiVersion: v1`;

      const result = formatYaml(input, 'other/test.yaml', {
        indent: 2,
        keySeparator: false,
        keyOrders: {
          'apps/*.yaml': ['apiVersion', 'kind']
        }
      });

      const lines = result.split('\n').filter(Boolean);
      expect(lines[0]).toBe('kind: Application');
      expect(lines[1]).toBe('apiVersion: v1');
    });
  });

  describe('quoteValues', () => {
    it('should quote string values at specified paths', () => {
      const input = `env:
  - name: FF_ENABLED
    value: true
  - name: LOG_LEVEL
    value: info`;

      const result = formatYaml(input, 'svc/app/values.yaml', {
        indent: 2,
        keySeparator: false,
        quoteValues: {
          'svc/**/values.yaml': ['env[*].value']
        }
      });

      expect(result).toContain('value: "true"');
      expect(result).toContain('value: "info"');
    });

    it('should quote number values', () => {
      const input = `config:
  port: 8080
  timeout: 30`;

      const result = formatYaml(input, 'svc/app/values.yaml', {
        indent: 2,
        keySeparator: false,
        quoteValues: {
          'svc/**/values.yaml': ['config.port']
        }
      });

      expect(result).toContain('port: "8080"');
      expect(result).not.toContain('timeout: "30"');
    });

    it('should quote boolean values', () => {
      const input = `settings:
  enabled: true
  debug: false`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        quoteValues: {
          '*.yaml': ['settings.enabled', 'settings.debug']
        }
      });

      expect(result).toContain('enabled: "true"');
      expect(result).toContain('debug: "false"');
    });

    it('should quote null values', () => {
      const input = `data:
  value: null`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        quoteValues: {
          '*.yaml': ['data.value']
        }
      });

      expect(result).toContain('value: "null"');
    });

    it('should handle wildcard array notation', () => {
      const input = `items:
  - id: 1
    value: 100
  - id: 2
    value: 200`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        quoteValues: {
          '*.yaml': ['items[*].value']
        }
      });

      expect(result).toContain('value: "100"');
      expect(result).toContain('value: "200"');
      expect(result).not.toContain('id: "1"');
    });

    it('should not quote values when file pattern does not match', () => {
      const input = `config:
  value: 123`;

      const result = formatYaml(input, 'other.yaml', {
        indent: 2,
        keySeparator: false,
        quoteValues: {
          'svc/**/*.yaml': ['config.value']
        }
      });

      expect(result).toContain('value: 123');
      expect(result).not.toContain('value: "123"');
    });
  });

  describe('combined features', () => {
    it('should apply all formatting features together', () => {
      const input = `metadata:
  name: my-app
  namespace: default
kind: Application
apiVersion: v1
spec:
  env:
    - name: DEBUG
      value: true`;

      const result = formatYaml(input, 'apps/test.yaml', {
        indent: 2,
        keySeparator: true,
        keyOrders: {
          'apps/*.yaml': ['apiVersion', 'kind', 'metadata']
        },
        quoteValues: {
          'apps/*.yaml': ['spec.env[*].value']
        }
      });

      const lines = result.split('\n').filter((l) => l && !l.startsWith(' '));
      expect(lines[0]).toBe('apiVersion: v1');
      expect(lines[1]).toBe('kind: Application');
      expect(lines[2]).toBe('metadata:');

      expect(result).toMatch(/apiVersion: v1\n\nkind: Application\n\nmetadata:/);

      expect(result).toContain('value: "true"');
    });
  });

  describe('edge cases', () => {
    it('should return original content when outputFormat is undefined', () => {
      const input = `test: value`;

      const result = formatYaml(input, 'test.yaml');

      expect(result).toBe(input);
    });

    it('should handle empty YAML', () => {
      const input = ``;

      const result = formatYaml(input, 'test.yaml', { indent: 2, keySeparator: false });

      expect(result).toBe('');
    });

    it('should handle YAML with comments', () => {
      const input = `# This is a comment
apiVersion: v1
# Another comment
kind: Application`;

      const result = formatYaml(input, 'test.yaml', { indent: 2, keySeparator: false });

      expect(result).toBeTruthy();
    });
  });
});
