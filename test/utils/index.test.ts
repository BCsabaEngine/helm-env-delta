import { describe, expect, it } from 'vitest';

import * as utilitiesIndex from '../../src/utils/index';

describe('utils/index - barrel exports', () => {
  it('should export createErrorClass', () => {
    expect(utilitiesIndex.createErrorClass).toBeDefined();
    expect(typeof utilitiesIndex.createErrorClass).toBe('function');
  });

  it('should export createErrorTypeGuard', () => {
    expect(utilitiesIndex.createErrorTypeGuard).toBeDefined();
    expect(typeof utilitiesIndex.createErrorTypeGuard).toBe('function');
  });

  it('should export isYamlFile', () => {
    expect(utilitiesIndex.isYamlFile).toBeDefined();
    expect(typeof utilitiesIndex.isYamlFile).toBe('function');
  });

  it('should export generateUnifiedDiff', () => {
    expect(utilitiesIndex.generateUnifiedDiff).toBeDefined();
    expect(typeof utilitiesIndex.generateUnifiedDiff).toBe('function');
  });

  it('should export serializeForDiff', () => {
    expect(utilitiesIndex.serializeForDiff).toBeDefined();
    expect(typeof utilitiesIndex.serializeForDiff).toBe('function');
  });

  it('should export normalizeForComparison', () => {
    expect(utilitiesIndex.normalizeForComparison).toBeDefined();
    expect(typeof utilitiesIndex.normalizeForComparison).toBe('function');
  });

  it('should export deepEqual', () => {
    expect(utilitiesIndex.deepEqual).toBeDefined();
    expect(typeof utilitiesIndex.deepEqual).toBe('function');
  });

  it('should export parseJsonPath', () => {
    expect(utilitiesIndex.parseJsonPath).toBeDefined();
    expect(typeof utilitiesIndex.parseJsonPath).toBe('function');
  });

  it('should export getValueAtPath', () => {
    expect(utilitiesIndex.getValueAtPath).toBeDefined();
    expect(typeof utilitiesIndex.getValueAtPath).toBe('function');
  });

  it('should export checkForUpdates', () => {
    expect(utilitiesIndex.checkForUpdates).toBeDefined();
    expect(typeof utilitiesIndex.checkForUpdates).toBe('function');
  });

  it('should export VersionCheckerError', () => {
    expect(utilitiesIndex.VersionCheckerError).toBeDefined();
    expect(typeof utilitiesIndex.VersionCheckerError).toBe('function');
  });

  it('should export isVersionCheckerError', () => {
    expect(utilitiesIndex.isVersionCheckerError).toBeDefined();
    expect(typeof utilitiesIndex.isVersionCheckerError).toBe('function');
  });

  it('should not have undefined exports', () => {
    const exports = Object.values(utilitiesIndex);
    const undefinedExports = exports.filter((exp) => exp === undefined);
    expect(undefinedExports).toHaveLength(0);
  });
});
