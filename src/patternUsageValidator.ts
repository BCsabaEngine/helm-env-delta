import YAML from 'yaml';

import type { FinalConfig, StopRule } from './configFile';
import type { FileMap } from './fileLoader';
import { isFilterSegment, matchesFilter, parseFilterSegment, parseJsonPath } from './utils/jsonPath';
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
  type:
    | 'unused-exclude'
    | 'unused-skipPath'
    | 'unused-skipPath-jsonpath'
    | 'unused-stopRule-glob'
    | 'unused-stopRule-path';
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
 * Also validates that JSONPaths exist in at least one matched file.
 */
const validateSkipPathPatterns = (
  config: FinalConfig,
  sourceFiles: FileMap,
  destinationFiles: FileMap
): PatternUsageWarning[] => {
  const warnings: PatternUsageWarning[] = [];

  if (!config.skipPath) return warnings;

  const allFiles = new Set([...sourceFiles.keys(), ...destinationFiles.keys()]);

  for (const [pattern, jsonPaths] of Object.entries(config.skipPath)) {
    // Check if glob matches any files
    const matchedFiles = [...allFiles].filter((filePath) => globalMatcher.match(filePath, pattern));

    if (matchedFiles.length === 0) {
      warnings.push({
        type: 'unused-skipPath',
        pattern,
        message: `skipPath pattern '${pattern}' matches no files`
      });
      continue; // Skip JSONPath validation if glob doesn't match
    }

    // Only validate for YAML files
    const yamlFiles = matchedFiles.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

    if (yamlFiles.length === 0) continue;

    // For each JSONPath, verify it exists in at least one matched file
    for (const jsonPath of jsonPaths) {
      const pathExistsInAny = validateJsonPathInFiles(jsonPath, yamlFiles, sourceFiles, destinationFiles);

      if (!pathExistsInAny)
        warnings.push({
          type: 'unused-skipPath-jsonpath',
          pattern,
          message: `skipPath JSONPath '${jsonPath}' not found in any matched files`,
          context: `Pattern: ${pattern}, matches ${yamlFiles.length} file(s)`
        });
    }
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
 * Checks if a JSONPath could potentially match in an object.
 * For filter segments, checks if the array contains items with the specified property.
 * Supports filter operators: eq (=), startsWith (^=), endsWith ($=), contains (*=)
 */
const pathCouldMatch = (object: unknown, pathParts: string[]): boolean => {
  let current = object;

  for (const part of pathParts) {
    if (!current || typeof current !== 'object') return false;

    if (isFilterSegment(part)) {
      if (!Array.isArray(current)) return false;

      const filter = parseFilterSegment(part);
      if (!filter) return false;

      // Check if any array item has the property with matching value (operator-aware)
      const matched = current.find((item) => {
        if (!item || typeof item !== 'object') return false;
        const itemValue = (item as Record<string, unknown>)[filter.property];
        return matchesFilter(itemValue, filter);
      });

      if (!matched) return false;
      current = matched;
      continue;
    }

    if (Array.isArray(current)) {
      if (part === '*') {
        // For wildcard, check if any item could continue the path
        if (pathParts.indexOf(part) === pathParts.length - 1) return true;
        return current.some((item) => item !== undefined);
      }

      const index = Number(part);
      if (Number.isNaN(index)) return false;

      current = current[index];
    } else current = (current as Record<string, unknown>)[part];
  }

  return current !== undefined;
};

/**
 * Checks if a JSONPath exists in at least one file.
 * Parses YAML and validates path could match.
 * Supports filter segments like 'env[name=DEBUG]'.
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
      if (pathCouldMatch(parsed, pathParts)) return true;
    } catch {
      // Ignore parse errors (they'll be caught elsewhere)
      continue;
    }
  }

  return false; // Not found in any file
};
