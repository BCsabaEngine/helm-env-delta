import path from 'node:path';

import { z } from 'zod';

import { ZodValidationError } from './ZodError';

// Stop Rule Schemas (Discriminated Union)

/**
 * Validates semver major version upgrades.
 * Blocks changes that would increment the major version (e.g., 1.x.x -> 2.0.0).
 */
const semverMajorUpgradeRuleSchema = z.object({
  type: z.literal('semverMajorUpgrade'),
  path: z.string().min(1)
});

/**
 * Validates semver version downgrades.
 * Blocks any version downgrade including major, minor, or patch (e.g., 2.0.0 -> 1.0.0, 1.3.2 -> 1.2.4, 1.0.5 -> 1.0.3).
 */
const semverDowngradeRuleSchema = z.object({
  type: z.literal('semverDowngrade'),
  path: z.string().min(1)
});

/**
 * Validates numeric values against min/max constraints.
 * Used to prevent dangerous scaling operations (e.g., scaling below minimum replicas).
 */
const numericRuleSchema = z
  .object({
    type: z.literal('numeric'),
    path: z.string().min(1),
    min: z.number().optional(),
    max: z.number().optional()
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
 * Path is optional: if set, checks specific field; if not set, scans all values recursively.
 */
const regexRuleSchema = z
  .object({
    type: z.literal('regex'),
    path: z.string().min(1).optional(),
    regex: z.string().min(1)
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
 * Validates field values against regex patterns loaded from a YAML array file.
 * Works exactly like regex rule but loads patterns from an external file.
 * Path is optional: if set, checks specific field; if not set, scans all values recursively.
 */
const regexFileRuleSchema = z.object({
  type: z.literal('regexFile'),
  path: z.string().min(1).optional(),
  file: z.string().min(1)
});

/**
 * Validates field values against regex patterns derived from transform file keys.
 * Uses the keys from a transform file as regex patterns to block.
 * Path is optional: if set, checks specific field; if not set, scans all values recursively.
 */
const regexFileKeyRuleSchema = z.object({
  type: z.literal('regexFileKey'),
  path: z.string().min(1).optional(),
  file: z.string().min(1)
});

/**
 * Validates version string format.
 * Enforces strict major.minor.patch format (e.g., "1.2.3" or "v1.2.3").
 * Rejects incomplete versions, pre-release identifiers, build metadata, and leading zeros.
 */
const versionFormatRuleSchema = z
  .object({
    type: z.literal('versionFormat'),
    path: z.string().min(1),
    vPrefix: z.enum(['required', 'allowed', 'forbidden']).default('allowed')
  })
  .strict();

const stopRuleSchema = z.discriminatedUnion('type', [
  semverMajorUpgradeRuleSchema,
  semverDowngradeRuleSchema,
  numericRuleSchema,
  regexRuleSchema,
  regexFileRuleSchema,
  regexFileKeyRuleSchema,
  versionFormatRuleSchema
]);

// Array Sort Schema
const arraySortRuleSchema = z.object({
  path: z.string().min(1),
  sortBy: z.string().min(1),
  order: z.enum(['asc', 'desc']).default('asc')
});

// Fixed Value Schema
/**
 * Fixed value rule that sets a specific JSONPath location to a constant value.
 * Applied after merge, before formatting.
 * Supports all JSONPath filter operators: =, ^=, $=, *=
 */
const fixedValueRuleSchema = z.object({
  path: z.string().min(1).describe('JSONPath to the value to set'),
  value: z.unknown().describe('The constant value to set (any type: string, number, boolean, null, object, array)')
});

// ============================================================================
// Transform Schema
// ============================================================================

/**
 * Transform rule for regex find/replace operations.
 * Used for both content transforms (on YAML values) and filename transforms (on paths).
 */
const transformRuleSchema = z
  .object({
    find: z.string().min(1).describe('Regex pattern to find'),
    replace: z.string().describe('Replacement string (supports $1, $2... capture groups)')
  })
  .refine(
    (data) => {
      try {
        new RegExp(data.find);
        return true;
      } catch {
        return false;
      }
    },
    {
      message: 'Invalid regular expression pattern',
      path: ['find']
    }
  );

/**
 * Transform rules configuration for a file pattern.
 * - content: Inline regex transforms applied to YAML values (not keys)
 * - filename: Inline regex transforms applied to file paths (full relative path including folders)
 * - contentFile: File(s) with key:value pairs for literal content replacement (applied before inline)
 * - filenameFile: File(s) with key:value pairs for literal filename replacement (applied before inline)
 * At least one transform type must be specified.
 */
const transformRulesSchema = z
  .object({
    content: z.array(transformRuleSchema).optional(),
    filename: z.array(transformRuleSchema).optional(),
    contentFile: z.union([z.string().min(1), z.array(z.string().min(1))]).optional(),
    filenameFile: z.union([z.string().min(1), z.array(z.string().min(1))]).optional()
  })
  .refine(
    (data) =>
      data.content !== undefined ||
      data.filename !== undefined ||
      data.contentFile !== undefined ||
      data.filenameFile !== undefined,
    {
      message: 'At least one of content, filename, contentFile, or filenameFile must be specified'
    }
  );

// Base Configuration Schema (allows partial configs for inheritance, no defaults)
const baseConfigSchema = z.object({
  extends: z.string().min(1).optional(),

  source: z.string().min(1).optional(),

  destination: z.string().min(1).optional(),

  include: z.array(z.string().min(1)).optional(),

  exclude: z.array(z.string().min(1)).optional(),

  prune: z.boolean().optional(),

  confirmationDelay: z.number().int().min(0).optional(),

  skipPath: z.record(z.string(), z.array(z.string())).optional(),

  outputFormat: z
    .object({
      indent: z.number().int().min(1).max(10).optional(),
      keySeparator: z.boolean().optional(),
      quoteValues: z.record(z.string(), z.array(z.string())).optional(),
      keyOrders: z.record(z.string(), z.array(z.string())).optional(),
      arraySort: z.record(z.string(), z.array(arraySortRuleSchema)).optional()
    })
    .optional(),

  transforms: z.record(z.string(), transformRulesSchema).optional(),

  stopRules: z.record(z.string(), z.array(stopRuleSchema)).optional(),

  fixedValues: z.record(z.string(), z.array(fixedValueRuleSchema)).optional()
});

// Final Configuration Schema (requires source and destination, applies defaults)
const finalConfigSchema = baseConfigSchema
  .omit({ extends: true })
  .required({ source: true, destination: true })
  .extend({
    include: z.array(z.string().min(1)).default(['**/*']),
    exclude: z.array(z.string().min(1)).default([]),
    prune: z.boolean().default(false),
    confirmationDelay: z.number().int().min(0).default(3000),
    outputFormat: z
      .object({
        indent: z.number().int().min(1).max(10).default(2),
        keySeparator: z.boolean().default(false),
        quoteValues: z.record(z.string(), z.array(z.string())).optional(),
        keyOrders: z.record(z.string(), z.array(z.string())).optional(),
        arraySort: z.record(z.string(), z.array(arraySortRuleSchema)).optional()
      })
      .optional()
      .default({ indent: 2, keySeparator: false })
  })
  .refine(
    (data) => {
      const normalizedSource = path.resolve(data.source);
      const normalizedDestination = path.resolve(data.destination);
      return normalizedSource !== normalizedDestination;
    },
    {
      message: 'Source and destination folders cannot be the same',
      path: ['destination']
    }
  );

// Format-Only Configuration Schema (destination required, source optional)
const formatOnlyConfigSchema = baseConfigSchema
  .omit({ extends: true })
  .required({ destination: true })
  .extend({
    include: z.array(z.string().min(1)).default(['**/*']),
    exclude: z.array(z.string().min(1)).default([]),
    prune: z.boolean().default(false),
    confirmationDelay: z.number().int().min(0).default(3000),
    outputFormat: z
      .object({
        indent: z.number().int().min(1).max(10).default(2),
        keySeparator: z.boolean().default(false),
        quoteValues: z.record(z.string(), z.array(z.string())).optional(),
        keyOrders: z.record(z.string(), z.array(z.string())).optional(),
        arraySort: z.record(z.string(), z.array(arraySortRuleSchema)).optional()
      })
      .optional()
      .default({ indent: 2, keySeparator: false })
  });

//Types
export type BaseConfig = z.infer<typeof baseConfigSchema>;
export type FinalConfig = z.infer<typeof finalConfigSchema>;
export type FormatOnlyConfig = z.infer<typeof formatOnlyConfigSchema>;
export type Config = FinalConfig;
export type StopRule = z.infer<typeof stopRuleSchema>;
export type SemverMajorUpgradeRule = z.infer<typeof semverMajorUpgradeRuleSchema>;
export type SemverDowngradeRule = z.infer<typeof semverDowngradeRuleSchema>;
export type NumericRule = z.infer<typeof numericRuleSchema>;
export type RegexRule = z.infer<typeof regexRuleSchema>;
export type RegexFileRule = z.infer<typeof regexFileRuleSchema>;
export type RegexFileKeyRule = z.infer<typeof regexFileKeyRuleSchema>;
export type VersionFormatRule = z.infer<typeof versionFormatRuleSchema>;
export type ArraySortRule = z.infer<typeof arraySortRuleSchema>;
export type TransformRule = z.infer<typeof transformRuleSchema>;
export type TransformRules = z.infer<typeof transformRulesSchema>;
export type TransformConfig = Record<string, TransformRules>;
export type OutputFormat = BaseConfig['outputFormat'];
export type FixedValueRule = z.infer<typeof fixedValueRuleSchema>;
export type FixedValueConfig = Record<string, FixedValueRule[]>;

//Parses and validates base configuration (allows partial configs)
export const parseBaseConfig = (data: unknown, configPath?: string): BaseConfig => {
  const result = baseConfigSchema.safeParse(data);

  if (!result.success) throw new ZodValidationError(result.error, configPath);

  return result.data;
};

//Parses and validates final configuration (requires source and destination)
export const parseFinalConfig = (data: unknown, configPath?: string): FinalConfig => {
  const result = finalConfigSchema.safeParse(data);

  if (!result.success) {
    const error = new ZodValidationError(result.error, configPath);
    const sourceOrDestinationMissing = result.error.issues.some(
      (issue) => (issue.path[0] === 'source' || issue.path[0] === 'destination') && issue.code === 'invalid_type'
    );

    if (sourceOrDestinationMissing)
      error.message += '\n\n  Hint: Base configs can omit source/dest, but final config must specify them.';

    throw error;
  }

  return result.data;
};

//Parses and validates format-only configuration (only destination required)
export const parseFormatOnlyConfig = (data: unknown, configPath?: string): FormatOnlyConfig => {
  const result = formatOnlyConfigSchema.safeParse(data);

  if (!result.success) {
    const error = new ZodValidationError(result.error, configPath);
    const destinationMissing = result.error.issues.some(
      (issue) => issue.path[0] === 'destination' && issue.code === 'invalid_type'
    );

    if (destinationMissing) error.message += '\n\n  Hint: Format-only mode requires destination to be specified.';

    throw error;
  }

  return result.data;
};

//Parses and validates configuration data (alias for parseFinalConfig)
export const parseConfig = parseFinalConfig;

export {
  ZodValidationError as ConfigValidationError,
  isZodValidationError as isConfigValidationError
} from './ZodError';
