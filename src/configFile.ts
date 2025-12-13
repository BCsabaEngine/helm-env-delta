import { z } from 'zod';

// ============================================================================
// Stop Rule Schemas (Discriminated Union)
// ============================================================================

/**
 * Validates semver major version changes.
 * Blocks changes that would increment the major version (e.g., 1.x.x -> 2.0.0).
 */
const semverMajorRuleSchema = z.object({
  type: z.literal('semverMajor'),
  path: z.string().min(1).describe('JSONPath to the semver field')
});

/**
 * Validates numeric values against min/max constraints.
 * Used to prevent dangerous scaling operations (e.g., scaling below minimum replicas).
 */
const numericRuleSchema = z
  .object({
    type: z.literal('numeric'),
    path: z.string().min(1).describe('JSONPath to the numeric field'),
    min: z.number().optional().describe('Minimum allowed value (inclusive)'),
    max: z.number().optional().describe('Maximum allowed value (inclusive)')
  })
  .refine(
    (data) => {
      if (data.min !== undefined && data.max !== undefined) return data.min <= data.max;
      return true;
    },
    {
      message: 'min must be less than or equal to max',
      path: ['min']
    }
  );

/**
 * Validates field values against regex patterns.
 * Blocks changes that match dangerous patterns (e.g., production database URLs).
 */
const regexRuleSchema = z
  .object({
    type: z.literal('regex'),
    path: z.string().min(1).describe('JSONPath to the field to validate'),
    regex: z.string().min(1).describe('Regular expression pattern to match against')
  })
  .refine(
    (data) => {
      try {
        new RegExp(data.regex);
        return true;
      } catch {
        return false;
      }
    },
    {
      message: 'Invalid regular expression pattern',
      path: ['regex']
    }
  );

/**
 * Discriminated union of all stop rule types.
 * Stop rules prevent dangerous operations from being applied.
 */
const stopRuleSchema = z.discriminatedUnion('type', [semverMajorRuleSchema, numericRuleSchema, regexRuleSchema]);

// ============================================================================
// Output Format Schema
// ============================================================================

/**
 * YAML output formatting options.
 * Controls how the synchronized YAML files are formatted.
 */
const outputFormatSchema = z
  .object({
    indent: z.number().int().min(1).max(10).default(2).describe('Number of spaces for YAML indentation'),
    quoteValues: z.boolean().default(true).describe('Whether to quote values (right side of :) in output YAML')
  })
  .strict()
  .optional()
  .default({ indent: 2, quoteValues: true });

// ============================================================================
// Transform Schema (Future Feature - Commented Out)
// ============================================================================

/**
 * FUTURE FEATURE: Transform rules for find/replace operations.
 * Currently not implemented - schema prepared for future use.
 *
 * const transformRuleSchema = z.object({
 *   find: z.string().describe('Regex pattern to find'),
 *   replace: z.string().describe('Replacement string (supports capture groups)')
 * });
 */

// ============================================================================
// Main Configuration Schema
// ============================================================================

/**
 * Complete configuration schema for helm-env-delta.
 * Defines how YAML files are synchronized from source to destination environments.
 */
const configSchema = z
  .object({
    source: z.string().min(1).describe('Source folder path (e.g., ./uat)'),

    dest: z.string().min(1).describe('Destination folder path (e.g., ./prod)'),

    include: z
      .array(z.string().min(1))
      .optional()
      .describe('Glob patterns for files to process. If not set, all YAML files are processed.'),

    prune: z.boolean().default(false).describe('Remove files in dest that are not in source'),

    skipPath: z
      .record(z.string(), z.array(z.string()))
      .optional()
      .describe('Map of file patterns to JSONPath arrays indicating paths to skip during sync'),

    outputFormat: outputFormatSchema,

    // transforms: z
    //   .record(z.string(), z.array(transformRuleSchema))
    //   .optional()
    //   .describe('Map of JSONPaths to transform rules (FUTURE FEATURE)'),

    orders: z
      .record(z.string(), z.array(z.string()))
      .optional()
      .describe('Map of file patterns to key ordering arrays for consistent YAML structure'),

    stopRules: z
      .record(z.string(), z.array(stopRuleSchema))
      .optional()
      .describe('Map of file patterns to validation rules that can block operations')
  })
  .strict();

// ============================================================================
// Type Exports
// ============================================================================

export type Config = z.infer<typeof configSchema>;
export type StopRule = z.infer<typeof stopRuleSchema>;
export type SemverMajorRule = z.infer<typeof semverMajorRuleSchema>;
export type NumericRule = z.infer<typeof numericRuleSchema>;
export type RegexRule = z.infer<typeof regexRuleSchema>;
export type OutputFormat = z.infer<typeof outputFormatSchema>;

// ============================================================================
// Parser Function
// ============================================================================

/**
 * Parses and validates configuration data.
 *
 * @param data - Raw configuration object (typically from YAML.parse)
 * @param configPath - Optional path to config file for error messages
 * @returns Validated configuration object
 * @throws {ConfigValidationError} If validation fails with user-friendly error messages
 *
 * @example
 * ```typescript
 * import * as YAML from 'yaml';
 * import { parseConfig } from './configFile';
 *
 * const rawData = YAML.parse(configFileContent);
 * const config = parseConfig(rawData, './config.yaml');
 * ```
 */
export const parseConfig = (data: unknown, configPath?: string): Config => {
  const result = configSchema.safeParse(data);

  if (!result.success) throw new ConfigValidationError(result.error, configPath);

  return result.data;
};

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Custom error class for configuration validation failures.
 * Provides user-friendly error messages with context.
 */
export class ConfigValidationError extends Error {
  constructor(
    public readonly zodError: z.ZodError,
    public readonly configPath?: string
  ) {
    const errorMessage = ConfigValidationError.formatError(zodError, configPath);
    super(errorMessage);
    this.name = 'ConfigValidationError';
  }

  /**
   * Formats Zod validation errors into user-friendly messages.
   */
  private static formatError = (zodError: z.ZodError, configPath?: string): string => {
    const header = configPath
      ? `Configuration validation failed in ${configPath}:\n`
      : 'Configuration validation failed:\n';

    const errors = zodError.issues.map((error) => {
      const path = error.path.length > 0 ? error.path.join('.') : 'root';

      let message = `  - ${path}: ${error.message}`;

      // Add helpful context for common errors
      if (error.code === 'invalid_type' && 'expected' in error && 'received' in error)
        message += ` (expected ${error.expected}, got ${error.received})`;

      if (error.code === 'unrecognized_keys' && 'keys' in error) {
        const keys = error.keys as string[];
        message += `\n    Unknown fields: ${keys.join(', ')}`;
        message += '\n    Check for typos or remove unsupported fields';
      }

      return message;
    });

    return header + errors.join('\n');
  };
}

/**
 * Type guard to check if an error is a ConfigValidationError.
 */
export const isConfigValidationError = (error: unknown): error is ConfigValidationError => {
  return error instanceof ConfigValidationError;
};
