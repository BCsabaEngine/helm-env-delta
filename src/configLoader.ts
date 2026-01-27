import path from 'node:path';

import {
  type BaseConfig,
  type FinalConfig,
  type FormatOnlyConfig,
  parseFinalConfig,
  parseFormatOnlyConfig,
  type TransformConfig,
  type TransformRules
} from './configFile';
import { resolveConfigWithExtends } from './configMerger';
import { loadTransformFiles } from './utils';

// Note: Config type is now an alias for FinalConfig
export type Config = FinalConfig;

export type LoadConfigOptions = {
  formatOnly?: boolean;
};

/**
 * Expands file-based transform configurations by loading external YAML files.
 * Converts contentFile and filenameFile references into inline transform rules.
 * File-based transforms are prepended before inline regex transforms.
 *
 * @param config - The merged base config (after extends resolution)
 * @param configDirectory - Directory of the config file (for resolving relative paths)
 * @returns Config with expanded transform rules
 */
const expandTransformFiles = (config: BaseConfig, configDirectory: string): BaseConfig => {
  if (!config.transforms) return config;

  const expandedTransforms: TransformConfig = {};

  for (const [pattern, rules] of Object.entries(config.transforms)) {
    let content = [...(rules.content ?? [])];
    let filename = [...(rules.filename ?? [])];

    // Load and prepend content transform files (file-based applied BEFORE inline regex)
    if (rules.contentFile) {
      const filePaths = Array.isArray(rules.contentFile) ? rules.contentFile : [rules.contentFile];
      const fileEntries = loadTransformFiles(filePaths, configDirectory);
      content = [...fileEntries, ...content];
    }

    // Load and prepend filename transform files (file-based applied BEFORE inline regex)
    if (rules.filenameFile) {
      const filePaths = Array.isArray(rules.filenameFile) ? rules.filenameFile : [rules.filenameFile];
      const fileEntries = loadTransformFiles(filePaths, configDirectory);
      filename = [...fileEntries, ...filename];
    }

    const expanded: TransformRules = { content, filename };
    expandedTransforms[pattern] = expanded;
  }

  return { ...config, transforms: expandedTransforms };
};

// Loads and validates configuration from YAML file with extends support
export const loadConfigFile = (
  configPath: string,
  quiet = false,
  logger?: import('./logger').Logger,
  options: LoadConfigOptions = {}
): FinalConfig | FormatOnlyConfig => {
  const configDirectory = path.dirname(path.resolve(configPath));

  // Resolve config with extends chain and merge
  const mergedConfig = resolveConfigWithExtends(configPath, new Set(), 0, logger);

  // Expand file-based transform configs (contentFile, filenameFile)
  const expandedConfig = expandTransformFiles(mergedConfig, configDirectory);

  // Validate expanded config (format-only mode only requires destination)
  const config = options.formatOnly
    ? parseFormatOnlyConfig(expandedConfig, configPath)
    : parseFinalConfig(expandedConfig, configPath);

  // Log successfully loaded config (suppress in quiet mode)
  if (!quiet) {
    const sourceInfo = config.source ? `${config.source} -> ` : '';
    console.log(`\nConfiguration loaded: ${sourceInfo}${config.destination}` + (config.prune ? ' [prune!]' : ''));
  }

  return config;
};
