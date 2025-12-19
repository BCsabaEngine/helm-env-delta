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
 * Validates semver major version downgrades.
 * Blocks changes that would decrement the major version (e.g., 2.x.x -> 1.0.0).
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
 */
const regexRuleSchema = z
  .object({
    type: z.literal('regex'),
    path: z.string().min(1),
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

const stopRuleSchema = z.discriminatedUnion('type', [
  semverMajorUpgradeRuleSchema,
  semverDowngradeRuleSchema,
  numericRuleSchema,
  regexRuleSchema
]);

// Array Sort Schema
const arraySortRuleSchema = z.object({
  path: z.string().min(1),
  sortBy: z.string().min(1),
  order: z.enum(['asc', 'desc']).default('asc')
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
 * - content: Transforms applied to YAML values (not keys)
 * - filename: Transforms applied to file paths (full relative path including folders)
 * At least one of content or filename must be specified.
 */
const transformRulesSchema = z
  .object({
    content: z.array(transformRuleSchema).optional(),
    filename: z.array(transformRuleSchema).optional()
  })
  .refine((data) => data.content !== undefined || data.filename !== undefined, {
    message: 'At least one of content or filename must be specified'
  });

// Base Configuration Schema (allows partial configs for inheritance, no defaults)
const baseConfigSchema = z.object({
  extends: z.string().min(1).optional(),

  source: z.string().min(1).optional(),

  destination: z.string().min(1).optional(),

  include: z.array(z.string().min(1)).optional(),

  exclude: z.array(z.string().min(1)).optional(),

  prune: z.boolean().optional(),

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

  stopRules: z.record(z.string(), z.array(stopRuleSchema)).optional()
});

// Final Configuration Schema (requires source and destination, applies defaults)
const finalConfigSchema = baseConfigSchema
  .omit({ extends: true })
  .required({ source: true, destination: true })
  .extend({
    include: z.array(z.string().min(1)).default(['**/*']),
    exclude: z.array(z.string().min(1)).default([]),
    prune: z.boolean().default(false),
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
export type Config = FinalConfig;
export type StopRule = z.infer<typeof stopRuleSchema>;
export type SemverMajorUpgradeRule = z.infer<typeof semverMajorUpgradeRuleSchema>;
export type SemverDowngradeRule = z.infer<typeof semverDowngradeRuleSchema>;
export type NumericRule = z.infer<typeof numericRuleSchema>;
export type RegexRule = z.infer<typeof regexRuleSchema>;
export type ArraySortRule = z.infer<typeof arraySortRuleSchema>;
export type TransformRule = z.infer<typeof transformRuleSchema>;
export type TransformRules = z.infer<typeof transformRulesSchema>;
export type TransformConfig = Record<string, TransformRules>;
export type OutputFormat = BaseConfig['outputFormat'];

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

//Parses and validates configuration data (alias for parseFinalConfig)
export const parseConfig = parseFinalConfig;

export {
  ZodValidationError as ConfigValidationError,
  isZodValidationError as isConfigValidationError
} from './ZodError';
