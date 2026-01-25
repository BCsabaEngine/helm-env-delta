import { readFileSync } from 'node:fs';
import path from 'node:path';

import * as YAML from 'yaml';

import { type BaseConfig, parseBaseConfig, type TransformRules } from './configFile';
import { MAX_CONFIG_EXTENDS_DEPTH } from './constants';
import { createErrorClass, createErrorTypeGuard } from './utils/errors';

// ============================================================================
// Error Handling
// ============================================================================

const ConfigMergerErrorClass = createErrorClass(
  'Config Merger Error',
  {
    CIRCULAR_DEPENDENCY: 'Circular dependency detected in extends chain',
    MAX_DEPTH_EXCEEDED: 'Extends chain exceeds maximum depth',
    INVALID_EXTENDS_PATH: 'Extended config file not found',
    ENOENT: 'Extended config file not found',
    EACCES: 'Permission denied',
    EISDIR: 'Path is a directory'
  },
  (message, options) => {
    let fullMessage = `Config Merger Error: ${message}`;

    if (options.path) fullMessage += `\n  Path: ${options.path}`;

    if (options.code === 'CIRCULAR_DEPENDENCY' && options['chain']) fullMessage += `\n  Chain: ${options['chain']}`;

    if (options.code === 'MAX_DEPTH_EXCEEDED' && options['depth'])
      fullMessage += `\n  Current depth: ${options['depth']}`;

    if (options.code === 'INVALID_EXTENDS_PATH' && options['extends'] && options['resolved']) {
      fullMessage += `\n  Extends: ${options['extends']}`;
      fullMessage += `\n  Resolved: ${options['resolved']}`;
    }

    if (options.cause) fullMessage += `\n  Details: ${options.cause.message}`;

    return fullMessage;
  }
);

export class ConfigMergerError extends ConfigMergerErrorClass {}
export const isConfigMergerError = createErrorTypeGuard(ConfigMergerError);

// ============================================================================
// Config Merging
// ============================================================================

/**
 * Deep merge two configs with specific merge rules.
 *
 * Merge rules:
 * 1. Primitive fields: child overrides parent
 * 2. Arrays (include, exclude): concatenate [...parent, ...child]
 * 3. Per-file Records (skipPath, transforms, stopRules): merge keys, concatenate arrays
 * 4. outputFormat: shallow merge (child fields override parent fields)
 * 5. Remove 'extends' field from merged result
 */
export const mergeConfigs = (parent: BaseConfig, child: BaseConfig): BaseConfig => {
  const merged: BaseConfig = {};

  // Primitive fields - child overrides parent
  if (child.source !== undefined) merged.source = child.source;
  else if (parent.source !== undefined) merged.source = parent.source;

  if (child.destination !== undefined) merged.destination = child.destination;
  else if (parent.destination !== undefined) merged.destination = parent.destination;

  if (child.prune !== undefined) merged.prune = child.prune;
  else if (parent.prune !== undefined) merged.prune = parent.prune;

  if (child.confirmationDelay !== undefined) merged.confirmationDelay = child.confirmationDelay;
  else if (parent.confirmationDelay !== undefined) merged.confirmationDelay = parent.confirmationDelay;

  // Arrays - concatenate parent and child
  const parentInclude = parent.include ?? [];
  const childInclude = child.include ?? [];
  if (parentInclude.length > 0 || childInclude.length > 0) merged.include = [...parentInclude, ...childInclude];

  const parentExclude = parent.exclude ?? [];
  const childExclude = child.exclude ?? [];
  if (parentExclude.length > 0 || childExclude.length > 0) merged.exclude = [...parentExclude, ...childExclude];

  // outputFormat - shallow merge (child overrides parent fields)
  if (parent.outputFormat !== undefined || child.outputFormat !== undefined)
    merged.outputFormat = {
      ...parent.outputFormat,
      ...child.outputFormat
    };

  // Per-file Records - merge keys, concatenate arrays
  merged.skipPath = mergePerFileRecords(parent.skipPath, child.skipPath);
  merged.transforms = mergeTransformRecords(parent.transforms, child.transforms);
  merged.stopRules = mergePerFileRecords(parent.stopRules, child.stopRules);

  // Note: 'extends' field is intentionally NOT included in merged result

  return merged;
};

/**
 * Normalizes string | string[] | undefined to string[].
 * Helper for merging file path arrays.
 */
const normalizeToArray = (value: string | string[] | undefined): string[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

/**
 * Merges transform rules from parent and child configs.
 * Concatenates content, filename, contentFile, and filenameFile arrays.
 * Note: contentFile and filenameFile are merged into arrays even if inputs were strings.
 */
const mergeTransformRules = (parent?: TransformRules, child?: TransformRules): TransformRules => {
  const contentFile = [...normalizeToArray(parent?.contentFile), ...normalizeToArray(child?.contentFile)];
  const filenameFile = [...normalizeToArray(parent?.filenameFile), ...normalizeToArray(child?.filenameFile)];

  return {
    content: [...(parent?.content ?? []), ...(child?.content ?? [])],
    filename: [...(parent?.filename ?? []), ...(child?.filename ?? [])],
    ...(contentFile.length > 0 && { contentFile }),
    ...(filenameFile.length > 0 && { filenameFile })
  };
};

/**
 * Merges per-file transform configurations.
 * For each file pattern, merges transform rules from parent and child.
 */
const mergeTransformRecords = (
  parent: Record<string, TransformRules> | undefined,
  child: Record<string, TransformRules> | undefined
): Record<string, TransformRules> | undefined => {
  if (parent === undefined && child === undefined) return undefined;

  const merged: Record<string, TransformRules> = {};

  const allPatterns = new Set([...Object.keys(parent ?? {}), ...Object.keys(child ?? {})]);

  for (const pattern of allPatterns) {
    const parentRules = parent?.[pattern];
    const childRules = child?.[pattern];
    merged[pattern] = mergeTransformRules(parentRules, childRules);
  }

  return merged;
};

/**
 * Merges per-file record configurations (skipPath, stopRules).
 * For each file pattern, concatenates arrays from parent and child.
 */
const mergePerFileRecords = <T>(
  parent: Record<string, T[]> | undefined,
  child: Record<string, T[]> | undefined
): Record<string, T[]> | undefined => {
  if (parent === undefined && child === undefined) return undefined;

  const merged: Record<string, T[]> = {};

  // Add all parent patterns
  if (parent !== undefined) for (const [pattern, rules] of Object.entries(parent)) merged[pattern] = [...rules];

  // Add or merge child patterns
  if (child !== undefined)
    for (const [pattern, rules] of Object.entries(child))
      merged[pattern] = merged[pattern] === undefined ? [...rules] : [...merged[pattern], ...rules];

  return merged;
};

// ============================================================================
// Extends Resolution
// ============================================================================

/**
 * Recursively resolves extends chain and merges configs.
 *
 * @param configPath - Path to config file to load
 * @param visited - Set of visited paths for circular detection
 * @param depth - Current depth in extends chain
 * @param logger - Optional logger for verbose debug output
 * @returns Merged config object (before final validation)
 */
export const resolveConfigWithExtends = (
  configPath: string,
  visited: Set<string> = new Set(),
  depth: number = 0,
  logger?: import('./logger').Logger
): BaseConfig => {
  // Check depth limit
  if (depth > MAX_CONFIG_EXTENDS_DEPTH) {
    const depthError = new ConfigMergerError(`Extends chain exceeds maximum depth of ${MAX_CONFIG_EXTENDS_DEPTH}`, {
      code: 'MAX_DEPTH_EXCEEDED',
      path: configPath,
      depth
    });

    depthError.message += '\n\n  Hint: Simplify your config inheritance:';
    depthError.message += `\n    - Maximum depth is ${MAX_CONFIG_EXTENDS_DEPTH} levels`;
    depthError.message += `\n    - Current depth: ${depth}`;
    depthError.message += '\n    - Consider consolidating base configs';

    throw depthError;
  }

  // Resolve absolute path
  const absolutePath = path.resolve(configPath);

  // Check circular dependency
  if (visited.has(absolutePath)) {
    const chain = [...visited, absolutePath].map((filePath) => filePath.split('/').pop()).join(' → ');
    const circularError = new ConfigMergerError('Circular dependency detected in extends chain', {
      code: 'CIRCULAR_DEPENDENCY',
      path: absolutePath,
      chain
    });

    circularError.message += '\n\n  Hint: Break the circular reference in your extends chain:';
    circularError.message += '\n    - Review the chain shown above';
    circularError.message += '\n    - Remove one of the extends references';
    circularError.message += '\n    - Consider flattening configs into a single file';

    throw circularError;
  }

  // Add to visited set
  const visitedWithCurrent = new Set(visited);
  visitedWithCurrent.add(absolutePath);

  // Read and parse YAML
  let configContent: string;
  try {
    configContent = readFileSync(absolutePath, 'utf8');
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const readError = new ConfigMergerError(`Failed to read config file`, {
        code: (error as NodeJS.ErrnoException).code,
        path: absolutePath,
        cause: error as Error
      });

      const errorCode = (error as NodeJS.ErrnoException).code;
      if (errorCode === 'ENOENT') {
        readError.message += '\n\n  Hint: Config file not found:';
        readError.message += '\n    - Check the file path is correct (use --config path/to/config.yaml)';
        readError.message +=
          '\n    - See examples at: https://github.com/balazscsaba2006/helm-env-delta/tree/main/example';
        readError.message += '\n    - Start with the basic example: example/0-basic/config.yaml';
        readError.message += '\n    - Or create a minimal config:';
        readError.message += '\n';
        readError.message += '\n      source: ./source-dir';
        readError.message += '\n      destination: ./dest-dir';
        readError.message += '\n      skipPath:';
        readError.message += '\n        "**/*": ["$.metadata.labels"]';
      } else if (errorCode === 'EACCES') {
        readError.message += '\n\n  Hint: Permission denied:';
        readError.message += `\n    - Check file permissions: ls -la ${absolutePath}`;
        readError.message += `\n    - Fix permissions: chmod 644 ${absolutePath}`;
      }

      throw readError;
    }

    throw new ConfigMergerError('Failed to read config file', {
      path: absolutePath,
      cause: error as Error
    });
  }

  let rawConfig: unknown;
  try {
    rawConfig = YAML.parse(configContent);
  } catch (error: unknown) {
    throw new ConfigMergerError('Failed to parse YAML', {
      path: absolutePath,
      cause: error as Error
    });
  }

  // Validate as base config
  const config = parseBaseConfig(rawConfig, absolutePath);

  // Add verbose debug output
  if (logger?.shouldShow('debug')) {
    const filename = absolutePath.split('/').pop();
    logger.debug(`Loading config: ${filename} (depth: ${depth})`);
  }

  // If no extends, return config as-is
  if (config.extends === undefined) return config;

  // Resolve parent path relative to current config directory
  const configDirectory = path.dirname(absolutePath);
  const parentPath = path.resolve(configDirectory, config.extends);

  // Check if parent file exists
  try {
    readFileSync(parentPath, 'utf8');
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const extendsError = new ConfigMergerError('Extended config file not found', {
        code: 'INVALID_EXTENDS_PATH',
        path: absolutePath,
        extends: config.extends,
        resolved: parentPath,
        cause: error as Error
      });

      extendsError.message += '\n\n  Hint: Cannot find extended config file:';
      extendsError.message += '\n    - Check the extends path in your config';
      extendsError.message += `\n    - Path is resolved relative to: ${path.dirname(absolutePath)}`;
      extendsError.message += '\n    - Use paths relative to the config file location';

      throw extendsError;
    }

    throw new ConfigMergerError('Extended config file not found', {
      code: 'INVALID_EXTENDS_PATH',
      path: absolutePath,
      extends: config.extends,
      resolved: parentPath,
      cause: error as Error
    });
  }

  // Add verbose debug output for extends
  if (logger?.shouldShow('debug')) logger.debug(`  Extends: ${config.extends} → ${parentPath.split('/').pop()}`);

  // Recursively load parent
  const parentConfig = resolveConfigWithExtends(parentPath, visitedWithCurrent, depth + 1, logger);

  // Merge parent with current (current overrides parent)
  return mergeConfigs(parentConfig, config);
};
