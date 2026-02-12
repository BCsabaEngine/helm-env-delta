import { describe, expect, it } from 'vitest';

import { isNewerVersion, parseVersion } from '../src/utils/versionChecker';

describe('versionChecker', () => {
  describe('parseVersion', () => {
    it('should parse standard semver', () => {
      expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it('should parse version with v prefix', () => {
      expect(parseVersion('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it('should parse version 0.0.0', () => {
      expect(parseVersion('0.0.0')).toEqual({ major: 0, minor: 0, patch: 0 });
    });

    it('should return undefined for invalid version', () => {
      expect(parseVersion('not-a-version')).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(parseVersion('')).toBeUndefined();
    });

    it('should parse version with trailing content', () => {
      expect(parseVersion('1.2.3-beta')).toEqual({ major: 1, minor: 2, patch: 3 });
    });
  });

  describe('isNewerVersion', () => {
    it('should return true when latest has higher major', () => {
      expect(isNewerVersion('1.0.0', '2.0.0')).toBe(true);
    });

    it('should return true when latest has higher minor', () => {
      expect(isNewerVersion('1.0.0', '1.1.0')).toBe(true);
    });

    it('should return true when latest has higher patch', () => {
      expect(isNewerVersion('1.0.0', '1.0.1')).toBe(true);
    });

    it('should return false when versions are equal', () => {
      expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
    });

    it('should return false when current is newer', () => {
      expect(isNewerVersion('2.0.0', '1.0.0')).toBe(false);
    });

    it('should return false for invalid current version', () => {
      expect(isNewerVersion('invalid', '1.0.0')).toBe(false);
    });

    it('should return false for invalid latest version', () => {
      expect(isNewerVersion('1.0.0', 'invalid')).toBe(false);
    });

    it('should handle v prefix', () => {
      expect(isNewerVersion('v1.0.0', 'v2.0.0')).toBe(true);
    });
  });
});
