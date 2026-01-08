import YAML from 'yaml';

import type { FinalConfig, StopRule } from './configFile';
import type { FileMap } from './fileLoader';
import { getValueAtPath, parseJsonPath } from './utils/jsonPath';
import { globalMatcher } from './utils/patternMatcher';

/**
 * Result of pattern usage validation.
 */
export interface PatternUsageResult {
  warnings: PatternUsageWarning[];
  hasWarnings: boolean;
}

/**
 * Individual pattern usage warning.
 */
export interface PatternUsageWarning {
  type: 'unused-exclude' | 'unused-skipPath' | 'unused-stopRule-glob' | 'unused-stopRule-path';
  pattern: string;
  message: string;
  context?: string;
}

/**
 * Validates that patterns in config are actually used.
 * Checks exclude, skipPath, and stopRules patterns against loaded files.
 *
 * @param config - The final validated config
 * @param sourceFiles - Loaded source files (Map<relativePath, content>)
 * @param destinationFiles - Loaded destination files
 * @returns PatternUsageResult with warnings
 */
export const validatePatternUsage = (
  config: FinalConfig,
  sourceFiles: FileMap,
  destinationFiles: FileMap
): PatternUsageResult => {
  const warnings: PatternUsageWarning[] = [
    ...validateExcludePatterns(config, sourceFiles, destinationFiles),
    ...validateSkipPathPatterns(config, sourceFiles, destinationFiles),
    ...validateStopRulePatterns(config, sourceFiles, destinationFiles)
  ];

  return {
    warnings,
    hasWarnings: warnings.length > 0
  };
};

/**
 * Validates exclude patterns match at least one file.
 * Tests against ALL files (before filtering) using glob patterns.
 */
const validateExcludePatterns = (
  config: FinalConfig,
  sourceFiles: FileMap,
  destinationFiles: FileMap
): PatternUsageWarning[] => {
  const warnings: PatternUsageWarning[] = [];
  const allFiles = new Set([...sourceFiles.keys(), ...destinationFiles.keys()]);

  for (const excludePattern of config.exclude) {
    const matchesAny = [...allFiles].some((filePath) => globalMatcher.match(filePath, excludePattern));

    if (!matchesAny)
      warnings.push({
        type: 'unused-exclude',
        pattern: excludePattern,
        message: `Exclude pattern '${excludePattern}' matches no files`
      });
  }

  return warnings;
};

/**
 * Validates skipPath patterns match at least one file.
 */
const validateSkipPathPatterns = (
  config: FinalConfig,
  sourceFiles: FileMap,
  destinationFiles: FileMap
): PatternUsageWarning[] => {
  const warnings: PatternUsageWarning[] = [];

  if (!config.skipPath) return warnings;

  const allFiles = new Set([...sourceFiles.keys(), ...destinationFiles.keys()]);

  for (const pattern of Object.keys(config.skipPath)) {
    const matchesAny = [...allFiles].some((filePath) => globalMatcher.match(filePath, pattern));

    if (!matchesAny)
      warnings.push({
        type: 'unused-skipPath',
        pattern,
        message: `skipPath pattern '${pattern}' matches no files`
      });
  }

  return warnings;
};

/**
 * Validates stopRules patterns.
 * Two-level validation:
 * 1. Glob pattern matches at least one file
 * 2. If rule has 'path', verify JSONPath exists in at least one matched file
 */
const validateStopRulePatterns = (
  config: FinalConfig,
  sourceFiles: FileMap,
  destinationFiles: FileMap
): PatternUsageWarning[] => {
  const warnings: PatternUsageWarning[] = [];

  if (!config.stopRules) return warnings;

  const allFiles = new Set([...sourceFiles.keys(), ...destinationFiles.keys()]);

  for (const [globPattern, rules] of Object.entries(config.stopRules)) {
    // Check if glob matches any files
    const matchedFiles = [...allFiles].filter((filePath) => globalMatcher.match(filePath, globPattern));

    if (matchedFiles.length === 0) {
      warnings.push({
        type: 'unused-stopRule-glob',
        pattern: globPattern,
        message: `stopRules glob pattern '${globPattern}' matches no files`,
        context: `${rules.length} rule(s) defined`
      });
      continue; // Skip path validation if glob doesn't match
    }

    // For each rule with a 'path' field, verify JSONPath exists
    for (const rule of rules) {
      // Skip rules without path (they scan globally)
      if (!hasPathField(rule) || !rule.path) continue;

      // Only validate for YAML files
      const yamlFiles = matchedFiles.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

      if (yamlFiles.length === 0) continue;

      // Check if path exists in at least one file
      const pathExistsInAny = validateJsonPathInFiles(rule.path, yamlFiles, sourceFiles, destinationFiles);

      if (!pathExistsInAny)
        warnings.push({
          type: 'unused-stopRule-path',
          pattern: globPattern,
          message: `stopRules JSONPath '${rule.path}' not found in any matched files`,
          context: `Rule type: ${rule.type}, matches ${yamlFiles.length} file(s)`
        });
    }
  }

  return warnings;
};

/**
 * Type guard to check if a StopRule has a path field.
 */
const hasPathField = (rule: StopRule): rule is StopRule & { path?: string } =>
  'path' in rule && typeof rule.path === 'string';

/**
 * Checks if a JSONPath exists in at least one file.
 * Parses YAML and uses getValueAtPath utility.
 */
const validateJsonPathInFiles = (
  jsonPath: string,
  filePaths: string[],
  sourceFiles: FileMap,
  destinationFiles: FileMap
): boolean => {
  const pathParts = parseJsonPath(jsonPath);

  for (const filePath of filePaths) {
    // Check both source and destination
    const content = sourceFiles.get(filePath) || destinationFiles.get(filePath);
    if (!content) continue;

    try {
      const parsed = YAML.parse(content);
      const value = getValueAtPath(parsed, pathParts);

      if (value !== undefined) return true; // Found in at least one file
    } catch {
      // Ignore parse errors (they'll be caught elsewhere)
      continue;
    }
  }

  return false; // Not found in any file
};
