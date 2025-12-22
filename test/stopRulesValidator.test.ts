import { describe, expect, it } from 'vitest';

import { validateStopRules } from '../src/stopRulesValidator';

describe('stopRulesValidator', () => {
  describe('validateStopRules', () => {
    it('should return valid result when no stopRules config', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [],
        unchangedFiles: []
      };

      const result = validateStopRules(diffResult);

      expect(result.isValid).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it('should return valid result when no violations', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'test.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { version: '1.0.0' },
            processedDestContent: { version: '1.0.1' },
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };

      const stopRules = {
        '*.yaml': [{ type: 'semverMajorUpgrade' as const, path: 'version' }]
      };

      const result = validateStopRules(diffResult, stopRules);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should collect violations from changed files', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'test.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { version: '2.0.0' },
            processedDestContent: { version: '1.0.0' },
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };

      const stopRules = {
        '*.yaml': [{ type: 'semverMajorUpgrade' as const, path: 'version' }]
      };

      const result = validateStopRules(diffResult, stopRules);

      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]?.file).toBe('test.yaml');
    });

    it('should handle multiple violations', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'test1.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { version: '2.0.0' },
            processedDestContent: { version: '1.0.0' },
            rawParsedSource: {},
            rawParsedDest: {}
          },
          {
            path: 'test2.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { version: '3.0.0' },
            processedDestContent: { version: '1.0.0' },
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };

      const stopRules = {
        '*.yaml': [{ type: 'semverMajorUpgrade' as const, path: 'version' }]
      };

      const result = validateStopRules(diffResult, stopRules);

      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(2);
    });
  });

  describe('semverMajorUpgrade validation', () => {
    it('should detect major version upgrade (1.0.0 → 2.0.0)', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'test.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { version: '2.0.0' },
            processedDestContent: { version: '1.0.0' },
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };

      const stopRules = {
        '*.yaml': [{ type: 'semverMajorUpgrade' as const, path: 'version' }]
      };

      const result = validateStopRules(diffResult, stopRules);

      expect(result.isValid).toBe(false);
      expect(result.violations[0]?.message).toContain('Major version upgrade');
      expect(result.violations[0]?.message).toContain('1.0.0 → 2.0.0');
    });

    it('should allow same major version (1.0.0 → 1.5.0)', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'test.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { version: '1.5.0' },
            processedDestContent: { version: '1.0.0' },
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };

      const stopRules = {
        '*.yaml': [{ type: 'semverMajorUpgrade' as const, path: 'version' }]
      };

      const result = validateStopRules(diffResult, stopRules);

      expect(result.isValid).toBe(true);
    });

    it('should handle v-prefix versions (v1.0.0 → v2.0.0)', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'test.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { version: 'v2.0.0' },
            processedDestContent: { version: 'v1.0.0' },
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };

      const stopRules = {
        '*.yaml': [{ type: 'semverMajorUpgrade' as const, path: 'version' }]
      };

      const result = validateStopRules(diffResult, stopRules);

      expect(result.isValid).toBe(false);
    });
  });

  describe('semverDowngrade validation', () => {
    it('should detect major version downgrade (2.0.0 → 1.0.0)', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'test.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { version: '1.0.0' },
            processedDestContent: { version: '2.0.0' },
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };

      const stopRules = {
        '*.yaml': [{ type: 'semverDowngrade' as const, path: 'version' }]
      };

      const result = validateStopRules(diffResult, stopRules);

      expect(result.isValid).toBe(false);
      expect(result.violations[0]?.message).toContain('downgrade');
    });

    it('should detect minor version downgrade (1.3.2 → 1.2.4)', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'test.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { version: '1.2.4' },
            processedDestContent: { version: '1.3.2' },
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };

      const stopRules = {
        '*.yaml': [{ type: 'semverDowngrade' as const, path: 'version' }]
      };

      const result = validateStopRules(diffResult, stopRules);

      expect(result.isValid).toBe(false);
      expect(result.violations[0]?.message).toContain('downgrade');
    });

    it('should detect patch version downgrade (1.2.5 → 1.2.3)', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'test.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { version: '1.2.3' },
            processedDestContent: { version: '1.2.5' },
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };

      const stopRules = {
        '*.yaml': [{ type: 'semverDowngrade' as const, path: 'version' }]
      };

      const result = validateStopRules(diffResult, stopRules);

      expect(result.isValid).toBe(false);
      expect(result.violations[0]?.message).toContain('downgrade');
    });

    it('should allow version upgrades', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'test.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { version: '2.1.0' },
            processedDestContent: { version: '2.0.0' },
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };

      const stopRules = {
        '*.yaml': [{ type: 'semverDowngrade' as const, path: 'version' }]
      };

      const result = validateStopRules(diffResult, stopRules);

      expect(result.isValid).toBe(true);
    });

    it('should allow same version', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'test.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { version: '1.2.3' },
            processedDestContent: { version: '1.2.3' },
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };

      const stopRules = {
        '*.yaml': [{ type: 'semverDowngrade' as const, path: 'version' }]
      };

      const result = validateStopRules(diffResult, stopRules);

      expect(result.isValid).toBe(true);
    });
  });

  describe('numeric validation', () => {
    it('should detect value below minimum', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'test.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { replicas: 1 },
            processedDestContent: { replicas: 5 },
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };

      const stopRules = {
        '*.yaml': [{ type: 'numeric' as const, path: 'replicas', min: 2 }]
      };

      const result = validateStopRules(diffResult, stopRules);

      expect(result.isValid).toBe(false);
      expect(result.violations[0]?.message).toContain('below minimum');
    });

    it('should detect value above maximum', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'test.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { replicas: 100 },
            processedDestContent: { replicas: 5 },
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };

      const stopRules = {
        '*.yaml': [{ type: 'numeric' as const, path: 'replicas', max: 50 }]
      };

      const result = validateStopRules(diffResult, stopRules);

      expect(result.isValid).toBe(false);
      expect(result.violations[0]?.message).toContain('exceeds maximum');
    });

    it('should allow value within range', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'test.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { replicas: 5 },
            processedDestContent: { replicas: 3 },
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };

      const stopRules = {
        '*.yaml': [{ type: 'numeric' as const, path: 'replicas', min: 1, max: 10 }]
      };

      const result = validateStopRules(diffResult, stopRules);

      expect(result.isValid).toBe(true);
    });
  });

  describe('regex validation', () => {
    it('should detect value matching forbidden pattern', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'test.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { env: 'production' },
            processedDestContent: { env: 'dev' },
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };

      const stopRules = {
        '*.yaml': [{ type: 'regex' as const, path: 'env', regex: '^production$' }]
      };

      const result = validateStopRules(diffResult, stopRules);

      expect(result.isValid).toBe(false);
      expect(result.violations[0]?.message).toContain('matches forbidden pattern');
    });

    it('should allow value not matching pattern', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'test.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { env: 'staging' },
            processedDestContent: { env: 'dev' },
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };

      const stopRules = {
        '*.yaml': [{ type: 'regex' as const, path: 'env', regex: '^production$' }]
      };

      const result = validateStopRules(diffResult, stopRules);

      expect(result.isValid).toBe(true);
    });
  });

  describe('pattern matching', () => {
    it('should apply rules to matching file patterns', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'apps/prod/values.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { version: '2.0.0' },
            processedDestContent: { version: '1.0.0' },
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };

      const stopRules = {
        'apps/**/*.yaml': [{ type: 'semverMajorUpgrade' as const, path: 'version' }]
      };

      const result = validateStopRules(diffResult, stopRules);

      expect(result.isValid).toBe(false);
    });

    it('should not apply rules to non-matching patterns', () => {
      const diffResult = {
        addedFiles: [],
        deletedFiles: [],
        changedFiles: [
          {
            path: 'config/settings.yaml',
            sourceContent: '',
            destinationContent: '',
            processedSourceContent: { version: '2.0.0' },
            processedDestContent: { version: '1.0.0' },
            rawParsedSource: {},
            rawParsedDest: {}
          }
        ],
        unchangedFiles: []
      };

      const stopRules = {
        'apps/**/*.yaml': [{ type: 'semverMajorUpgrade' as const, path: 'version' }]
      };

      const result = validateStopRules(diffResult, stopRules);

      expect(result.isValid).toBe(true);
    });
  });
});
