import { readFileSync } from 'node:fs';

import YAML from 'yaml';

import { Config, parseConfig } from './configFile';

// Error Handling
export class ConfigLoaderError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly path?: string,
    public readonly cause?: Error
  ) {
    super(ConfigLoaderError.formatMessage(message, code, path, cause));
    this.name = 'ConfigLoaderError';
  }

  private static formatMessage = (message: string, code?: string, path?: string, cause?: Error): string => {
    let fullMessage = `Config Loader Error: ${message}`;

    if (path) fullMessage += `\n  Path: ${path}`;

    if (code) {
      const codeExplanations: Record<string, string> = {
        ENOENT: 'File not found',
        EACCES: 'Permission denied',
        EISDIR: 'Path is a directory, not a file'
      };

      const explanation = codeExplanations[code] || `System error (${code})`;
      fullMessage += `\n  Reason: ${explanation}`;
    }

    if (cause) fullMessage += `\n  Details: ${cause.message}`;

    return fullMessage;
  };
}

export const isConfigLoaderError = (error: unknown): error is ConfigLoaderError => error instanceof ConfigLoaderError;

// Loads and validates configuration from YAML file
export const loadConfigFile = (configPath: string): Config => {
  // Load config file
  let configContent: string;
  try {
    configContent = readFileSync(configPath, 'utf8');
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      const nodeError = error as NodeJS.ErrnoException;
      throw new ConfigLoaderError('Failed to read config file', nodeError.code, configPath, nodeError);
    }
    throw new ConfigLoaderError('Failed to read config file', undefined, configPath, error as Error);
  }

  // Parse YAML
  let rawConfig: unknown;
  try {
    rawConfig = YAML.parse(configContent);
  } catch (error: unknown) {
    throw new ConfigLoaderError(
      'Failed to parse YAML',
      undefined,
      configPath,
      error instanceof Error ? error : undefined
    );
  }

  // Validate config schema
  const config = parseConfig(rawConfig, configPath);

  // Log successfully loaded config
  console.log(`\nConfiguration loaded: ${config.source} -> ${config.destination}` + (config.prune ? ' [prune!]' : ''));

  return config;
};
