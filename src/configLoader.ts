import { readFileSync } from 'node:fs';

import YAML from 'yaml';

import { Config, parseConfig } from './configFile';
import { createErrorClass, createErrorTypeGuard } from './utils/errors';

// Error Handling
const ConfigLoaderErrorClass = createErrorClass('Config Loader Error', {
  ENOENT: 'File not found',
  EACCES: 'Permission denied',
  EISDIR: 'Path is a directory, not a file'
});

export class ConfigLoaderError extends ConfigLoaderErrorClass {}
export const isConfigLoaderError = createErrorTypeGuard(ConfigLoaderError);

// Loads and validates configuration from YAML file
export const loadConfigFile = (configPath: string): Config => {
  // Load config file
  let configContent: string;
  try {
    configContent = readFileSync(configPath, 'utf8');
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      const nodeError = error as NodeJS.ErrnoException;
      throw new ConfigLoaderError('Failed to read config file', {
        code: nodeError.code,
        path: configPath,
        cause: nodeError
      });
    }
    throw new ConfigLoaderError('Failed to read config file', { path: configPath, cause: error as Error });
  }

  // Parse YAML
  let rawConfig: unknown;
  try {
    rawConfig = YAML.parse(configContent);
  } catch (error: unknown) {
    throw new ConfigLoaderError('Failed to parse YAML', {
      path: configPath,
      cause: error instanceof Error ? error : undefined
    });
  }

  // Validate config schema
  const config = parseConfig(rawConfig, configPath);

  // Log successfully loaded config
  console.log(`\nConfiguration loaded: ${config.source} -> ${config.destination}` + (config.prune ? ' [prune!]' : ''));

  return config;
};
