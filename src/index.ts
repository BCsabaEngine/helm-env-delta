import { readFileSync } from 'node:fs';

import YAML from 'yaml';

import packageJson from '../package.json';
import { parseCommandLine } from './commandLine';
import { parseConfig } from './configFile';
import { isFileLoaderError, loadFiles } from './fileLoader';
import { isZodValidationError } from './ZodError';

/**
 * Main entry point for helm-env-delta CLI tool.
 * Orchestrates CLI argument parsing, config loading, and sync execution.
 */
const main = async (): Promise<void> => {
  // Display application header
  console.log(`${packageJson.name} v${packageJson.version}`);
  console.log(packageJson.description);
  console.log();

  // Parse command-line arguments
  const options = parseCommandLine();

  // Log parsed options (for debugging)
  console.log('CLI Options:', JSON.stringify(options, undefined, 2));

  // Load config file
  let configContent: string;
  try {
    configContent = readFileSync(options.config, 'utf8');
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      const nodeError = error as NodeJS.ErrnoException;
      switch (nodeError.code) {
        case 'ENOENT':
          console.error(`Config file not found: ${options.config}`);
          console.error('Make sure the file exists or specify a different path with --config');
          break;
        case 'EACCES':
          console.error(`Permission denied reading config file: ${options.config}`);
          break;
        case 'EISDIR':
          console.error(`Config path is a directory, not a file: ${options.config}`);
          break;
        default:
          console.error(`Failed to read config file ${options.config}: ${nodeError.message}`);
      }
    } else console.error(`Unexpected error reading config file: ${error}`);

    process.exit(1);
  }

  // Parse YAML
  let rawConfig: unknown;
  try {
    rawConfig = YAML.parse(configContent);
  } catch (error: unknown) {
    console.error(`Failed to parse YAML in ${options.config}:`);
    if (error instanceof Error) console.error(error.message);
    else console.error(String(error));
    process.exit(1);
  }

  // Validate config schema
  const config = parseConfig(rawConfig, options.config);

  // Log successfully loaded config
  console.log('\nLoaded configuration:');
  console.log(`  Source: ${config.source}`);
  console.log(`  Destination: ${config.destination}`);
  console.log(`  Prune: ${config.prune}`);
  if (config.include) console.log(`  Include patterns: ${config.include.length} pattern(s)`);
  if (config.exclude) console.log(`  Exclude patterns: ${config.exclude.length} pattern(s)`);
  if (config.stopRules) console.log(`  Stop rules: ${Object.keys(config.stopRules).length} file pattern(s)`);

  // Load source files
  console.log('\nLoading files...');
  const sourceFiles = await loadFiles({
    baseDirectory: config.source,
    include: config.include,
    exclude: config.exclude
  });

  // Load destination files
  const destinationFiles = await loadFiles({
    baseDirectory: config.destination,
    include: config.include,
    exclude: config.exclude
  });

  console.log(`✓ Loaded ${sourceFiles.size} source file(s)`);
  console.log(`✓ Loaded ${destinationFiles.size} destination file(s)`);

  // TODO: Implement remaining sync logic
  // - Apply transformations (config.transforms)
  // - Check stop rules (config.stopRules, unless options.force is true)
  // - Write to destination (config.destination, unless options.dryRun is true)
  // - Generate HTML report (if options.htmlReport is specified)
};

// Execute main function with error handling
// eslint-disable-next-line unicorn/prefer-top-level-await -- CommonJS doesn't support top-level await
(async () => {
  try {
    await main();
  } catch (error: unknown) {
    if (isZodValidationError(error)) {
      console.error(error.message);
      process.exit(1);
    }

    if (isFileLoaderError(error)) {
      console.error(error.message);
      process.exit(1);
    }

    // Unexpected system errors
    console.error('Unexpected error:', error);
    process.exit(2);
  }
})();
