import { describe, expect, it } from 'vitest';

import { isYamlFile } from '../../src/utils/fileType';

describe('utils/fileType', () => {
  describe('isYamlFile', () => {
    it('should return true for .yaml extension', () => {
      expect(isYamlFile('config.yaml')).toBe(true);
      expect(isYamlFile('/path/to/file.yaml')).toBe(true);
    });

    it('should return true for .yml extension', () => {
      expect(isYamlFile('config.yml')).toBe(true);
      expect(isYamlFile('/path/to/file.yml')).toBe(true);
    });

    it('should return true for .YAML uppercase', () => {
      expect(isYamlFile('config.YAML')).toBe(true);
      expect(isYamlFile('/path/to/file.YAML')).toBe(true);
    });

    it('should return true for .YML uppercase', () => {
      expect(isYamlFile('config.YML')).toBe(true);
      expect(isYamlFile('/path/to/file.YML')).toBe(true);
    });

    it('should return true for mixed case extensions', () => {
      expect(isYamlFile('config.Yaml')).toBe(true);
      expect(isYamlFile('config.yAML')).toBe(true);
      expect(isYamlFile('config.Yml')).toBe(true);
      expect(isYamlFile('config.yMl')).toBe(true);
    });

    it('should return true for path with directories', () => {
      expect(isYamlFile('path/to/config.yaml')).toBe(true);
      expect(isYamlFile('apps/production/values.yml')).toBe(true);
      expect(isYamlFile('/absolute/path/to/file.yaml')).toBe(true);
    });

    it('should return false for .txt extension', () => {
      expect(isYamlFile('file.txt')).toBe(false);
    });

    it('should return false for .json extension', () => {
      expect(isYamlFile('config.json')).toBe(false);
    });

    it('should return false for no extension', () => {
      expect(isYamlFile('README')).toBe(false);
      expect(isYamlFile('Makefile')).toBe(false);
    });

    it('should return false for .yaml.bak', () => {
      expect(isYamlFile('config.yaml.bak')).toBe(false);
      expect(isYamlFile('file.yml.backup')).toBe(false);
    });

    it('should return false for yaml without dot', () => {
      expect(isYamlFile('yaml')).toBe(false);
      expect(isYamlFile('yml')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isYamlFile('')).toBe(false);
    });
  });
});
