import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import chalk from 'chalk';
import * as YAML from 'yaml';

import packageJson from '../package.json';
import { parseCommandLine } from './commandLine';
import { loadConfigFile } from './configLoader';
import { isConfigMergerError } from './configMerger';
import { validateConfigWarnings } from './configWarnings';
import { showConsoleDiff } from './consoleDiffReporter';
import { formatProgressMessage } from './consoleFormatter';
import { computeFileDiff, isFileDiffError } from './fileDiff';
import { isFileLoaderError, loadFiles } from './fileLoader';
import { isFileUpdaterError, updateFiles } from './fileUpdater';
import { generateHtmlReport, isHtmlReporterError } from './htmlReporter';
import { generateJsonReport, isJsonReporterError } from './jsonReporter';
import { Logger, VerbosityLevel } from './logger';
import { validateStopRules } from './stopRulesValidator';
import { detectCollisions, isCollisionDetectorError, validateNoCollisions } from './utils/collisionDetector';
import { isFilenameTransformerError } from './utils/filenameTransformer';
import { checkForUpdates } from './utils/versionChecker';
import { isZodValidationError } from './ZodError';

/**
 * Main entry point for helm-env-delta CLI tool.
 * Orchestrates CLI argument parsing, config loading, and sync execution.
 */
const main = async (): Promise<void> => {
  // Parse command-line arguments
  const command = parseCommandLine();

  // Disable colors if --no-color flag is set
  if (command.noColor) chalk.level = 0;

  // Create logger based on verbosity flags
  const verbosityLevel: VerbosityLevel = command.verbose ? 'verbose' : command.quiet ? 'quiet' : 'normal';
  const logger = new Logger({ level: verbosityLevel, isDiffJson: command.diffJson });

  // Display application header
  logger.log(`Now you run ${packageJson.name} v${packageJson.version}...`);

  // Check for first-run and display tips
  const configDirectory = path.join(homedir(), '.helm-env-delta');
  const firstRunMarker = path.join(configDirectory, 'first-run');
  const isFirstRun = !existsSync(firstRunMarker);

  if (isFirstRun && !command.quiet) {
    console.log(chalk.cyan('\n👋 First time using helm-env-delta?\n'));
    console.log(chalk.dim('  Tips:'));
    console.log(chalk.dim('  • Always use --dry-run first to preview changes'));
    console.log(chalk.dim('  • Use --diff-html to review diffs in your browser'));
    console.log(chalk.dim('  • See examples: https://github.com/balazscsaba2006/helm-env-delta/tree/main/example'));
    console.log(chalk.dim('  • Run with --help to see all options\n'));

    // Create marker directory and file
    mkdirSync(configDirectory, { recursive: true });
    writeFileSync(firstRunMarker, new Date().toISOString());
  }

  // Load and validate config
  const config = loadConfigFile(command.config, command.quiet, logger);

  // Early exit for show-config mode
  if (command.showConfig) {
    console.log(chalk.cyan('\n⚙️  Resolved Configuration:\n'));
    console.log(YAML.stringify(config, { indent: 2 }));
    return;
  }

  // Early exit for validation-only mode
  if (command.validate) {
    logger.log('\n' + formatProgressMessage('Configuration is valid', 'success'));

    // Check for non-fatal warnings
    const warnings = validateConfigWarnings(config);
    if (warnings.length > 0) {
      console.warn(chalk.yellow('\n⚠️  Validation Warnings (non-fatal):\n'));
      for (const warning of warnings) console.warn(chalk.yellow(`  • ${warning}`));
    }

    return;
  }

  // Add verbose debug output for config
  if (logger.shouldShow('debug')) {
    logger.debug('\nConfig details:');
    logger.debug(`  Source: ${config.source}`);
    logger.debug(`  Destination: ${config.destination}`);
    logger.debug(`  Include patterns: ${config.include.join(', ')}`);
    logger.debug(`  Exclude patterns: ${config.exclude.join(', ')}`);
    logger.debug(`  Transforms: ${Object.keys(config.transforms || {}).length} pattern(s)`);
    logger.debug(`  Prune enabled: ${config.prune}`);
  }

  // Load source + destination files
  logger.log('\n' + formatProgressMessage('Loading files...', 'loading'));
  const sourceFiles = await loadFiles(
    {
      baseDirectory: config.source,
      include: config.include,
      exclude: config.exclude,
      transforms: config.transforms
    },
    logger
  );
  logger.progress(`Loaded ${sourceFiles.size} source file(s)`, 'success');

  // Detect filename collisions
  const collisions = detectCollisions(sourceFiles, config.transforms);
  if (collisions.length > 0) validateNoCollisions(collisions);

  if (logger.shouldShow('debug')) logger.debug('Filename collision check: passed');

  const destinationFiles = await loadFiles(
    {
      baseDirectory: config.destination,
      include: config.include,
      exclude: config.exclude
    },
    logger
  );
  logger.progress(`Loaded ${destinationFiles.size} destination file(s)`, 'success');

  // Early exit for list-files mode
  if (command.listFiles) {
    const sourceFilesList = [...sourceFiles.keys()].toSorted();
    const destinationFilesList = [...destinationFiles.keys()].toSorted();

    console.log(chalk.cyan('\n📋 Files to be synced:\n'));
    console.log(chalk.green(`Source files: ${sourceFilesList.length}`));
    for (const file of sourceFilesList) console.log(`  ${chalk.dim(file)}`);

    console.log(chalk.yellow(`\nDestination files: ${destinationFilesList.length}`));
    for (const file of destinationFilesList) console.log(`  ${chalk.dim(file)}`);

    return;
  }

  // Compute file differences
  logger.log('\n' + formatProgressMessage('Computing differences...', 'info'));
  const diffResult = computeFileDiff(sourceFiles, destinationFiles, config, logger);

  if (logger.shouldShow('debug')) logger.debug('Diff pipeline: parse → transforms → skipPath → normalize → compare');

  // Show console diff if requested (suppress in quiet mode)
  if (command.diff && !command.quiet) showConsoleDiff(diffResult, config);
  else {
    logger.log(`  New files: ${diffResult.addedFiles.length}`);
    logger.log(`  Deleted files: ${diffResult.deletedFiles.length}`);
    logger.log(`  Changed files: ${diffResult.changedFiles.length}`);
    logger.log(`  Unchanged files: ${diffResult.unchangedFiles.length}`);
  }

  // Validate stop rules
  const validationResult = validateStopRules(diffResult, config.stopRules, logger);

  if (validationResult.violations.length > 0)
    if (command.force) for (const violation of validationResult.violations) logger.stopRule(violation, 'force');
    else if (command.dryRun) for (const violation of validationResult.violations) logger.stopRule(violation, 'warning');
    else {
      for (const violation of validationResult.violations) logger.stopRule(violation, 'error');

      logger.error('\nUse --force to override stop rules or --dry-run to preview changes.', 'critical');
      process.exit(1);
    }

  // Show pre-execution summary (only in non-dry-run, non-quiet mode)
  if (!command.dryRun && !command.quiet) {
    console.log(chalk.cyan('\n📊 Sync Summary:'));
    console.log(chalk.dim('─'.repeat(60)));
    console.log(`  ${chalk.green('Added:')}     ${diffResult.addedFiles.length} files`);
    console.log(`  ${chalk.yellow('Changed:')}   ${diffResult.changedFiles.length} files`);
    console.log(
      `  ${chalk.red('Deleted:')}   ${diffResult.deletedFiles.length} files (${config.prune ? 'prune enabled' : 'prune disabled'})`
    );
    console.log(`  ${chalk.blue('Unchanged:')} ${diffResult.unchangedFiles.length} files`);
    console.log(chalk.dim('─'.repeat(60)));

    if (diffResult.deletedFiles.length > 0 && config.prune)
      console.warn(chalk.red('⚠️  Warning: Prune is enabled. Files will be permanently deleted!'));

    console.log(chalk.dim('\nPress Ctrl+C to cancel, or use --dry-run to preview changes first.\n'));

    // 2-second pause to let user cancel
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Update files
  const formattedFiles = await updateFiles(
    diffResult,
    sourceFiles,
    destinationFiles,
    config,
    command.dryRun,
    command.skipFormat,
    logger
  );

  // Generate HTML report if requested (suppress in quiet mode)
  if (command.diffHtml && !command.quiet)
    await generateHtmlReport(diffResult, formattedFiles, config, command.dryRun, logger);

  // Generate JSON report if requested (always outputs regardless of verbosity)
  if (command.diffJson)
    generateJsonReport(diffResult, formattedFiles, validationResult, config, command.dryRun, packageJson.version);
};

// Execute main function with error handling
// eslint-disable-next-line unicorn/prefer-top-level-await -- CommonJS doesn't support top-level await
(async () => {
  try {
    await main();
  } catch (error: unknown) {
    // Errors are always critical and should be shown regardless of verbosity
    if (isConfigMergerError(error)) console.error(error.message);
    else if (isZodValidationError(error)) console.error(error.message);
    else if (isFileLoaderError(error)) console.error(error.message);
    else if (isFilenameTransformerError(error)) console.error(error.message);
    else if (isCollisionDetectorError(error)) console.error(error.message);
    else if (isFileDiffError(error)) console.error(error.message);
    else if (isFileUpdaterError(error)) console.error(error.message);
    else if (isHtmlReporterError(error)) console.error(error.message);
    else if (isJsonReporterError(error)) console.error(error.message);
    else if (error instanceof Error) console.error('Unexpected error:', error.message);
    else console.error('Unexpected error:', error);
    process.exit(1);
  } finally {
    // Fire-and-forget version check (skip in quiet mode)
    const command = parseCommandLine();
    if (!command.quiet) void checkForUpdates(packageJson.version);
  }
})();
