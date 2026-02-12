// ============================================================================
// Barrel Exports for Config
// ============================================================================

// Zod validation error
export { isZodValidationError, ZodValidationError } from './ZodError';

// Config schema, types, and parsing
export type {
  ArraySortRule,
  BaseConfig,
  Config,
  FinalConfig,
  FixedValueConfig,
  FixedValueRule,
  FormatOnlyConfig,
  KeySortRule,
  NumericRule,
  OutputFormat,
  RegexFileKeyRule,
  RegexFileRule,
  RegexRule,
  SemverDowngradeRule,
  SemverMajorUpgradeRule,
  StopRule,
  TransformConfig,
  TransformRule,
  TransformRules,
  VersionFormatRule
} from './configFile';
export {
  ConfigValidationError,
  isConfigValidationError,
  parseBaseConfig,
  parseConfig,
  parseFinalConfig,
  parseFormatOnlyConfig
} from './configFile';

// Config loading
export type { LoadConfigOptions } from './configLoader';
export { ConfigLoaderError, isConfigLoaderError, loadConfigFile } from './configLoader';

// Config inheritance merging
export { ConfigMergerError, isConfigMergerError, mergeConfigs, resolveConfigWithExtends } from './configMerger';

// Config validation warnings
export type { WarningResult } from './configWarnings';
export { validateConfigWarnings } from './configWarnings';
