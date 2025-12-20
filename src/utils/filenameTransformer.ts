import path from 'node:path';

import { isMatch } from 'picomatch';

import type { TransformConfig, TransformRule } from '../configFile';
import { createErrorClass, createErrorTypeGuard } from './errors';

// ============================================================================
// Error Handling
// ============================================================================

const FilenameTransformerErrorClass = createErrorClass('Filename Transformer Error', {
  INVALID_FILENAME: 'Transformed path contains invalid characters',
  PATH_TRAVERSAL: 'Path transform attempted traversal outside source/destination',
  EMPTY_FILENAME: 'Transformed path is empty',
  REGEX_ERROR: 'Failed to apply regex transformation'
});

export class FilenameTransformerError extends FilenameTransformerErrorClass {}
export const isFilenameTransformerError = createErrorTypeGuard(FilenameTransformerError);

// ============================================================================
// Core Transformation Algorithm
// ============================================================================

const applySequentialTransforms = (value: string, rules: TransformRule[]): string => {
  let result = value;
  for (const rule of rules)
    try {
      const regex = new RegExp(rule.find, 'g');
      result = result.replace(regex, rule.replace);
    } catch (error) {
      const regexError = new FilenameTransformerError('Failed to apply regex transformation', {
        code: 'REGEX_ERROR',
        cause: error instanceof Error ? error : undefined
      });

      regexError.message += `\n\n  Hint: The regex pattern failed to compile. Check for:`;
      regexError.message += `\n    - Balanced parentheses: (group)`;
      regexError.message += `\n    - Escaped special chars: \\. \\[ \\]`;
      regexError.message += `\n    - Valid capture groups: $1, $2, etc.`;
      regexError.message += `\n    Pattern: ${rule.find}`;

      throw regexError;
    }

  return result;
};

const validateTransformedPath = (transformedPath: string, originalPath: string): void => {
  if (!transformedPath || transformedPath.trim() === '') {
    const emptyError = new FilenameTransformerError('Transformed path is empty', {
      code: 'EMPTY_FILENAME',
      path: originalPath
    });

    emptyError.message += '\n\n  Hint: The transform produced an empty path. Check your regex pattern:';
    emptyError.message += "\n    - Ensure 'replace' value is not empty";
    emptyError.message += '\n    - Verify pattern matches expected part of filename';

    throw emptyError;
  }

  if (transformedPath.startsWith('/') || transformedPath.includes('..')) {
    const traversalError = new FilenameTransformerError(
      'Path transform attempted traversal outside source/destination',
      {
        code: 'PATH_TRAVERSAL',
        path: originalPath,
        details: `Transformed path: ${transformedPath}`
      }
    );

    traversalError.message += '\n\n  Hint: Filename transforms must not navigate outside source/destination:';
    traversalError.message += "\n    BAD: { find: 'file\\.yaml', replace: '../file.yaml' }  (contains ..)";
    traversalError.message += "\n    BAD: { find: 'file', replace: '/etc/passwd' }  (absolute path)";
    traversalError.message += "\n    GOOD: { find: 'envs/uat/', replace: 'envs/prod/' }";
    traversalError.message += '\n    This is a security feature to prevent accidental overwrites.';

    throw traversalError;
  }

  // eslint-disable-next-line no-control-regex
  const invalidChars = /[\u0000-\u001F"*:<>?|]/;
  if (invalidChars.test(transformedPath)) {
    const invalidError = new FilenameTransformerError('Transformed path contains invalid characters', {
      code: 'INVALID_FILENAME',
      path: originalPath,
      details: `Transformed path: ${transformedPath}`
    });

    invalidError.message += '\n\n  Hint: The transformed path contains characters not allowed in filenames:';
    invalidError.message += '\n    - Remove control characters (\\x00-\\x1F)';
    invalidError.message += '\n    - Avoid: " * : < > ? |';
    invalidError.message += '\n    - Check your regex replacement string';

    throw invalidError;
  }
};

// ============================================================================
// File Pattern Matching
// ============================================================================

export const getFilenameTransformsForFile = (filePath: string, transforms?: TransformConfig): TransformRule[] => {
  if (!transforms) return [];

  const rules: TransformRule[] = [];

  for (const [pattern, transformRules] of Object.entries(transforms))
    if (isMatch(filePath, pattern)) rules.push(...(transformRules.filename ?? []));

  return rules;
};

// ============================================================================
// Filename Transformation
// ============================================================================

export const transformFilename = (filePath: string, transforms?: TransformConfig): string => {
  if (!transforms) return filePath;

  const matchedRules = getFilenameTransformsForFile(filePath, transforms);
  if (matchedRules.length === 0) return filePath;

  const transformedPath = applySequentialTransforms(filePath, matchedRules);

  validateTransformedPath(transformedPath, filePath);

  const normalizedPath = path.normalize(transformedPath);

  return normalizedPath;
};

export const transformFilenameMap = (
  fileMap: Map<string, string>,
  transforms?: TransformConfig
): Map<string, string> => {
  if (!transforms) return fileMap;

  const transformed = new Map<string, string>();

  for (const [originalPath, content] of fileMap.entries()) {
    const transformedPath = transformFilename(originalPath, transforms);
    transformed.set(transformedPath, content);
  }

  return transformed;
};
