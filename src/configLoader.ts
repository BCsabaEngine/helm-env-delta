import { type FinalConfig, parseFinalConfig } from './configFile';
import { resolveConfigWithExtends } from './configMerger';

// Note: Config type is now an alias for FinalConfig
export type Config = FinalConfig;

// Loads and validates configuration from YAML file with extends support
export const loadConfigFile = (configPath: string): FinalConfig => {
  // Resolve config with extends chain and merge
  const mergedConfig = resolveConfigWithExtends(configPath);

  // Validate merged config as final (requires source and destination)
  const config = parseFinalConfig(mergedConfig, configPath);

  // Log successfully loaded config
  console.log(`\nConfiguration loaded: ${config.source} -> ${config.destination}` + (config.prune ? ' [prune!]' : ''));

  return config;
};
