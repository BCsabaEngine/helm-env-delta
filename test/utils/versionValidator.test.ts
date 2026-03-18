import { describe, expect, it } from 'vitest';

import { validateVersionString } from '../../src/utils/versionValidator';

describe('utils/versionValidator', () => {
  describe('v-prefix check', () => {
    it('accepts v-prefixed version when mode is required', () => {
      const result = validateVersionString('v1.2.3', 'required');
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('');
    });

    it('rejects non-prefixed version when mode is required', () => {
      const result = validateVersionString('1.2.3', 'required');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('must start with "v"');
    });

    it('rejects v-prefixed version when mode is forbidden', () => {
      const result = validateVersionString('v1.2.3', 'forbidden');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('must not have "v" prefix');
    });

    it('accepts non-prefixed version when mode is forbidden', () => {
      const result = validateVersionString('1.2.3', 'forbidden');
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('');
    });

    it('accepts v-prefixed version when mode is allowed', () => {
      const result = validateVersionString('v1.2.3', 'allowed');
      expect(result.isValid).toBe(true);
    });

    it('accepts non-prefixed version when mode is allowed', () => {
      const result = validateVersionString('1.2.3', 'allowed');
      expect(result.isValid).toBe(true);
    });

    it('skips v-prefix check when mode is undefined', () => {
      const result = validateVersionString('v1.2.3');
      expect(result.isValid).toBe(true);
    });
  });

  describe('format check', () => {
    it('rejects incomplete version with only 2 parts', () => {
      const result = validateVersionString('1.2');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('incomplete');
      expect(result.message).toContain('2 part');
    });

    it('rejects version with too many parts', () => {
      const result = validateVersionString('1.2.3.4');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('too many parts');
      expect(result.message).toContain('4 parts');
    });
  });

  describe('leading zeros check', () => {
    it('rejects version with leading zeros', () => {
      const result = validateVersionString('1.02.3');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('leading zeros');
    });

    it('accepts version with single-zero parts', () => {
      const result = validateVersionString('0.0.0');
      expect(result.isValid).toBe(true);
    });
  });

  describe('pre-release and build metadata check', () => {
    it('rejects version with pre-release suffix', () => {
      const result = validateVersionString('1.2.3-alpha');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('pre-release');
    });

    it('rejects version with build metadata', () => {
      const result = validateVersionString('1.2.3+build');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('pre-release identifier or build metadata');
    });
  });

  describe('non-numeric parts check', () => {
    it('rejects version with non-numeric part', () => {
      const result = validateVersionString('1.a.3');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('non-numeric');
    });
  });

  describe('happy path', () => {
    it('returns valid with empty message for plain version', () => {
      const result = validateVersionString('1.2.3');
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('');
    });
  });
});
