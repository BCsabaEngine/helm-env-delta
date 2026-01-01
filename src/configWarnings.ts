import type { FinalConfig } from './configFile';

/**
 * Result of config warnings validation.
 */
export interface WarningResult {
  warnings: string[];
  hasWarnings: boolean;
}

/**
 * Validates configuration and returns non-fatal warnings.
 * Checks for common configuration issues that won't cause failures but may indicate problems.
 */
export const validateConfigWarnings = (config: FinalConfig): WarningResult => {
  const warnings: string[] = [];

  // Check for inefficient glob patterns
  const allGlobs = [...config.include, ...config.exclude];
  for (const glob of allGlobs)
    if (glob.includes('**/**')) warnings.push(`Inefficient glob pattern '${glob}' detected (use '**/*' instead)`);

  // Check for duplicate patterns
  const includeSet = new Set(config.include);
  if (includeSet.size < config.include.length) warnings.push('Duplicate patterns found in include array');

  const excludeSet = new Set(config.exclude);
  if (excludeSet.size < config.exclude.length) warnings.push('Duplicate patterns found in exclude array');

  // Check for conflicting include/exclude patterns
  for (const pattern of config.include)
    if (config.exclude.includes(pattern))
      warnings.push(`Pattern '${pattern}' appears in both include and exclude (exclude takes precedence)`);

  // Check for empty skipPath values
  if (config.skipPath)
    for (const [pattern, paths] of Object.entries(config.skipPath))
      if (paths.length === 0) warnings.push(`skipPath pattern '${pattern}' has empty array (will have no effect)`);

  // Check for empty transform values
  if (config.transforms)
    for (const [pattern, rules] of Object.entries(config.transforms))
      if ((rules.content?.length ?? 0) === 0 && (rules.filename?.length ?? 0) === 0)
        warnings.push(`Transform pattern '${pattern}' has empty content and filename arrays (will have no effect)`);

  return {
    warnings,
    hasWarnings: warnings.length > 0
  };
};
