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
 * Transform rules for regex find/replace operations on YAML values.
 * Applies to ALL string values in matched files (not JSONPath-specific).
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

// Main Configuration Schema
const configSchema = z.object({
  source: z.string().min(1),

  destination: z.string().min(1),

  include: z.array(z.string().min(1)).default(['**/*']),

  exclude: z.array(z.string().min(1)).default([]),

  prune: z.boolean().default(false),

  skipPath: z.record(z.string(), z.array(z.string())).optional(),

  outputFormat: z
    .object({
      indent: z.number().int().min(1).max(10).default(2),
      keySeparator: z.boolean().default(false),
      quoteValues: z.record(z.string(), z.array(z.string())).optional(),
      keyOrders: z.record(z.string(), z.array(z.string())).optional(),
      arraySort: z.record(z.string(), z.array(arraySortRuleSchema)).optional()
    })
    .optional()
    .default({ indent: 2, keySeparator: false }),

  transforms: z.record(z.string(), z.array(transformRuleSchema)).optional(),

  stopRules: z.record(z.string(), z.array(stopRuleSchema)).optional()
});

//Types
export type Config = z.infer<typeof configSchema>;
export type StopRule = z.infer<typeof stopRuleSchema>;
export type SemverMajorUpgradeRule = z.infer<typeof semverMajorUpgradeRuleSchema>;
export type SemverDowngradeRule = z.infer<typeof semverDowngradeRuleSchema>;
export type NumericRule = z.infer<typeof numericRuleSchema>;
export type RegexRule = z.infer<typeof regexRuleSchema>;
export type ArraySortRule = z.infer<typeof arraySortRuleSchema>;
export type TransformRule = z.infer<typeof transformRuleSchema>;
export type OutputFormat = Config['outputFormat'];

//Parses and validates configuration data
export const parseConfig = (data: unknown, configPath?: string): Config => {
  const result = configSchema.safeParse(data);

  if (!result.success) throw new ZodValidationError(result.error, configPath);

  return result.data;
};

export {
  ZodValidationError as ConfigValidationError,
  isZodValidationError as isConfigValidationError
} from './ZodError';
