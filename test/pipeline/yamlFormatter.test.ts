import { describe, expect, it } from 'vitest';

import { formatYaml } from '../../src/pipeline/yamlFormatter';

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

      // Should NOT have blank line after top-level key
      expect(result).toMatch(/metadata:\n {2}name: my-app/);
      // Should have blank lines BETWEEN second-level keys
      expect(result).toMatch(/name: my-app\n\n {2}namespace: default/);
      expect(result).toMatch(/namespace: default\n\n {2}labels:/);
    });

    it('should not add blank line before first second-level key with nested structure', () => {
      const input = `microservice:
  image:
    repository: test
    tag: v1.0.0
  resources:
    requests:
      memory: 512Mi`;

      const result = formatYaml(input, 'test.yaml', { indent: 2, keySeparator: true });

      // No blank line after microservice:
      expect(result).toMatch(/microservice:\n {2}image:/);
      // Blank line between image and resources
      expect(result).toMatch(/tag: v1\.0\.0\n\n {2}resources:/);
    });

    it('should not add blank lines when keySeparator is false', () => {
      const input = `apiVersion: v1
kind: Application`;

      const result = formatYaml(input, 'test.yaml', { indent: 2, keySeparator: false });

      expect(result).not.toMatch(/\n\n/);
    });

    it('should filter whitespace-only lines to prevent consecutive blank lines', () => {
      // Simulate input that might have whitespace-only lines after processing
      const input = `microservice:
  image:
    repository: test
  resources:
    memory: 512Mi`;

      const result = formatYaml(input, 'test.yaml', { indent: 2, keySeparator: true });

      // Should have exactly one blank line between second-level keys, not multiple
      expect(result).not.toMatch(/\n{3}/); // No triple newlines (two consecutive blank lines)
      // Should have proper structure with single blank lines
      expect(result).toMatch(/microservice:\n {2}image:/);
      expect(result).toMatch(/repository: test\n\n {2}resources:/);
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

  describe('arraySort', () => {
    it('should sort array items by string field in ascending order', () => {
      const input = `env:
  - name: ZEBRA
    value: z
  - name: ALPHA
    value: a
  - name: BETA
    value: b`;

      const result = formatYaml(input, 'svc/app/values.yaml', {
        indent: 2,
        keySeparator: false,
        arraySort: {
          'svc/**/values.yaml': [{ path: 'env', sortBy: 'name', order: 'asc' }]
        }
      });

      const lines = result.split('\n');
      const names = lines.filter((l) => l.includes('name:'));

      expect(names[0]).toContain('ALPHA');
      expect(names[1]).toContain('BETA');
      expect(names[2]).toContain('ZEBRA');
    });

    it('should sort array items in descending order', () => {
      const input = `items:
  - priority: 1
  - priority: 3
  - priority: 2`;

      const result = formatYaml(input, 'config.yaml', {
        indent: 2,
        keySeparator: false,
        arraySort: {
          '*.yaml': [{ path: 'items', sortBy: 'priority', order: 'desc' }]
        }
      });

      const lines = result.split('\n');
      const priorities = lines
        .filter((l) => l.includes('priority:'))
        .map((l) => Number.parseInt(l.split(':')[1].trim()));

      expect(priorities).toEqual([3, 2, 1]);
    });

    it('should place items without sortBy field at the end in original order', () => {
      const input = `env:
  - name: CHARLIE
    value: c
  - value: missing-name-1
  - name: ALPHA
    value: a
  - value: missing-name-2
  - name: BRAVO
    value: b`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        arraySort: {
          '*.yaml': [{ path: 'env', sortBy: 'name', order: 'asc' }]
        }
      });

      const lines = result.split('\n').filter((l) => l.includes('value:'));

      expect(lines[0]).toContain('a');
      expect(lines[1]).toContain('b');
      expect(lines[2]).toContain('c');
      expect(lines[3]).toContain('missing-name-1');
      expect(lines[4]).toContain('missing-name-2');
    });

    it('should sort strings case-insensitively', () => {
      const input = `items:
  - name: zebra
  - name: ALPHA
  - name: Beta`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        arraySort: {
          '*.yaml': [{ path: 'items', sortBy: 'name', order: 'asc' }]
        }
      });

      const lines = result.split('\n');
      const names = lines.filter((l) => l.includes('name:')).map((l) => l.split(':')[1].trim());

      expect(names[0]).toBe('ALPHA');
      expect(names[1]).toBe('Beta');
      expect(names[2]).toBe('zebra');
    });

    it('should sort numeric values correctly', () => {
      const input = `items:
  - id: 100
  - id: 20
  - id: 3`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        arraySort: {
          '*.yaml': [{ path: 'items', sortBy: 'id', order: 'asc' }]
        }
      });

      const lines = result.split('\n');
      const ids = lines.filter((l) => l.includes('id:')).map((l) => Number.parseInt(l.split(':')[1].trim()));

      expect(ids).toEqual([3, 20, 100]);
    });

    it('should sort arrays at nested paths', () => {
      const input = `microservice:
  env:
    - name: ZEBRA
      value: z
    - name: ALPHA
      value: a`;

      const result = formatYaml(input, 'svc/app/values.yaml', {
        indent: 2,
        keySeparator: false,
        arraySort: {
          'svc/**/values.yaml': [{ path: 'microservice.env', sortBy: 'name', order: 'asc' }]
        }
      });

      const environmentSection = result.split('env:')[1];
      const names = environmentSection.split('\n').filter((l) => l.includes('name:'));

      expect(names[0]).toContain('ALPHA');
      expect(names[1]).toContain('ZEBRA');
    });

    it('should skip silently when path does not exist', () => {
      const input = `data:
  value: 123`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        arraySort: {
          '*.yaml': [{ path: 'nonexistent.path', sortBy: 'name', order: 'asc' }]
        }
      });

      expect(result).toContain('data:');
      expect(result).toContain('value: 123');
    });

    it('should skip silently when path points to non-array', () => {
      const input = `config:
  name: test
  value: 123`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        arraySort: {
          '*.yaml': [{ path: 'config', sortBy: 'name', order: 'asc' }]
        }
      });

      expect(result).toContain('name: test');
      expect(result).toContain('value: 123');
    });

    it('should handle empty arrays gracefully', () => {
      const input = `items: []`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        arraySort: {
          '*.yaml': [{ path: 'items', sortBy: 'name', order: 'asc' }]
        }
      });

      expect(result).toBe('items: []\n');
    });

    it('should apply multiple sorting rules to different arrays', () => {
      const input = `env:
  - name: Z
  - name: A
cronJobs:
  - name: job-z
  - name: job-a`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        arraySort: {
          '*.yaml': [
            { path: 'env', sortBy: 'name', order: 'asc' },
            { path: 'cronJobs', sortBy: 'name', order: 'asc' }
          ]
        }
      });

      const environmentNames = result
        .split('env:')[1]
        .split('cronJobs:')[0]
        .split('\n')
        .filter((l) => l.includes('name:'));
      const cronNames = result
        .split('cronJobs:')[1]
        .split('\n')
        .filter((l) => l.includes('name:'));

      expect(environmentNames[0]).toContain('A');
      expect(environmentNames[1]).toContain('Z');
      expect(cronNames[0]).toContain('job-a');
      expect(cronNames[1]).toContain('job-z');
    });

    it('should not apply sorting when file pattern does not match', () => {
      const input = `env:
  - name: ZEBRA
  - name: ALPHA`;

      const result = formatYaml(input, 'other/config.yaml', {
        indent: 2,
        keySeparator: false,
        arraySort: {
          'svc/**/values.yaml': [{ path: 'env', sortBy: 'name', order: 'asc' }]
        }
      });

      const lines = result.split('\n');
      const names = lines.filter((l) => l.includes('name:'));

      expect(names[0]).toContain('ZEBRA');
      expect(names[1]).toContain('ALPHA');
    });

    it('should handle mixed string and number types by converting to string', () => {
      const input = `items:
  - id: zebra
  - id: 100
  - id: alpha
  - id: 20`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        arraySort: {
          '*.yaml': [{ path: 'items', sortBy: 'id', order: 'asc' }]
        }
      });

      const lines = result.split('\n');
      const ids = lines.filter((l) => l.includes('id:')).map((l) => l.split(':')[1].trim());

      expect(ids[0]).toBe('20');
      expect(ids[1]).toBe('100');
      expect(ids[2]).toBe('alpha');
      expect(ids[3]).toBe('zebra');
    });

    it('should work with keyOrders and quoteValues', () => {
      const input = `metadata:
  name: test
kind: Pod
env:
  - name: ZEBRA
    value: true
  - name: ALPHA
    value: false`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        keyOrders: {
          '*.yaml': ['kind', 'metadata']
        },
        arraySort: {
          '*.yaml': [{ path: 'env', sortBy: 'name', order: 'asc' }]
        },
        quoteValues: {
          '*.yaml': ['env[*].value']
        }
      });

      const topKeys = result.split('\n').filter((l) => l && !l.startsWith(' '));
      expect(topKeys[0]).toBe('kind: Pod');
      expect(topKeys[1]).toBe('metadata:');

      const environmentSection = result.split('env:')[1];
      const names = environmentSection.split('\n').filter((l) => l.includes('name:'));
      expect(names[0]).toContain('ALPHA');
      expect(names[1]).toContain('ZEBRA');

      expect(result).toContain('value: "true"');
      expect(result).toContain('value: "false"');
    });

    it('should sort scalar string array ascending (no sortBy)', () => {
      const input = `volumes:
  - ccc
  - aaa
  - bbb`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        arraySort: {
          '*.yaml': [{ path: 'volumes', order: 'asc' }]
        }
      });

      const items = result
        .split('\n')
        .filter((l) => l.trim().startsWith('- '))
        .map((l) => l.trim().slice(2));

      expect(items).toEqual(['aaa', 'bbb', 'ccc']);
    });

    it('should sort scalar string array descending (no sortBy)', () => {
      const input = `volumes:
  - ccc
  - aaa
  - bbb`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        arraySort: {
          '*.yaml': [{ path: 'volumes', order: 'desc' }]
        }
      });

      const items = result
        .split('\n')
        .filter((l) => l.trim().startsWith('- '))
        .map((l) => l.trim().slice(2));

      expect(items).toEqual(['ccc', 'bbb', 'aaa']);
    });

    it('should sort scalar number array ascending (no sortBy)', () => {
      const input = `ids:
  - 30
  - 5
  - 100
  - 20`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        arraySort: {
          '*.yaml': [{ path: 'ids', order: 'asc' }]
        }
      });

      const items = result
        .split('\n')
        .filter((l) => l.trim().startsWith('- '))
        .map((l) => Number(l.trim().slice(2)));

      expect(items).toEqual([5, 20, 30, 100]);
    });

    it('should sort scalar array at nested path (no sortBy)', () => {
      const input = `main:
  volumes:
    - ccc
    - aaa
    - bbb
    - 111`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        arraySort: {
          '*.yaml': [{ path: 'main.volumes', order: 'asc' }]
        }
      });

      const volumesSection = result.split('volumes:')[1];
      const items = volumesSection
        .split('\n')
        .filter((l) => l.trim().startsWith('- '))
        .map((l) => l.trim().slice(2));

      expect(items[0]).toBe('111');
      expect(items[1]).toBe('aaa');
      expect(items[2]).toBe('bbb');
      expect(items[3]).toBe('ccc');
    });

    it('should skip sorting (no sortBy) when items are objects', () => {
      const input = `env:
  - name: ZEBRA
    value: z
  - name: ALPHA
    value: a`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        arraySort: {
          '*.yaml': [{ path: 'env', order: 'asc' }]
        }
      });

      // No sortBy → scalar mode; items are objects → skip, order preserved
      const names = result
        .split('\n')
        .filter((l) => l.includes('name:'))
        .map((l) => l.split(':')[1].trim());

      expect(names[0]).toBe('ZEBRA');
      expect(names[1]).toBe('ALPHA');
    });

    it('should skip sorting (with sortBy) when items are scalars', () => {
      const input = `volumes:
  - ccc
  - aaa
  - bbb`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        arraySort: {
          '*.yaml': [{ path: 'volumes', sortBy: 'name', order: 'asc' }]
        }
      });

      // sortBy provided → object mode; items are scalars → skip, order preserved
      const items = result
        .split('\n')
        .filter((l) => l.trim().startsWith('- '))
        .map((l) => l.trim().slice(2));

      expect(items).toEqual(['ccc', 'aaa', 'bbb']);
    });
  });

  describe('keySort', () => {
    it('should sort keys alphabetically at specified path', () => {
      const input = `env:
  vars:
    ZEBRA: z
    ALPHA: a
    MANGO: m`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        keySort: {
          '*.yaml': [{ path: 'env.vars' }]
        }
      });

      const lines = result.split('\n').filter((l) => l.trim() && !l.includes('env:') && !l.includes('vars:'));
      expect(lines[0]).toContain('ALPHA');
      expect(lines[1]).toContain('MANGO');
      expect(lines[2]).toContain('ZEBRA');
    });

    it('should only sort targeted path and leave others unchanged', () => {
      const input = `env:
  vars:
    ZEBRA: z
    ALPHA: a
  config:
    ZEBRA: z
    ALPHA: a`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        keySort: {
          '*.yaml': [{ path: 'env.vars' }]
        }
      });

      const variablesSection = result.split('vars:')[1].split('config:')[0];
      const variablesKeys = variablesSection.split('\n').filter((l) => l.trim());
      expect(variablesKeys[0]).toContain('ALPHA');
      expect(variablesKeys[1]).toContain('ZEBRA');

      const configSection = result.split('config:')[1];
      const configKeys = configSection.split('\n').filter((l) => l.trim());
      expect(configKeys[0]).toContain('ZEBRA');
      expect(configKeys[1]).toContain('ALPHA');
    });

    it('should sort at multiple paths', () => {
      const input = `env:
  vars:
    ZEBRA: z
    ALPHA: a
  config:
    ZEBRA: z
    ALPHA: a`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        keySort: {
          '*.yaml': [{ path: 'env.vars' }, { path: 'env.config' }]
        }
      });

      const variablesSection = result.split('vars:')[1].split('config:')[0];
      const variablesKeys = variablesSection.split('\n').filter((l) => l.trim());
      expect(variablesKeys[0]).toContain('ALPHA');
      expect(variablesKeys[1]).toContain('ZEBRA');

      const configSection = result.split('config:')[1];
      const configKeys = configSection.split('\n').filter((l) => l.trim());
      expect(configKeys[0]).toContain('ALPHA');
      expect(configKeys[1]).toContain('ZEBRA');
    });

    it('should handle nested paths', () => {
      const input = `spec:
  template:
    metadata:
      labels:
        zebra: z
        alpha: a
        beta: b`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        keySort: {
          '*.yaml': [{ path: 'spec.template.metadata.labels' }]
        }
      });

      const labelsSection = result.split('labels:')[1];
      const keys = labelsSection.split('\n').filter((l) => l.trim());
      expect(keys[0]).toContain('alpha');
      expect(keys[1]).toContain('beta');
      expect(keys[2]).toContain('zebra');
    });

    it('should skip silently when path does not exist', () => {
      const input = `data:
  value: 123`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        keySort: {
          '*.yaml': [{ path: 'nonexistent.path' }]
        }
      });

      expect(result).toContain('data:');
      expect(result).toContain('value: 123');
    });

    it('should skip when file pattern does not match', () => {
      const input = `vars:
  ZEBRA: z
  ALPHA: a`;

      const result = formatYaml(input, 'other/config.yaml', {
        indent: 2,
        keySeparator: false,
        keySort: {
          'svc/**/values.yaml': [{ path: 'vars' }]
        }
      });

      const keys = result.split('\n').filter((l) => l.trim() && !l.includes('vars:'));
      expect(keys[0]).toContain('ZEBRA');
      expect(keys[1]).toContain('ALPHA');
    });

    it('should work alongside keyOrders, arraySort, and quoteValues', () => {
      const input = `metadata:
  name: test
kind: Pod
labels:
  zebra: z
  alpha: a
env:
  - name: ZEBRA
    value: true
  - name: ALPHA
    value: false`;

      const result = formatYaml(input, 'test.yaml', {
        indent: 2,
        keySeparator: false,
        keyOrders: {
          '*.yaml': ['kind', 'metadata']
        },
        keySort: {
          '*.yaml': [{ path: 'labels' }]
        },
        arraySort: {
          '*.yaml': [{ path: 'env', sortBy: 'name', order: 'asc' }]
        },
        quoteValues: {
          '*.yaml': ['env[*].value']
        }
      });

      const topKeys = result.split('\n').filter((l) => l && !l.startsWith(' '));
      expect(topKeys[0]).toBe('kind: Pod');
      expect(topKeys[1]).toBe('metadata:');

      const labelsSection = result.split('labels:')[1].split('env:')[0];
      const labelKeys = labelsSection.split('\n').filter((l) => l.trim());
      expect(labelKeys[0]).toContain('alpha');
      expect(labelKeys[1]).toContain('zebra');

      const environmentSection = result.split('env:')[1];
      const names = environmentSection.split('\n').filter((l) => l.includes('name:'));
      expect(names[0]).toContain('ALPHA');
      expect(names[1]).toContain('ZEBRA');

      expect(result).toContain('value: "true"');
      expect(result).toContain('value: "false"');
    });
  });
});
