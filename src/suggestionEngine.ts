import { Config, StopRule } from './configFile';
import { ChangedFile, FileDiffResult } from './fileDiff';
import { createErrorClass, createErrorTypeGuard } from './utils/errors';
import { parseJsonPath } from './utils/jsonPath';
import {
  ANTONYM_PAIRS,
  ARRAY_KEY_FIELDS,
  CONFIDENCE_DEFAULTS,
  CONSTRAINT_FIELD_NAMES,
  FILTER_THRESHOLDS,
  ISO_TIMESTAMP_PATTERN,
  MAX_EXAMPLES_PER_SUGGESTION,
  NUMERIC_MIN_FLOOR,
  NUMERIC_MIN_MULTIPLIER,
  PROBLEMATIC_REGEX_CHARS,
  SEMANTIC_KEYWORDS,
  SEMANTIC_PATTERNS,
  SEMVER_PATTERN,
  UUID_PATTERN
} from './utils/suggestionConstants';

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
 * @param confidenceThreshold - Minimum confidence score for suggestions (default: 0.3)
 * @returns Structured suggestions with confidence scores
 */
export const analyzeDifferencesForSuggestions = (
  diffResult: FileDiffResult,
  config: Config,
  confidenceThreshold: number = CONFIDENCE_DEFAULTS.DEFAULT_THRESHOLD
): SuggestionResult => {
  if (diffResult.changedFiles.length === 0) return createEmptySuggestionResult(diffResult);

  try {
    const allDifferences = extractAllDifferences(diffResult.changedFiles);
    const transformSuggestions = analyzeTransformPatterns(allDifferences, config, confidenceThreshold);
    const stopRuleSuggestions = analyzeStopRulePatterns(diffResult.changedFiles, config, confidenceThreshold);

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
    const fileDiffs = walkAndCompare(file.rawParsedSource, file.rawParsedDest, [], file.path, file.skipPaths);
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
  filePath: string,
  skipPaths: string[]
): ValueDifference[] => {
  const differences: ValueDifference[] = [];

  if (!isObject(source) || !isObject(destination)) {
    if (source !== destination) {
      const jsonPath = currentPath.join('.');

      // Filter out skipped paths
      if (!isPathSkipped(jsonPath, skipPaths))
        differences.push({
          filePath,
          jsonPath,
          oldValue: destination,
          targetValue: source
        });
    }

    return differences;
  }

  // Special handling for arrays with key fields
  if (Array.isArray(source) && Array.isArray(destination)) {
    const keyField = detectArrayKeyField(source) || detectArrayKeyField(destination);

    if (keyField) {
      // Key-based comparison
      const sourceMap = buildKeyMap(source, keyField);
      const destinationMap = buildKeyMap(destination, keyField);

      // Compare items that exist in both
      for (const [key, sourceItem] of sourceMap)
        if (destinationMap.has(key)) {
          const destinationItem = destinationMap.get(key);
          const nextPath = [...currentPath, '*'];
          const childDiffs = walkAndCompare(sourceItem, destinationItem, nextPath, filePath, skipPaths);
          differences.push(...childDiffs);
        }
      // Note: Items only in source (added) are ignored for suggestions

      // Note: Items only in dest (removed) are ignored for suggestions

      return differences;
    }
  }

  // Fallback: Index-based comparison for arrays without key fields
  const sourceObject = source as Record<string, unknown>;
  const destinationObject = destination as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(sourceObject), ...Object.keys(destinationObject)]);

  // Check if both are arrays to use wildcard for indices
  const bothArrays = Array.isArray(source) && Array.isArray(destination);

  for (const key of allKeys) {
    // Use wildcard for numeric array indices
    const pathKey = bothArrays && /^\d+$/.test(key) ? '*' : key;
    const nextPath = [...currentPath, pathKey];
    const sourceValue = sourceObject[key];
    const destinationValue = destinationObject[key];
    const childDiffs = walkAndCompare(sourceValue, destinationValue, nextPath, filePath, skipPaths);
    differences.push(...childDiffs);
  }

  return differences;
};

const isObject = (value: unknown): boolean => value !== null && typeof value === 'object';

/**
 * Checks if a suggested path matches a skipPath pattern.
 * Supports wildcards in skipPath (e.g., "env[*].value" matches "env.*.value").
 */
const matchesSkipPath = (suggestedPath: string, skipPathPattern: string): boolean => {
  const suggestedParts = parseJsonPath(suggestedPath);
  const skipParts = parseJsonPath(skipPathPattern);

  if (suggestedParts.length !== skipParts.length) return false;

  for (const [index, suggestedPart] of suggestedParts.entries()) {
    if (skipParts[index] === '*') continue;
    if (suggestedPart !== skipParts[index]) return false;
  }

  return true;
};

/**
 * Checks if a path should be filtered out based on skipPaths.
 */
const isPathSkipped = (path: string, skipPaths: string[]): boolean => {
  for (const skipPath of skipPaths) if (matchesSkipPath(path, skipPath)) return true;

  return false;
};

/**
 * Detects the key field in an array of objects.
 * Returns the field name if found, otherwise undefined.
 */
const detectArrayKeyField = (array: unknown[]): string | undefined => {
  if (array.length === 0) return undefined;
  if (!isObject(array[0])) return undefined;

  const firstItem = array[0] as Record<string, unknown>;
  const candidateFields = ARRAY_KEY_FIELDS;

  for (const field of candidateFields) {
    if (!(field in firstItem)) continue;

    // Check if all items have this field
    const allHaveField = array.every((item) => isObject(item) && field in (item as Record<string, unknown>));
    if (!allHaveField) continue;

    // Check if values are unique
    const values = array.map((item) => (item as Record<string, unknown>)[field]);
    const uniqueValues = new Set(values);
    if (uniqueValues.size === values.length) return field;
  }

  return undefined;
};

/**
 * Builds a map of array items by their key field value.
 */
const buildKeyMap = (array: unknown[], keyField: string): Map<unknown, unknown> => {
  const map = new Map();
  for (const item of array)
    if (isObject(item)) {
      const key = (item as Record<string, unknown>)[keyField];
      map.set(key, item);
    }

  return map;
};

/**
 * Collects all values grouped by JSONPath across files.
 */
const collectValuesByPath = (changedFiles: ChangedFile[]): Map<string, PathValueCollection> => {
  const map = new Map<string, PathValueCollection>();

  for (const file of changedFiles) {
    const valuesMap = extractAllPathValues(file.processedSourceContent, []);

    for (const [path, values] of valuesMap) {
      // Skip paths that match skipPath patterns
      if (isPathSkipped(path, file.skipPaths)) continue;

      if (!map.has(path)) map.set(path, { values: [], files: new Set() });

      const collection = map.get(path)!;
      collection.values.push(...values);
      collection.files.add(file.path);
    }
  }

  return map;
};

/**
 * Extracts all leaf values with their JSONPaths.
 * Uses wildcards (*) for array indices to generate generic patterns.
 */
const extractAllPathValues = (data: unknown, currentPath: string[]): Map<string, unknown[]> => {
  const results = new Map<string, unknown[]>();

  if (!isObject(data)) {
    if (currentPath.length > 0) {
      const pathKey = currentPath.join('.');
      if (!results.has(pathKey)) results.set(pathKey, []);
      results.get(pathKey)!.push(data);
    }
    return results;
  }

  if (Array.isArray(data))
    for (const datum of data) {
      // Use '*' instead of numeric index for generic patterns
      const childResults = extractAllPathValues(datum, [...currentPath, '*']);

      // Merge results
      for (const [path, values] of childResults) {
        if (!results.has(path)) results.set(path, []);
        results.get(path)!.push(...values);
      }
    }
  else {
    const object = data as Record<string, unknown>;
    for (const [key, value] of Object.entries(object)) {
      const childResults = extractAllPathValues(value, [...currentPath, key]);

      // Merge results
      for (const [path, values] of childResults) {
        if (!results.has(path)) results.set(path, []);
        results.get(path)!.push(...values);
      }
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
 * @param confidenceThreshold - Minimum confidence score to include suggestion
 */
const analyzeTransformPatterns = (
  differences: ValueDifference[],
  config: Config,
  confidenceThreshold: number
): TransformSuggestion[] => {
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
    // Skip patterns that occur only once
    if (occurrence.examples.length < FILTER_THRESHOLDS.MIN_OCCURRENCES) continue;

    // Skip numeric-only replacements (e.g., "100" → "30")
    const isNumericOnly = /^\d+$/.test(occurrence.find) && /^\d+$/.test(occurrence.replace);
    if (isNumericOnly) continue;

    // Skip boolean-only replacements (e.g., "true" → "false")
    const isBooleanOnly =
      (occurrence.find === 'true' || occurrence.find === 'false') &&
      (occurrence.replace === 'true' || occurrence.replace === 'false');
    if (isBooleanOnly) continue;

    // Skip version-like values (e.g., "v1.2.3" → "v1.3.0", "1.33.2-patch-250805")
    const versionPattern = /^v?\d+\.\d+/;
    const isVersionLike = versionPattern.test(occurrence.find) && versionPattern.test(occurrence.replace);
    if (isVersionLike) continue;

    const confidence = calculateTransformConfidence(occurrence);

    if (confidence < confidenceThreshold) continue;

    if (isTransformInConfig(occurrence.find, occurrence.replace, config)) continue;

    suggestions.push({
      find: occurrence.find,
      replace: occurrence.replace,
      confidence,
      occurrences: occurrence.examples.length,
      affectedFiles: [...occurrence.files],
      examples: occurrence.examples.slice(0, MAX_EXAMPLES_PER_SUGGESTION)
    });
  }

  return suggestions.toSorted((a, b) => b.confidence - a.confidence);
};

/**
 * Finds substring replacement patterns between two strings.
 * Returns patterns sorted by specificity (longer patterns first).
 * Only accepts semantic patterns or full value replacements to avoid suggesting partial replacements.
 */
const findSubstringPatterns = (oldString: string, targetString: string): Array<{ find: string; replace: string }> => {
  const patterns: Array<{ find: string; replace: string }> = [];
  const seen = new Set<string>();

  // Always accept semantic patterns (uat→prod, staging→production, etc.)
  for (const semantic of SEMANTIC_PATTERNS)
    if (oldString.includes(semantic.old) && targetString.includes(semantic.target)) {
      const key = `${semantic.old}→${semantic.target}`;
      if (!seen.has(key)) {
        patterns.push({ find: semantic.old, replace: semantic.target });
        seen.add(key);
      }
    }

  // Only accept WHOLE VALUE replacements (not fragments after prefix/suffix stripping)
  // This prevents suggesting "od-bms-aurora..." fragments from hostnames
  const hasSemanticMatch = patterns.length > 0;
  if (!hasSemanticMatch && oldString !== targetString) {
    // Only suggest if this is the entire value (whole words), not a fragment
    const key = `${oldString}→${targetString}`;
    if (!seen.has(key)) {
      patterns.push({ find: oldString, replace: targetString });
      seen.add(key);
    }
  }

  return patterns;
};

/**
 * Checks if two values are antonyms (intentional opposites).
 */
const isAntonymPair = (oldValue: string, targetValue: string): boolean => {
  const oldLower = oldValue.toLowerCase();
  const targetLower = targetValue.toLowerCase();

  for (const [term1, term2] of ANTONYM_PAIRS)
    if ((oldLower === term1 && targetLower === term2) || (oldLower === term2 && targetLower === term1)) return true;

  return false;
};

/**
 * Checks if a value contains regex special characters that would cause issues.
 */
const hasProblematicRegexChars = (value: string): boolean => {
  return PROBLEMATIC_REGEX_CHARS.test(value);
};

/**
 * Checks if two values differ only in numeric portions.
 * Example: "service-v1" vs "service-v2" - likely version, not pattern
 */
const differsOnlyInNumbers = (oldValue: string, targetValue: string): boolean => {
  // Strip all digits and compare
  const oldStripped = oldValue.replaceAll(/\d+/g, '');
  const targetStripped = targetValue.replaceAll(/\d+/g, '');

  // If non-numeric parts are identical, it's just a number change
  return oldStripped === targetStripped && oldStripped.length > 0;
};

/**
 * Filters out noise patterns that shouldn't be suggested.
 */
const shouldIgnoreValue = (oldValue: string, targetValue: string): boolean => {
  if (oldValue.length > FILTER_THRESHOLDS.MAX_STRING_LENGTH || targetValue.length > FILTER_THRESHOLDS.MAX_STRING_LENGTH)
    return true;

  if (UUID_PATTERN.test(oldValue) || UUID_PATTERN.test(targetValue)) return true;

  if (ISO_TIMESTAMP_PATTERN.test(oldValue) || ISO_TIMESTAMP_PATTERN.test(targetValue)) return true;

  if (Math.abs(oldValue.length - targetValue.length) <= FILTER_THRESHOLDS.MAX_EDIT_DISTANCE) {
    const editDistance = calculateLevenshteinDistance(oldValue, targetValue);
    if (editDistance <= FILTER_THRESHOLDS.MAX_EDIT_DISTANCE) return true;
  }

  // NEW: Filter antonym pairs
  if (isAntonymPair(oldValue, targetValue)) return true;

  // NEW: Filter values with problematic regex characters
  // (unless they match semantic patterns, handled elsewhere)
  if (hasProblematicRegexChars(oldValue) || hasProblematicRegexChars(targetValue)) {
    // Allow if contains semantic keywords
    const hasSemanticKeyword = SEMANTIC_KEYWORDS.some(
      (kw) => oldValue.toLowerCase().includes(kw) || targetValue.toLowerCase().includes(kw)
    );
    if (!hasSemanticKeyword) return true;
  }

  // NEW: Filter compound values differing only in numbers
  if (differsOnlyInNumbers(oldValue, targetValue)) return true;

  return false;
};

/**
 * Calculates confidence score for transform suggestions.
 */
const calculateTransformConfidence = (occurrence: PatternOccurrence): number => {
  const fileCount = occurrence.files.size;
  const occurrenceCount = occurrence.examples.length;

  let confidence = 0;

  if (fileCount === 1)
    confidence =
      occurrenceCount >= FILTER_THRESHOLDS.MIN_SINGLE_FILE_OCCURRENCES
        ? CONFIDENCE_DEFAULTS.SINGLE_FILE_HIGH
        : CONFIDENCE_DEFAULTS.SINGLE_FILE_LOW;
  else if (fileCount <= 3) confidence = CONFIDENCE_DEFAULTS.MULTI_FILE_LOW;
  else confidence = CONFIDENCE_DEFAULTS.MULTI_FILE_HIGH;

  const isSemantic = SEMANTIC_KEYWORDS.some(
    (keyword) => occurrence.find.toLowerCase().includes(keyword) || occurrence.replace.toLowerCase().includes(keyword)
  );

  if (isSemantic)
    confidence = Math.min(CONFIDENCE_DEFAULTS.MAX_CONFIDENCE, confidence + CONFIDENCE_DEFAULTS.SEMANTIC_BOOST);

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
const analyzeStopRulePatterns = (
  changedFiles: ChangedFile[],
  config: Config,
  confidenceThreshold: number
): StopRuleSuggestion[] => {
  const valuesByPath = collectValuesByPath(changedFiles);

  const suggestions = [
    ...detectSemverStopRules(valuesByPath, config),
    ...detectVersionFormatRules(valuesByPath, config),
    ...detectNumericStopRules(valuesByPath, config)
  ];

  // Filter by confidence threshold
  const filtered = suggestions.filter((s) => s.confidence >= confidenceThreshold);

  return filtered.toSorted((a, b) => b.confidence - a.confidence);
};

/**
 * Detects semver patterns and suggests semverDowngrade/semverMajorUpgrade rules.
 */
const detectSemverStopRules = (
  valuesByPath: Map<string, PathValueCollection>,
  config: Config
): StopRuleSuggestion[] => {
  const suggestions: StopRuleSuggestion[] = [];

  for (const [jsonPath, collection] of valuesByPath) {
    const hasSemver = collection.values.some((v) => typeof v === 'string' && SEMVER_PATTERN.test(v));

    if (!hasSemver) continue;

    const fileCount = collection.files.size;
    const confidence = fileCount === 1 ? CONFIDENCE_DEFAULTS.SEMVER_SINGLE_FILE : CONFIDENCE_DEFAULTS.SEMVER_MULTI_FILE;

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

  for (const [jsonPath, collection] of valuesByPath) {
    const semverValues = collection.values.filter((v) => typeof v === 'string' && SEMVER_PATTERN.test(v)) as string[];

    if (semverValues.length === 0) continue;

    const withV = semverValues.filter((v) => v.startsWith('v')).length;
    const withoutV = semverValues.length - withV;

    let vPrefix: 'required' | 'forbidden' | 'allowed' | undefined;
    let confidence = 0;

    if (withV === semverValues.length) {
      vPrefix = 'required';
      confidence = CONFIDENCE_DEFAULTS.VERSION_FORMAT_HIGH;
    } else if (withoutV === semverValues.length) {
      vPrefix = 'forbidden';
      confidence = CONFIDENCE_DEFAULTS.VERSION_FORMAT_HIGH;
    } else if (withV > withoutV * 2) {
      vPrefix = 'required';
      confidence = CONFIDENCE_DEFAULTS.VERSION_FORMAT_MEDIUM;
    } else if (withoutV > withV * 2) {
      vPrefix = 'forbidden';
      confidence = CONFIDENCE_DEFAULTS.VERSION_FORMAT_MEDIUM;
    }

    if (vPrefix && confidence >= CONFIDENCE_DEFAULTS.VERSION_FORMAT_MEDIUM) {
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

    const isConstraintField = CONSTRAINT_FIELD_NAMES.some((field) => jsonPath.toLowerCase().includes(field));

    if (!isConstraintField) continue;

    if (isStopRuleInConfig('numeric', jsonPath, config)) continue;

    const fileCount = collection.files.size;
    const confidence =
      fileCount === 1 ? CONFIDENCE_DEFAULTS.NUMERIC_SINGLE_FILE : CONFIDENCE_DEFAULTS.NUMERIC_MULTI_FILE;
    const suggestedMin = Math.max(NUMERIC_MIN_FLOOR, Math.floor(min * NUMERIC_MIN_MULTIPLIER));

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

const escapeYamlString = (value: string): string => value.replaceAll("'", "''");

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Helper: Simple Levenshtein distance for noise filtering
 */
const calculateLevenshteinDistance = (string1: string, string2: string): number => {
  const matrix: number[][] = [];

  for (let row = 0; row <= string2.length; row++) matrix[row] = [row];

  for (let col = 0; col <= string1.length; col++) matrix[0]![col] = col;

  for (let row = 1; row <= string2.length; row++)
    for (let col = 1; col <= string1.length; col++)
      if (string2.charAt(row - 1) === string1.charAt(col - 1)) matrix[row]![col] = matrix[row - 1]![col - 1]!;
      else
        matrix[row]![col] = Math.min(
          matrix[row - 1]![col - 1]! + 1,
          matrix[row]![col - 1]! + 1,
          matrix[row - 1]![col]! + 1
        );

  return matrix[string2.length]![string1.length]!;
};
