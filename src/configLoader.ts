import { type FinalConfig, parseFinalConfig } from './configFile';
import { resolveConfigWithExtends } from './configMerger';

// Note: Config type is now an alias for FinalConfig
export type Config = FinalConfig;

// Loads and validates configuration from YAML file with extends support
export const loadConfigFile = (configPath: string, quiet = false, logger?: import('./logger').Logger): FinalConfig => {
  // Resolve config with extends chain and merge
  const mergedConfig = resolveConfigWithExtends(configPath, new Set(), 0, logger);

  // Validate merged config as final (requires source and destination)
  const config = parseFinalConfig(mergedConfig, configPath);

  // Log successfully loaded config (suppress in quiet mode)
  if (!quiet)
    console.log(
      `\nConfiguration loaded: ${config.source} -> ${config.destination}` + (config.prune ? ' [prune!]' : '')
    );

  return config;
};
