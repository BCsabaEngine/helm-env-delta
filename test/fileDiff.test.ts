import { describe, expect, it } from 'vitest';

import { computeFileDiff, getSkipPathsForFile } from '../src/fileDiff';

describe('fileDiff', () => {
  describe('computeFileDiff', () => {
    it('should detect added files', () => {
      const source = new Map([['new.yaml', 'content']]);
      const destination = new Map();
      const config = { source: './src', destination: './dest' };

      const result = computeFileDiff(source, destination, config);

      expect(result.addedFiles).toHaveLength(1);
      expect(result.addedFiles[0]?.path).toBe('new.yaml');
      expect(result.addedFiles[0]?.content).toBe('content');
      expect(result.addedFiles[0]?.processedContent).toBeDefined();
      expect(result.deletedFiles).toHaveLength(0);
    });

    it('should detect deleted files when prune enabled', () => {
      const source = new Map();
      const destination = new Map([['old.yaml', 'content']]);
      const config = { source: './src', destination: './dest', prune: true };

      const result = computeFileDiff(source, destination, config);

      expect(result.deletedFiles).toContain('old.yaml');
      expect(result.addedFiles).toHaveLength(0);
    });

    it('should detect unchanged files', () => {
      const source = new Map([['file.yaml', 'content']]);
      const destination = new Map([['file.yaml', 'content']]);
      const config = { source: './src', destination: './dest' };

      const result = computeFileDiff(source, destination, config);

      expect(result.unchangedFiles).toContain('file.yaml');
      expect(result.changedFiles).toHaveLength(0);
    });

    it('should detect changed YAML files', () => {
      const source = new Map([['file.yaml', 'version: 2.0.0']]);
      const destination = new Map([['file.yaml', 'version: 1.0.0']]);
      const config = { source: './src', destination: './dest' };

      const result = computeFileDiff(source, destination, config);

      expect(result.changedFiles).toHaveLength(1);
      expect(result.changedFiles[0]?.path).toBe('file.yaml');
    });

    it('should detect changed non-YAML files', () => {
      const source = new Map([['file.txt', 'new content']]);
      const destination = new Map([['file.txt', 'old content']]);
      const config = { source: './src', destination: './dest' };

      const result = computeFileDiff(source, destination, config);

      expect(result.changedFiles).toHaveLength(1);
    });

    it('should apply skipPath filters', () => {
      const source = new Map([['file.yaml', 'version: 2.0.0\ndata: test']]);
      const destination = new Map([['file.yaml', 'version: 1.0.0\ndata: test']]);
      const config = {
        source: './src',
        destination: './dest',
        skipPath: { '*.yaml': ['version'] }
      };

      const result = computeFileDiff(source, destination, config);

      expect(result.unchangedFiles).toContain('file.yaml');
    });

    it('should handle mixed file types', () => {
      const source = new Map([
        ['file.yaml', 'content'],
        ['file.txt', 'content']
      ]);
      const destination = new Map([
        ['file.yaml', 'different'],
        ['file.txt', 'content']
      ]);
      const config = { source: './src', destination: './dest' };

      const result = computeFileDiff(source, destination, config);

      expect(result.changedFiles).toHaveLength(1);
      expect(result.unchangedFiles).toHaveLength(1);
    });

    it('should return empty arrays when no files', () => {
      const source = new Map();
      const destination = new Map();
      const config = { source: './src', destination: './dest' };

      const result = computeFileDiff(source, destination, config);

      expect(result.addedFiles).toHaveLength(0);
      expect(result.deletedFiles).toHaveLength(0);
      expect(result.changedFiles).toHaveLength(0);
      expect(result.unchangedFiles).toHaveLength(0);
    });
  });

  describe('getSkipPathsForFile', () => {
    it('should return empty array when no skipPath config', () => {
      const result = getSkipPathsForFile('file.yaml');

      expect(result).toEqual([]);
    });

    it('should return paths for matching pattern', () => {
      const skipPath = { '*.yaml': ['version', 'metadata'] };

      const result = getSkipPathsForFile('test.yaml', skipPath);

      expect(result).toEqual(['version', 'metadata']);
    });

    it('should return empty array for non-matching pattern', () => {
      const skipPath = { '*.json': ['version'] };

      const result = getSkipPathsForFile('test.yaml', skipPath);

      expect(result).toEqual([]);
    });

    it('should combine paths from multiple matching patterns', () => {
      const skipPath = {
        '*.yaml': ['version'],
        'test.*': ['metadata']
      };

      const result = getSkipPathsForFile('test.yaml', skipPath);

      expect(result).toContain('version');
      expect(result).toContain('metadata');
    });

    it('should handle glob patterns', () => {
      const skipPath = { 'apps/**/*.yaml': ['secrets'] };

      const result = getSkipPathsForFile('apps/prod/values.yaml', skipPath);

      expect(result).toEqual(['secrets']);
    });
  });

  describe('transforms integration', () => {
    it('should apply transforms before skipPath filtering', () => {
      const source = new Map([['file.yaml', 'url: uat-db.internal\nversion: 1.0.0']]);
      const destination = new Map([['file.yaml', 'url: prod-db.internal\nversion: 1.0.0']]);
      const config = {
        source: './src',
        destination: './dest',
        transforms: {
          '*.yaml': { content: [{ find: 'uat-', replace: 'prod-' }] }
        },
        skipPath: { '*.yaml': ['version'] }
      };

      const result = computeFileDiff(source, destination, config);

      expect(result.unchangedFiles).toContain('file.yaml');
    });

    it('should detect changes from transformed values', () => {
      const source = new Map([['file.yaml', 'url: uat-db.internal']]);
      const destination = new Map([['file.yaml', 'url: old-db.internal']]);
      const config = {
        source: './src',
        destination: './dest',
        transforms: {
          '*.yaml': { content: [{ find: 'uat-', replace: 'prod-' }] }
        }
      };

      const result = computeFileDiff(source, destination, config);

      expect(result.changedFiles).toHaveLength(1);
      expect(result.changedFiles[0]?.path).toBe('file.yaml');
    });

    it('should not detect changes when transform matches destination', () => {
      const source = new Map([['file.yaml', 'url: uat-db.internal']]);
      const destination = new Map([['file.yaml', 'url: prod-db.internal']]);
      const config = {
        source: './src',
        destination: './dest',
        transforms: {
          '*.yaml': { content: [{ find: 'uat-', replace: 'prod-' }] }
        }
      };

      const result = computeFileDiff(source, destination, config);

      expect(result.unchangedFiles).toContain('file.yaml');
    });

    it('should handle files with both transforms and skipPath', () => {
      const source = new Map([['file.yaml', 'url: uat-db.internal\nversion: 2.0.0']]);
      const destination = new Map([['file.yaml', 'url: prod-db.internal\nversion: 1.0.0']]);
      const config = {
        source: './src',
        destination: './dest',
        transforms: {
          '*.yaml': { content: [{ find: 'uat-', replace: 'prod-' }] }
        },
        skipPath: { '*.yaml': ['version'] }
      };

      const result = computeFileDiff(source, destination, config);

      expect(result.unchangedFiles).toContain('file.yaml');
    });

    it('should work without transforms configured', () => {
      const source = new Map([['file.yaml', 'url: uat-db.internal']]);
      const destination = new Map([['file.yaml', 'url: uat-db.internal']]);
      const config = {
        source: './src',
        destination: './dest'
      };

      const result = computeFileDiff(source, destination, config);

      expect(result.unchangedFiles).toContain('file.yaml');
    });

    it('should only transform matching file patterns', () => {
      const source = new Map([
        ['svc/values.yaml', 'url: uat-db.internal'],
        ['apps/config.yaml', 'url: uat-db.internal']
      ]);
      const destination = new Map([
        ['svc/values.yaml', 'url: prod-db.internal'],
        ['apps/config.yaml', 'url: uat-db.internal']
      ]);
      const config = {
        source: './src',
        destination: './dest',
        transforms: {
          'svc/*.yaml': { content: [{ find: 'uat-', replace: 'prod-' }] }
        }
      };

      const result = computeFileDiff(source, destination, config);

      expect(result.unchangedFiles).toContain('svc/values.yaml');
      expect(result.unchangedFiles).toContain('apps/config.yaml');
    });
  });

  describe('skipPath with filter expressions', () => {
    it('should skip array item by filter in skipPath', () => {
      const source = new Map([['file.yaml', 'env:\n  - name: DEBUG\n    value: "1"\n  - name: PROD\n    value: "0"']]);
      const destination = new Map([
        ['file.yaml', 'env:\n  - name: DEBUG\n    value: "changed"\n  - name: PROD\n    value: "0"']
      ]);
      const config = {
        source: './src',
        destination: './dest',
        skipPath: { '*.yaml': ['env[name=DEBUG]'] }
      };

      const result = computeFileDiff(source, destination, config);

      expect(result.unchangedFiles).toContain('file.yaml');
    });

    it('should detect changes in non-filtered array items', () => {
      const source = new Map([['file.yaml', 'env:\n  - name: DEBUG\n    value: "1"\n  - name: PROD\n    value: "0"']]);
      const destination = new Map([
        ['file.yaml', 'env:\n  - name: DEBUG\n    value: "1"\n  - name: PROD\n    value: "changed"']
      ]);
      const config = {
        source: './src',
        destination: './dest',
        skipPath: { '*.yaml': ['env[name=DEBUG]'] }
      };

      const result = computeFileDiff(source, destination, config);

      expect(result.changedFiles).toHaveLength(1);
    });

    it('should handle nested filter paths', () => {
      const yaml = `containers:
  - name: app
    env:
      - name: SECRET
        value: xxx
      - name: DEBUG
        value: "1"
  - name: sidecar
    env:
      - name: LOG_LEVEL
        value: info`;
      const changedYaml = yaml.replace('xxx', 'yyy');
      const source = new Map([['file.yaml', yaml]]);
      const destination = new Map([['file.yaml', changedYaml]]);
      const config = {
        source: './src',
        destination: './dest',
        skipPath: { '*.yaml': ['containers[name=app].env[name=SECRET]'] }
      };

      const result = computeFileDiff(source, destination, config);

      expect(result.unchangedFiles).toContain('file.yaml');
    });

    it('should skip nested value within filtered array item', () => {
      const source = new Map([['file.yaml', 'env:\n  - name: A\n    value: "1"\n  - name: B\n    value: "2"']]);
      const destination = new Map([
        ['file.yaml', 'env:\n  - name: A\n    value: "changed"\n  - name: B\n    value: "2"']
      ]);
      const config = {
        source: './src',
        destination: './dest',
        skipPath: { '*.yaml': ['env[name=A].value'] }
      };

      const result = computeFileDiff(source, destination, config);

      expect(result.unchangedFiles).toContain('file.yaml');
    });

    it('should handle filter with no matching items gracefully', () => {
      const source = new Map([['file.yaml', 'env:\n  - name: A\n    value: "1"']]);
      const destination = new Map([['file.yaml', 'env:\n  - name: A\n    value: "1"']]);
      const config = {
        source: './src',
        destination: './dest',
        skipPath: { '*.yaml': ['env[name=NONEXISTENT]'] }
      };

      const result = computeFileDiff(source, destination, config);

      expect(result.unchangedFiles).toContain('file.yaml');
    });

    it('should work with mixed filter and wildcard paths', () => {
      const source = new Map([
        ['file.yaml', 'containers:\n  - name: app\n    env:\n      - name: VAR\n        value: "1"']
      ]);
      const destination = new Map([
        ['file.yaml', 'containers:\n  - name: app\n    env:\n      - name: VAR\n        value: "changed"']
      ]);
      const config = {
        source: './src',
        destination: './dest',
        skipPath: { '*.yaml': ['containers[name=app].env[*].value'] }
      };

      const result = computeFileDiff(source, destination, config);

      expect(result.unchangedFiles).toContain('file.yaml');
    });

    it('should convert numeric property values for comparison', () => {
      const source = new Map([['file.yaml', 'items:\n  - id: 123\n    data: old']]);
      const destination = new Map([['file.yaml', 'items:\n  - id: 123\n    data: new']]);
      const config = {
        source: './src',
        destination: './dest',
        skipPath: { '*.yaml': ['items[id=123]'] }
      };

      const result = computeFileDiff(source, destination, config);

      expect(result.unchangedFiles).toContain('file.yaml');
    });
  });

  describe('skipPath with CSS-style filter operators', () => {
    describe('startsWith operator (^=)', () => {
      it('should skip array items matching startsWith filter', () => {
        const source = new Map([
          [
            'file.yaml',
            `env:
  - name: DB_HOST
    value: localhost
  - name: DB_PORT
    value: "5432"
  - name: API_KEY
    value: secret`
          ]
        ]);
        const destination = new Map([
          [
            'file.yaml',
            `env:
  - name: DB_HOST
    value: changed
  - name: DB_PORT
    value: "9999"
  - name: API_KEY
    value: secret`
          ]
        ]);
        const config = {
          source: './src',
          destination: './dest',
          skipPath: { '*.yaml': ['env[name^=DB_]'] }
        };

        const result = computeFileDiff(source, destination, config);

        expect(result.unchangedFiles).toContain('file.yaml');
      });

      it('should detect changes in items not matching startsWith', () => {
        const source = new Map([
          [
            'file.yaml',
            `env:
  - name: DB_HOST
    value: localhost
  - name: API_KEY
    value: old-secret`
          ]
        ]);
        const destination = new Map([
          [
            'file.yaml',
            `env:
  - name: DB_HOST
    value: localhost
  - name: API_KEY
    value: new-secret`
          ]
        ]);
        const config = {
          source: './src',
          destination: './dest',
          skipPath: { '*.yaml': ['env[name^=DB_]'] }
        };

        const result = computeFileDiff(source, destination, config);

        expect(result.changedFiles).toHaveLength(1);
      });

      it('should handle nested paths with startsWith filter', () => {
        const source = new Map([
          [
            'file.yaml',
            `containers:
  - name: init-db
    resources:
      memory: 128Mi
  - name: init-cache
    resources:
      memory: 64Mi
  - name: app
    resources:
      memory: 512Mi`
          ]
        ]);
        const destination = new Map([
          [
            'file.yaml',
            `containers:
  - name: init-db
    resources:
      memory: changed
  - name: init-cache
    resources:
      memory: changed
  - name: app
    resources:
      memory: 512Mi`
          ]
        ]);
        const config = {
          source: './src',
          destination: './dest',
          skipPath: { '*.yaml': ['containers[name^=init-].resources'] }
        };

        const result = computeFileDiff(source, destination, config);

        expect(result.unchangedFiles).toContain('file.yaml');
      });
    });

    describe('endsWith operator ($=)', () => {
      it('should skip array items matching endsWith filter', () => {
        const source = new Map([
          [
            'file.yaml',
            `env:
  - name: API_KEY
    value: secret1
  - name: SECRET_KEY
    value: secret2
  - name: DEBUG
    value: "1"`
          ]
        ]);
        const destination = new Map([
          [
            'file.yaml',
            `env:
  - name: API_KEY
    value: changed1
  - name: SECRET_KEY
    value: changed2
  - name: DEBUG
    value: "1"`
          ]
        ]);
        const config = {
          source: './src',
          destination: './dest',
          skipPath: { '*.yaml': ['env[name$=_KEY]'] }
        };

        const result = computeFileDiff(source, destination, config);

        expect(result.unchangedFiles).toContain('file.yaml');
      });

      it('should detect changes in items not matching endsWith', () => {
        const source = new Map([
          [
            'file.yaml',
            `env:
  - name: API_KEY
    value: secret
  - name: DEBUG
    value: "1"`
          ]
        ]);
        const destination = new Map([
          [
            'file.yaml',
            `env:
  - name: API_KEY
    value: secret
  - name: DEBUG
    value: "0"`
          ]
        ]);
        const config = {
          source: './src',
          destination: './dest',
          skipPath: { '*.yaml': ['env[name$=_KEY]'] }
        };

        const result = computeFileDiff(source, destination, config);

        expect(result.changedFiles).toHaveLength(1);
      });

      it('should handle nested value within endsWith filtered item', () => {
        const source = new Map([
          [
            'file.yaml',
            `volumes:
  - name: app-data
    mountPath: /data
    size: 10Gi
  - name: cache-data
    mountPath: /cache
    size: 5Gi
  - name: logs
    mountPath: /logs`
          ]
        ]);
        const destination = new Map([
          [
            'file.yaml',
            `volumes:
  - name: app-data
    mountPath: /data
    size: 100Gi
  - name: cache-data
    mountPath: /cache
    size: 50Gi
  - name: logs
    mountPath: /logs`
          ]
        ]);
        const config = {
          source: './src',
          destination: './dest',
          skipPath: { '*.yaml': ['volumes[name$=-data].size'] }
        };

        const result = computeFileDiff(source, destination, config);

        expect(result.unchangedFiles).toContain('file.yaml');
      });
    });

    describe('contains operator (*=)', () => {
      it('should skip array items matching contains filter', () => {
        const source = new Map([
          [
            'file.yaml',
            `env:
  - name: DB_PASSWORD
    value: secret1
  - name: PASSWORD_HASH
    value: secret2
  - name: MY_PASSWORD_SALT
    value: secret3
  - name: DEBUG
    value: "1"`
          ]
        ]);
        const destination = new Map([
          [
            'file.yaml',
            `env:
  - name: DB_PASSWORD
    value: changed1
  - name: PASSWORD_HASH
    value: changed2
  - name: MY_PASSWORD_SALT
    value: changed3
  - name: DEBUG
    value: "1"`
          ]
        ]);
        const config = {
          source: './src',
          destination: './dest',
          skipPath: { '*.yaml': ['env[name*=PASSWORD]'] }
        };

        const result = computeFileDiff(source, destination, config);

        expect(result.unchangedFiles).toContain('file.yaml');
      });

      it('should detect changes in items not matching contains', () => {
        const source = new Map([
          [
            'file.yaml',
            `env:
  - name: DB_PASSWORD
    value: secret
  - name: API_URL
    value: http://old.com`
          ]
        ]);
        const destination = new Map([
          [
            'file.yaml',
            `env:
  - name: DB_PASSWORD
    value: secret
  - name: API_URL
    value: http://new.com`
          ]
        ]);
        const config = {
          source: './src',
          destination: './dest',
          skipPath: { '*.yaml': ['env[name*=PASSWORD]'] }
        };

        const result = computeFileDiff(source, destination, config);

        expect(result.changedFiles).toHaveLength(1);
      });

      it('should handle images with contains filter', () => {
        const source = new Map([
          [
            'file.yaml',
            `containers:
  - name: app
    image: my-nginx:v1
    ports:
      - containerPort: 80
  - name: sidecar
    image: envoy:latest`
          ]
        ]);
        const destination = new Map([
          [
            'file.yaml',
            `containers:
  - name: app
    image: my-nginx:v2
    ports:
      - containerPort: 80
  - name: sidecar
    image: envoy:latest`
          ]
        ]);
        const config = {
          source: './src',
          destination: './dest',
          skipPath: { '*.yaml': ['containers[image*=nginx].image'] }
        };

        const result = computeFileDiff(source, destination, config);

        expect(result.unchangedFiles).toContain('file.yaml');
      });
    });

    describe('mixed operators', () => {
      it('should handle multiple skipPath rules with different operators', () => {
        const source = new Map([
          [
            'file.yaml',
            `env:
  - name: DB_HOST
    value: old-host
  - name: API_KEY
    value: old-key
  - name: MY_SECRET_TOKEN
    value: old-token
  - name: DEBUG
    value: "1"`
          ]
        ]);
        const destination = new Map([
          [
            'file.yaml',
            `env:
  - name: DB_HOST
    value: new-host
  - name: API_KEY
    value: new-key
  - name: MY_SECRET_TOKEN
    value: new-token
  - name: DEBUG
    value: "1"`
          ]
        ]);
        const config = {
          source: './src',
          destination: './dest',
          skipPath: {
            '*.yaml': [
              'env[name^=DB_]', // startsWith
              'env[name$=_KEY]', // endsWith
              'env[name*=SECRET]' // contains
            ]
          }
        };

        const result = computeFileDiff(source, destination, config);

        expect(result.unchangedFiles).toContain('file.yaml');
      });

      it('should handle nested path with mixed operator filters', () => {
        const source = new Map([
          [
            'file.yaml',
            `containers:
  - name: sidecar-metrics
    env:
      - name: API_KEY
        value: old-key
      - name: DEBUG
        value: "1"`
          ]
        ]);
        const destination = new Map([
          [
            'file.yaml',
            `containers:
  - name: sidecar-metrics
    env:
      - name: API_KEY
        value: new-key
      - name: DEBUG
        value: "1"`
          ]
        ]);
        const config = {
          source: './src',
          destination: './dest',
          skipPath: { '*.yaml': ['containers[name^=sidecar-].env[name$=_KEY]'] }
        };

        const result = computeFileDiff(source, destination, config);

        expect(result.unchangedFiles).toContain('file.yaml');
      });

      it('should correctly mix equals and CSS operators', () => {
        const source = new Map([
          [
            'file.yaml',
            `spec:
  template:
    spec:
      containers:
        - name: app
          env:
            - name: DB_HOST
              value: old
            - name: API_URL
              value: http://api.com`
          ]
        ]);
        const destination = new Map([
          [
            'file.yaml',
            `spec:
  template:
    spec:
      containers:
        - name: app
          env:
            - name: DB_HOST
              value: new
            - name: API_URL
              value: http://api.com`
          ]
        ]);
        const config = {
          source: './src',
          destination: './dest',
          skipPath: { '*.yaml': ['spec.template.spec.containers[name=app].env[name^=DB_]'] }
        };

        const result = computeFileDiff(source, destination, config);

        expect(result.unchangedFiles).toContain('file.yaml');
      });
    });
  });

  describe('fixedValues integration', () => {
    it('should apply fixedValues during diff computation', () => {
      const source = new Map([['file.yaml', 'version: 1.0.0\nlevel: debug']]);
      const destination = new Map([['file.yaml', 'version: 1.0.0\nlevel: info']]);
      const config = {
        source: './src',
        destination: './dest',
        fixedValues: { '*.yaml': [{ path: 'level', value: 'info' }] }
      };

      const result = computeFileDiff(source, destination, config);

      // Fixed value makes source match destination
      expect(result.unchangedFiles).toContain('file.yaml');
    });

    it('should detect changes when fixedValue differs from destination', () => {
      const source = new Map([['file.yaml', 'version: 1.0.0\nlevel: debug']]);
      const destination = new Map([['file.yaml', 'version: 1.0.0\nlevel: warn']]);
      const config = {
        source: './src',
        destination: './dest',
        fixedValues: { '*.yaml': [{ path: 'level', value: 'info' }] }
      };

      const result = computeFileDiff(source, destination, config);

      // Fixed value (info) differs from destination (warn)
      expect(result.changedFiles).toHaveLength(1);
      expect(result.changedFiles[0]?.path).toBe('file.yaml');
    });

    it('should include fixedValues in processedSourceContent', () => {
      const source = new Map([['file.yaml', 'level: debug']]);
      const destination = new Map([['file.yaml', 'level: warn']]);
      const config = {
        source: './src',
        destination: './dest',
        fixedValues: { '*.yaml': [{ path: 'level', value: 'info' }] }
      };

      const result = computeFileDiff(source, destination, config);

      expect(result.changedFiles).toHaveLength(1);
      // processedSourceContent should have the fixed value
      expect(result.changedFiles[0]?.processedSourceContent).toEqual({ level: 'info' });
    });

    it('should apply fixedValues with filter operators', () => {
      const source = new Map([
        [
          'file.yaml',
          `env:
  - name: LOG_LEVEL
    value: debug
  - name: DEBUG
    value: "1"`
        ]
      ]);
      const destination = new Map([
        [
          'file.yaml',
          `env:
  - name: LOG_LEVEL
    value: info
  - name: DEBUG
    value: "1"`
        ]
      ]);
      const config = {
        source: './src',
        destination: './dest',
        fixedValues: { '*.yaml': [{ path: 'env[name=LOG_LEVEL].value', value: 'info' }] }
      };

      const result = computeFileDiff(source, destination, config);

      // Fixed value makes source match destination
      expect(result.unchangedFiles).toContain('file.yaml');
    });

    it('should apply fixedValues with startsWith filter to ALL matching items', () => {
      const source = new Map([
        [
          'file.yaml',
          `env:
  - name: LOG_LEVEL_APP
    value: debug
  - name: LOG_LEVEL_DB
    value: debug
  - name: LOG_LEVEL_API
    value: debug
  - name: DEBUG
    value: "1"`
        ]
      ]);
      const destination = new Map([
        [
          'file.yaml',
          `env:
  - name: LOG_LEVEL_APP
    value: info
  - name: LOG_LEVEL_DB
    value: info
  - name: LOG_LEVEL_API
    value: info
  - name: DEBUG
    value: "1"`
        ]
      ]);
      const config = {
        source: './src',
        destination: './dest',
        fixedValues: { '*.yaml': [{ path: 'env[name^=LOG_LEVEL_].value', value: 'info' }] }
      };

      const result = computeFileDiff(source, destination, config);

      // Fixed value applied to ALL matching items makes source match destination
      expect(result.unchangedFiles).toContain('file.yaml');
    });

    it('should apply fixedValues after transforms', () => {
      const source = new Map([['file.yaml', 'url: uat-db.internal\nlevel: debug']]);
      const destination = new Map([['file.yaml', 'url: prod-db.internal\nlevel: info']]);
      const config = {
        source: './src',
        destination: './dest',
        transforms: { '*.yaml': { content: [{ find: 'uat-', replace: 'prod-' }] } },
        fixedValues: { '*.yaml': [{ path: 'level', value: 'info' }] }
      };

      const result = computeFileDiff(source, destination, config);

      // Transform converts url, fixedValue sets level
      expect(result.unchangedFiles).toContain('file.yaml');
    });

    it('should apply fixedValues before skipPath filtering', () => {
      const source = new Map([['file.yaml', 'level: debug\nversion: 1.0.0']]);
      const destination = new Map([['file.yaml', 'level: info\nversion: 2.0.0']]);
      const config = {
        source: './src',
        destination: './dest',
        fixedValues: { '*.yaml': [{ path: 'level', value: 'info' }] },
        skipPath: { '*.yaml': ['version'] }
      };

      const result = computeFileDiff(source, destination, config);

      // Fixed value makes level match, skipPath ignores version difference
      expect(result.unchangedFiles).toContain('file.yaml');
    });

    it('should only apply fixedValues to matching file patterns', () => {
      const source = new Map([
        ['prod/values.yaml', 'level: debug'],
        ['dev/values.yaml', 'level: debug']
      ]);
      const destination = new Map([
        ['prod/values.yaml', 'level: info'],
        ['dev/values.yaml', 'level: debug']
      ]);
      const config = {
        source: './src',
        destination: './dest',
        fixedValues: { 'prod/*.yaml': [{ path: 'level', value: 'info' }] }
      };

      const result = computeFileDiff(source, destination, config);

      // Fixed value applied to prod, not to dev
      expect(result.unchangedFiles).toContain('prod/values.yaml');
      expect(result.unchangedFiles).toContain('dev/values.yaml');
    });
  });
});
