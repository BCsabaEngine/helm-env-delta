import type { FileDiffResult } from '../fileDiff';
import type { FileMap } from '../fileLoader';
import { createErrorClass, createErrorTypeGuard } from './errors';

// ============================================================================
// Types
// ============================================================================

export type ChangeMode = 'new' | 'modified' | 'deleted' | 'all';

export type FilterLogicalOperator = 'AND' | 'OR' | 'NONE';

export interface ParsedFilter {
  operator: FilterLogicalOperator;
  terms: string[]; // Lowercase, unescaped search terms
}

// ============================================================================
// Error Handling
// ============================================================================

const filterParseErrorCodes = {
  MIXED_OPERATORS: 'Cannot combine AND (+) and OR (,) operators in a single filter expression'
};

export const FilterParseError = createErrorClass('FilterParseError', filterParseErrorCodes);
export const isFilterParseError = createErrorTypeGuard(FilterParseError);

// ============================================================================
// Filter Parsing
// ============================================================================

/**
 * Parses a filter expression into its operator and terms.
 * Supports OR (,), AND (+) operators with backslash escaping.
 * Throws FilterParseError if both operators are used in the same expression.
 */
export const parseFilterExpression = (filter: string | undefined): ParsedFilter => {
  if (!filter) return { operator: 'NONE', terms: [] };

  // Scan for unescaped operators
  let hasUnescapedOr = false;
  let hasUnescapedAnd = false;

  for (let index = 0; index < filter.length; index++) {
    const char = filter[index];
    const isEscaped = index > 0 && filter[index - 1] === '\\';

    if (char === ',' && !isEscaped) hasUnescapedOr = true;
    if (char === '+' && !isEscaped) hasUnescapedAnd = true;
  }

  // Check for mixed operators
  if (hasUnescapedOr && hasUnescapedAnd)
    throw new FilterParseError('Mixed operators detected', {
      code: 'MIXED_OPERATORS',
      hints: [
        'Use only , (OR) or only + (AND) in a single filter',
        String.raw`Escape literal characters with backslash: \, or \+`
      ]
    });

  // Determine operator
  const operator: FilterLogicalOperator = hasUnescapedOr ? 'OR' : hasUnescapedAnd ? 'AND' : 'NONE';

  // Split by operator (handling escapes)
  let terms: string[];
  if (operator === 'NONE') terms = [filter];
  else {
    const splitChar = operator === 'OR' ? ',' : '+';
    terms = [];
    let currentTerm = '';

    for (let index = 0; index < filter.length; index++) {
      const char = filter[index];
      const isEscaped = index > 0 && filter[index - 1] === '\\';

      if (char === splitChar && !isEscaped) {
        terms.push(currentTerm);
        currentTerm = '';
      } else if (char === '\\' && index + 1 < filter.length && (filter[index + 1] === ',' || filter[index + 1] === '+'))
        // Skip escape character, next iteration will add the escaped char
        continue;
      else currentTerm += char;
    }
    terms.push(currentTerm);
  }

  // Post-process terms: unescape, trim, filter empty, lowercase
  const processedTerms = terms
    .map((term) =>
      term
        .replaceAll(/\\([+,])/g, '$1')
        .trim()
        .toLowerCase()
    )
    .filter((term) => term.length > 0);

  // If only one term after filtering, treat as NONE for backward compatibility
  const finalOperator = processedTerms.length <= 1 ? 'NONE' : operator;

  return { operator: finalOperator, terms: processedTerms };
};

/**
 * Checks if a file matches the parsed filter expression.
 * Matches against both file path and content (case-insensitive).
 */
export const fileMatchesFilter = (filePath: string, content: string, parsedFilter: ParsedFilter): boolean => {
  const { operator, terms } = parsedFilter;

  if (terms.length === 0) return true;

  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();

  const termMatches = (term: string): boolean => lowerPath.includes(term) || lowerContent.includes(term);

  switch (operator) {
    case 'OR': {
      return terms.some((term) => termMatches(term));
    }
    case 'AND': {
      return terms.every((term) => termMatches(term));
    }
    case 'NONE': {
      const firstTerm = terms[0];
      return terms.length === 0 || (firstTerm !== undefined && termMatches(firstTerm));
    }
  }
};

/**
 * Filters a FileDiffResult by change type mode.
 * Returns only the changes matching the specified mode.
 */
export const filterDiffResultByMode = (diffResult: FileDiffResult, mode: ChangeMode): FileDiffResult => {
  if (mode === 'all') return diffResult;

  return {
    addedFiles: mode === 'new' ? diffResult.addedFiles : [],
    deletedFiles: mode === 'deleted' ? diffResult.deletedFiles : [],
    changedFiles: mode === 'modified' ? diffResult.changedFiles : [],
    unchangedFiles: diffResult.unchangedFiles
  };
};

/**
 * Filters a FileMap by filename or content match (case-insensitive).
 * Supports logical operators: , (OR), + (AND).
 * A file matches if EITHER:
 *   1. The filename includes the filter text
 *   2. The file content includes the filter text
 */
export const filterFileMap = (fileMap: FileMap, filter: string | undefined): FileMap => {
  const parsedFilter = parseFilterExpression(filter);

  if (parsedFilter.terms.length === 0) return fileMap;

  const filteredMap = new Map<string, string>();

  for (const [filePath, content] of fileMap)
    if (fileMatchesFilter(filePath, content, parsedFilter)) filteredMap.set(filePath, content);

  return filteredMap;
};

/**
 * Filters two FileMaps together by filename or content match (case-insensitive).
 * Supports logical operators: , (OR), + (AND).
 * A file is included if its path matches in EITHER map (by filename or content).
 * This ensures files that exist in both maps stay in both filtered outputs,
 * preventing "changed" files from incorrectly appearing as "added".
 */
export const filterFileMaps = (
  sourceFiles: FileMap,
  destinationFiles: FileMap,
  filter: string | undefined
): { sourceFiles: FileMap; destinationFiles: FileMap } => {
  const parsedFilter = parseFilterExpression(filter);

  if (parsedFilter.terms.length === 0) return { sourceFiles, destinationFiles };

  const matchingPaths = new Set<string>();

  // Collect matching paths from source
  for (const [filePath, content] of sourceFiles)
    if (fileMatchesFilter(filePath, content, parsedFilter)) matchingPaths.add(filePath);

  // Collect matching paths from destination
  for (const [filePath, content] of destinationFiles)
    if (fileMatchesFilter(filePath, content, parsedFilter)) matchingPaths.add(filePath);

  // Filter both maps to include only matching paths
  const filteredSource = new Map<string, string>();
  const filteredDestination = new Map<string, string>();

  for (const [filePath, content] of sourceFiles) if (matchingPaths.has(filePath)) filteredSource.set(filePath, content);

  for (const [filePath, content] of destinationFiles)
    if (matchingPaths.has(filePath)) filteredDestination.set(filePath, content);

  return { sourceFiles: filteredSource, destinationFiles: filteredDestination };
};
