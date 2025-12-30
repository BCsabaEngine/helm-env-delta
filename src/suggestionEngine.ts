import { Config, StopRule } from './configFile';
import { ChangedFile, FileDiffResult } from './fileDiff';
import { createErrorClass, createErrorTypeGuard } from './utils/errors';

// ============================================================================
// Types
// ============================================================================

export interface ValuePair {
  oldValue: string;
  targetValue: string;
  path: string;
}

export interface TransformSuggestion {
  find: string;
  replace: string;
  confidence: number;
  occurrences: number;
  affectedFiles: string[];
  examples: ValuePair[];
}

export interface StopRuleSuggestion {
  rule: StopRule;
  confidence: number;
  reason: string;
  affectedPaths: string[];
  affectedFiles: string[];
}

export interface SuggestionResult {
  transforms: Map<string, TransformSuggestion[]>;
  stopRules: Map<string, StopRuleSuggestion[]>;
  metadata: {
    filesAnalyzed: number;
    changedFiles: number;
    timestamp: string;
  };
}

interface ValueDifference {
  filePath: string;
  jsonPath: string;
  oldValue: unknown;
  targetValue: unknown;
}

interface PatternOccurrence {
  find: string;
  replace: string;
  files: Set<string>;
  examples: ValuePair[];
}

interface PathValueCollection {
  values: unknown[];
  files: Set<string>;
}

// ============================================================================
// Error Handling
// ============================================================================

const SuggestionEngineErrorClass = createErrorClass('Suggestion Engine Error', {
  ANALYSIS_FAILED: 'Failed to analyze file differences',
  FORMAT_ERROR: 'Failed to format suggestions as YAML'
});

export class SuggestionEngineError extends SuggestionEngineErrorClass {}
export const isSuggestionEngineError = createErrorTypeGuard(SuggestionEngineError);

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Analyzes file differences and suggests transforms and stop rules.
 *
 * @param diffResult - Result from computeFileDiff
 * @param config - Current configuration (to avoid duplicating existing rules)
 * @returns Structured suggestions with confidence scores
 */
export const analyzeDifferencesForSuggestions = (diffResult: FileDiffResult, config: Config): SuggestionResult => {
  if (diffResult.changedFiles.length === 0) return createEmptySuggestionResult(diffResult);

  try {
    const allDifferences = extractAllDifferences(diffResult.changedFiles);
    const transformSuggestions = analyzeTransformPatterns(allDifferences, config);
    const stopRuleSuggestions = analyzeStopRulePatterns(diffResult.changedFiles, config);

    return {
      transforms: new Map([['**/*.yaml', transformSuggestions]]),
      stopRules: new Map([['**/*.yaml', stopRuleSuggestions]]),
      metadata: {
        filesAnalyzed: diffResult.changedFiles.length,
        changedFiles: diffResult.changedFiles.length,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    throw new SuggestionEngineError('Failed to analyze file differences', {
      code: 'ANALYSIS_FAILED',
      cause: error instanceof Error ? error : undefined
    });
  }
};

const createEmptySuggestionResult = (diffResult: FileDiffResult): SuggestionResult => ({
  transforms: new Map(),
  stopRules: new Map(),
  metadata: {
    filesAnalyzed: diffResult.changedFiles.length,
    changedFiles: 0,
    timestamp: new Date().toISOString()
  }
});

// ============================================================================
// Helper Functions - Value Extraction
// ============================================================================

/**
 * Recursively walks both YAML trees and extracts differences.
 */
const extractAllDifferences = (changedFiles: ChangedFile[]): ValueDifference[] => {
  const differences: ValueDifference[] = [];

  for (const file of changedFiles) {
    const fileDiffs = walkAndCompare(file.rawParsedSource, file.rawParsedDest, [], file.path);
    differences.push(...fileDiffs);
  }

  return differences;
};

/**
 * Recursively compares two objects and tracks differences with JSONPath.
 */
const walkAndCompare = (
  source: unknown,
  destination: unknown,
  currentPath: string[],
  filePath: string
): ValueDifference[] => {
  const differences: ValueDifference[] = [];

  if (!isObject(source) || !isObject(destination)) {
    if (source !== destination)
      differences.push({
        filePath,
        jsonPath: currentPath.join('.'),
        oldValue: destination,
        targetValue: source
      });

    return differences;
  }

  const sourceObject = source as Record<string, unknown>;
  const destinationObject = destination as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(sourceObject), ...Object.keys(destinationObject)]);

  for (const key of allKeys) {
    const nextPath = [...currentPath, key];
    const sourceValue = sourceObject[key];
    const destinationValue = destinationObject[key];
    const childDiffs = walkAndCompare(sourceValue, destinationValue, nextPath, filePath);
    differences.push(...childDiffs);
  }

  return differences;
};

const isObject = (value: unknown): boolean => value !== null && typeof value === 'object';

/**
 * Collects all values grouped by JSONPath across files.
 */
const collectValuesByPath = (changedFiles: ChangedFile[]): Map<string, PathValueCollection> => {
  const map = new Map<string, PathValueCollection>();

  for (const file of changedFiles) {
    const values = extractAllPathValues(file.processedSourceContent, []);

    for (const { path, value } of values) {
      if (!map.has(path)) map.set(path, { values: [], files: new Set() });

      const collection = map.get(path)!;
      collection.values.push(value);
      collection.files.add(file.path);
    }
  }

  return map;
};

/**
 * Extracts all leaf values with their JSONPaths.
 */
const extractAllPathValues = (data: unknown, currentPath: string[]): Array<{ path: string; value: unknown }> => {
  const results: Array<{ path: string; value: unknown }> = [];

  if (!isObject(data)) {
    if (currentPath.length > 0)
      results.push({
        path: currentPath.join('.'),
        value: data
      });

    return results;
  }

  if (Array.isArray(data))
    for (const [index, datum] of data.entries()) {
      const childResults = extractAllPathValues(datum, [...currentPath, String(index)]);
      results.push(...childResults);
    }
  else {
    const object = data as Record<string, unknown>;
    for (const [key, value] of Object.entries(object)) {
      const childResults = extractAllPathValues(value, [...currentPath, key]);
      results.push(...childResults);
    }
  }

  return results;
};

// ============================================================================
// Transform Pattern Detection
// ============================================================================

/**
 * Detects transform patterns by comparing raw source/dest values.
 * Uses rawParsedSource and rawParsedDest (before any transforms applied).
 */
const analyzeTransformPatterns = (differences: ValueDifference[], config: Config): TransformSuggestion[] => {
  const patternMap = new Map<string, PatternOccurrence>();

  for (const diff of differences) {
    if (typeof diff.oldValue !== 'string' || typeof diff.targetValue !== 'string') continue;

    if (shouldIgnoreValue(diff.oldValue, diff.targetValue)) continue;

    const patterns = findSubstringPatterns(diff.oldValue, diff.targetValue);

    for (const pattern of patterns) {
      const key = `${pattern.find}→${pattern.replace}`;

      if (!patternMap.has(key))
        patternMap.set(key, {
          find: pattern.find,
          replace: pattern.replace,
          files: new Set([diff.filePath]),
          examples: []
        });

      const occurrence = patternMap.get(key)!;
      occurrence.files.add(diff.filePath);
      occurrence.examples.push({
        oldValue: diff.oldValue,
        targetValue: diff.targetValue,
        path: diff.jsonPath
      });
    }
  }

  const suggestions: TransformSuggestion[] = [];

  for (const occurrence of patternMap.values()) {
    const confidence = calculateTransformConfidence(occurrence);

    if (confidence < 0.3) continue;

    if (isTransformInConfig(occurrence.find, occurrence.replace, config)) continue;

    suggestions.push({
      find: occurrence.find,
      replace: occurrence.replace,
      confidence,
      occurrences: occurrence.examples.length,
      affectedFiles: [...occurrence.files],
      examples: occurrence.examples.slice(0, 3)
    });
  }

  return suggestions.toSorted((a, b) => b.confidence - a.confidence);
};

/**
 * Finds substring replacement patterns between two strings.
 * Returns patterns sorted by specificity (longer patterns first).
 */
const findSubstringPatterns = (oldString: string, targetString: string): Array<{ find: string; replace: string }> => {
  const patterns: Array<{ find: string; replace: string }> = [];

  const semanticPatterns = [
    { old: 'uat', target: 'prod' },
    { old: 'UAT', target: 'PROD' },
    { old: 'staging', target: 'production' },
    { old: 'stg', target: 'prd' },
    { old: 'dev', target: 'prod' },
    { old: 'test', target: 'prod' }
  ];

  for (const semantic of semanticPatterns)
    if (oldString.includes(semantic.old) && targetString.includes(semantic.target))
      patterns.push({ find: semantic.old, replace: semantic.target });

  const diffs = computeStringDiff(oldString, targetString);
  for (const diff of diffs) if (diff.find.length >= 2) patterns.push(diff);

  return patterns;
};

/**
 * Filters out noise patterns that shouldn't be suggested.
 */
const shouldIgnoreValue = (oldValue: string, targetValue: string): boolean => {
  if (oldValue.length > 100 || targetValue.length > 100) return true;

  const uuidPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
  if (uuidPattern.test(oldValue) || uuidPattern.test(targetValue)) return true;

  const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  if (isoPattern.test(oldValue) || isoPattern.test(targetValue)) return true;

  if (Math.abs(oldValue.length - targetValue.length) <= 1) {
    const editDistance = calculateLevenshteinDistance(oldValue, targetValue);
    if (editDistance <= 1) return true;
  }

  return false;
};

/**
 * Calculates confidence score for transform suggestions.
 */
const calculateTransformConfidence = (occurrence: PatternOccurrence): number => {
  const fileCount = occurrence.files.size;
  const occurrenceCount = occurrence.examples.length;

  let confidence = 0;

  if (fileCount === 1) confidence = occurrenceCount >= 3 ? 0.5 : 0.3;
  else if (fileCount <= 3) confidence = 0.6;
  else confidence = 0.85;

  const semanticKeywords = ['uat', 'prod', 'staging', 'production', 'dev', 'test'];
  const isSemantic = semanticKeywords.some(
    (keyword) => occurrence.find.toLowerCase().includes(keyword) || occurrence.replace.toLowerCase().includes(keyword)
  );

  if (isSemantic) confidence = Math.min(0.95, confidence + 0.05);

  return confidence;
};

/**
 * Checks if a transform pattern already exists in config.
 */
const isTransformInConfig = (find: string, replace: string, config: Config): boolean => {
  if (!config.transforms) return false;

  for (const rules of Object.values(config.transforms))
    if (rules.content)
      for (const rule of rules.content) if (rule.find === find && rule.replace === replace) return true;

  return false;
};

// ============================================================================
// Stop Rule Pattern Detection
// ============================================================================

/**
 * Analyzes processed content to suggest stop rules.
 * Uses processedSourceContent (after transforms) to detect patterns.
 */
const analyzeStopRulePatterns = (changedFiles: ChangedFile[], config: Config): StopRuleSuggestion[] => {
  const valuesByPath = collectValuesByPath(changedFiles);

  const suggestions = [
    ...detectSemverStopRules(valuesByPath, config),
    ...detectVersionFormatRules(valuesByPath, config),
    ...detectNumericStopRules(valuesByPath, config)
  ];

  return suggestions.toSorted((a, b) => b.confidence - a.confidence);
};

/**
 * Detects semver patterns and suggests semverDowngrade/semverMajorUpgrade rules.
 */
const detectSemverStopRules = (
  valuesByPath: Map<string, PathValueCollection>,
  config: Config
): StopRuleSuggestion[] => {
  const suggestions: StopRuleSuggestion[] = [];
  const semverPattern = /^v?\d+\.\d+\.\d+/;

  for (const [jsonPath, collection] of valuesByPath) {
    const hasSemver = collection.values.some((v) => typeof v === 'string' && semverPattern.test(v));

    if (!hasSemver) continue;

    const fileCount = collection.files.size;
    const confidence = fileCount === 1 ? 0.7 : 0.95;

    if (!isStopRuleInConfig('semverDowngrade', jsonPath, config))
      suggestions.push({
        rule: {
          type: 'semverDowngrade',
          path: jsonPath
        },
        confidence,
        reason: `Prevents version downgrades for ${jsonPath}`,
        affectedPaths: [jsonPath],
        affectedFiles: [...collection.files]
      });

    if (!isStopRuleInConfig('semverMajorUpgrade', jsonPath, config))
      suggestions.push({
        rule: {
          type: 'semverMajorUpgrade',
          path: jsonPath
        },
        confidence,
        reason: `Blocks major version bumps for ${jsonPath}`,
        affectedPaths: [jsonPath],
        affectedFiles: [...collection.files]
      });
  }

  return suggestions;
};

/**
 * Detects version format patterns (v-prefix consistency).
 */
const detectVersionFormatRules = (
  valuesByPath: Map<string, PathValueCollection>,
  config: Config
): StopRuleSuggestion[] => {
  const suggestions: StopRuleSuggestion[] = [];
  const semverPattern = /^v?\d+\.\d+\.\d+/;

  for (const [jsonPath, collection] of valuesByPath) {
    const semverValues = collection.values.filter((v) => typeof v === 'string' && semverPattern.test(v)) as string[];

    if (semverValues.length === 0) continue;

    const withV = semverValues.filter((v) => v.startsWith('v')).length;
    const withoutV = semverValues.length - withV;

    let vPrefix: 'required' | 'forbidden' | 'allowed' | undefined;
    let confidence = 0;

    if (withV === semverValues.length) {
      vPrefix = 'required';
      confidence = 0.95;
    } else if (withoutV === semverValues.length) {
      vPrefix = 'forbidden';
      confidence = 0.95;
    } else if (withV > withoutV * 2) {
      vPrefix = 'required';
      confidence = 0.6;
    } else if (withoutV > withV * 2) {
      vPrefix = 'forbidden';
      confidence = 0.6;
    }

    if (vPrefix && confidence >= 0.6) {
      if (isStopRuleInConfig('versionFormat', jsonPath, config)) continue;

      suggestions.push({
        rule: {
          type: 'versionFormat',
          path: jsonPath,
          vPrefix
        },
        confidence,
        reason: `Enforces ${vPrefix} v-prefix for ${jsonPath}`,
        affectedPaths: [jsonPath],
        affectedFiles: [...collection.files]
      });
    }
  }

  return suggestions;
};

/**
 * Detects numeric fields and suggests min/max constraints.
 */
const detectNumericStopRules = (
  valuesByPath: Map<string, PathValueCollection>,
  config: Config
): StopRuleSuggestion[] => {
  const suggestions: StopRuleSuggestion[] = [];

  for (const [jsonPath, collection] of valuesByPath) {
    const numericValues = collection.values
      .filter((v) => typeof v === 'number' || (typeof v === 'string' && !Number.isNaN(Number(v))))
      .map(Number);

    if (numericValues.length === 0) continue;

    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);

    if (min === max) continue;

    const constraintFields = ['replicas', 'replica', 'count', 'port', 'timeout', 'limit'];
    const isConstraintField = constraintFields.some((field) => jsonPath.toLowerCase().includes(field));

    if (!isConstraintField) continue;

    if (isStopRuleInConfig('numeric', jsonPath, config)) continue;

    const fileCount = collection.files.size;
    const confidence = fileCount === 1 ? 0.5 : 0.7;
    const suggestedMin = Math.max(1, Math.floor(min * 0.5));

    suggestions.push({
      rule: {
        type: 'numeric',
        path: jsonPath,
        min: suggestedMin
      },
      confidence,
      reason: `Prevents ${jsonPath} from dropping below safe minimum`,
      affectedPaths: [jsonPath],
      affectedFiles: [...collection.files]
    });
  }

  return suggestions;
};

/**
 * Checks if a stop rule already exists in config.
 */
const isStopRuleInConfig = (type: string, path: string, config: Config): boolean => {
  if (!config.stopRules) return false;

  for (const rules of Object.values(config.stopRules))
    for (const rule of rules) if (rule.type === type && rule.path === path) return true;

  return false;
};

// ============================================================================
// Output Formatting
// ============================================================================

/**
 * Formats suggestions as copy-paste ready YAML configuration.
 */
export const formatSuggestionsAsYaml = (result: SuggestionResult): string => {
  const lines: string[] = [
    '# helm-env-delta Configuration Suggestions',
    `# Generated from analysis of ${result.metadata.changedFiles} changed file(s)`,
    `# Timestamp: ${result.metadata.timestamp}`,
    '#',
    '# Instructions:',
    '#   1. Review suggestions below',
    '#   2. Copy relevant sections to your config.yaml',
    '#   3. Adjust patterns/values as needed',
    '#   4. Test with --dry-run before applying',
    ''
  ];

  const allTransforms = [...result.transforms.values()].flat();
  if (allTransforms.length > 0) {
    lines.push('transforms:');

    for (const [pattern] of result.transforms) {
      const transforms = result.transforms.get(pattern)!;
      if (transforms.length === 0) continue;

      lines.push(`  '${pattern}':`, '    content:');

      for (const transform of transforms) {
        const confidencePct = Math.round(transform.confidence * 100);
        const fileWord = transform.affectedFiles.length === 1 ? 'file' : 'files';
        lines.push(
          `      # Confidence: ${confidencePct}% | Found in ${transform.affectedFiles.length} ${fileWord} | ${transform.occurrences} occurrence(s)`
        );

        if (transform.examples.length > 0) {
          const example = transform.examples[0]!;
          lines.push(`      # Example: "${example.oldValue}" → "${example.targetValue}" at ${example.path}`);
        }

        lines.push(
          `      - find: '${escapeYamlString(transform.find)}'`,
          `        replace: '${escapeYamlString(transform.replace)}'`
        );
      }
    }
    lines.push('');
  } else lines.push('# No transform suggestions found', '');

  const allStopRules = [...result.stopRules.values()].flat();
  if (allStopRules.length > 0) {
    lines.push('stopRules:');

    for (const [pattern] of result.stopRules) {
      const rules = result.stopRules.get(pattern)!;
      if (rules.length === 0) continue;

      lines.push(`  '${pattern}':`);

      for (const suggestion of rules) {
        const confidencePct = Math.round(suggestion.confidence * 100);
        const fileWord = suggestion.affectedFiles.length === 1 ? 'file' : 'files';
        lines.push(
          `    # Confidence: ${confidencePct}% | ${suggestion.reason}`,
          `    # Affects: ${suggestion.affectedFiles.length} ${fileWord}`
        );

        const rule = suggestion.rule;
        lines.push(`    - type: '${rule.type}'`);

        if ('path' in rule && rule.path) lines.push(`      path: '${rule.path}'`);

        if (rule.type === 'versionFormat' && 'vPrefix' in rule) lines.push(`      vPrefix: '${rule.vPrefix}'`);

        if (rule.type === 'numeric') {
          if ('min' in rule && rule.min !== undefined) lines.push(`      min: ${rule.min}`);

          if ('max' in rule && rule.max !== undefined) lines.push(`      max: ${rule.max}`);
        }
      }
    }
  } else lines.push('# No stop rule suggestions found');

  return lines.join('\n');
};

const escapeYamlString = (string_: string): string => string_.replaceAll("'", "''");

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Helper: Simple Levenshtein distance for noise filtering
 */
const calculateLevenshteinDistance = (string1: string, string2: string): number => {
  const matrix: number[][] = [];

  for (let index = 0; index <= string2.length; index++) matrix[index] = [index];

  for (let index = 0; index <= string1.length; index++) matrix[0]![index] = index;

  for (let index = 1; index <= string2.length; index++)
    for (let index_ = 1; index_ <= string1.length; index_++)
      if (string2.charAt(index - 1) === string1.charAt(index_ - 1))
        matrix[index]![index_] = matrix[index - 1]![index_ - 1]!;
      else
        matrix[index]![index_] = Math.min(
          matrix[index - 1]![index_ - 1]! + 1,
          matrix[index]![index_ - 1]! + 1,
          matrix[index - 1]![index_]! + 1
        );

  return matrix[string2.length]![string1.length]!;
};

/**
 * Helper: Compute string diff segments
 */
const computeStringDiff = (oldString: string, targetString: string): Array<{ find: string; replace: string }> => {
  const patterns: Array<{ find: string; replace: string }> = [];

  let prefixLength = 0;
  while (
    prefixLength < Math.min(oldString.length, targetString.length) &&
    oldString[prefixLength] === targetString[prefixLength]
  )
    prefixLength++;

  let suffixLength = 0;
  while (
    suffixLength < Math.min(oldString.length - prefixLength, targetString.length - prefixLength) &&
    oldString[oldString.length - 1 - suffixLength] === targetString[targetString.length - 1 - suffixLength]
  )
    suffixLength++;

  const oldMiddle = oldString.slice(prefixLength, oldString.length - suffixLength);
  const targetMiddle = targetString.slice(prefixLength, targetString.length - suffixLength);

  if (oldMiddle && targetMiddle && oldMiddle !== targetMiddle)
    patterns.push({ find: oldMiddle, replace: targetMiddle });

  return patterns;
};
