import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import colors from 'ansi-colors';
import * as YAML from 'yaml';

import packageJson from '../package.json';
import { parseCommandLine } from './commandLine';
import type { FinalConfig } from './config';
import {
  isConfigLoaderError,
  isConfigMergerError,
  isZodValidationError,
  loadConfigFile,
  validateConfigWarnings
} from './config';
import { formatProgressMessage } from './consoleFormatter';
import { Logger, VerbosityLevel } from './logger';
import {
  computeFileDiff,
  formatYaml,
  isFileDiffError,
  isFileLoaderError,
  isFileUpdaterError,
  loadFiles,
  updateFiles,
  validatePatternUsage,
  validateStopRules
} from './pipeline';
import {
  generateHtmlReport,
  generateJsonReport,
  isHtmlReporterError,
  isJsonReporterError,
  showConsoleDiff
} from './reporters';
import { analyzeDifferencesForSuggestions, formatSuggestionsAsYaml, isSuggestionEngineError } from './suggestionEngine';
import { detectCollisions, isCollisionDetectorError, validateNoCollisions } from './utils/collisionDetector';
import { isCommentOnlyContent } from './utils/commentOnlyDetector';
import { filterDiffResultByMode, filterFileMap, filterFileMaps, isFilterParseError } from './utils/fileFilter';
import { isFilenameTransformerError } from './utils/filenameTransformer';
import { isYamlFile } from './utils/fileType';
import { filterFileMapsByGitAuthor, getGitUser, isGitFilterError } from './utils/gitFilter';
import { checkForUpdates } from './utils/versionChecker';

/**
 * Main entry point for helm-env-delta CLI tool.
 * Orchestrates CLI argument parsing, config loading, and sync execution.
 */
const main = async (): Promise<void> => {
  // Parse command-line arguments
  const command = parseCommandLine();

  // Disable colors if --no-color flag is set
  if (command.noColor) colors.enabled = false;

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
    console.log(colors.cyan('\n👋 First time using helm-env-delta?\n'));
    console.log(colors.dim('  Tips:'));
    console.log(colors.dim('  • Always use --dry-run first to preview changes'));
    console.log(colors.dim('  • Use --diff-html to review diffs in your browser'));
    console.log(colors.dim('  • See examples: https://github.com/balazscsaba2006/helm-env-delta/tree/main/example'));
    console.log(colors.dim('  • Run with --help to see all options\n'));

    // Create marker directory and file
    mkdirSync(configDirectory, { recursive: true });
    writeFileSync(firstRunMarker, new Date().toISOString());
  }

  // Load and validate config
  const config = loadConfigFile(command.config, command.quiet, logger, { formatOnly: command.formatOnly });
  if (config.requiredVersion) configHasRequiredVersion = true;

  // Early exit for show-config mode
  if (command.showConfig) {
    console.log(colors.cyan('\n⚙️  Resolved Configuration:\n'));
    console.log(YAML.stringify(config, { indent: 2 }));
    return;
  }

  // Early exit for validation-only mode
  if (command.validate) {
    // Validation requires source folder
    if (!config.source) {
      logger.error('\nSource folder is required for validation mode.', 'critical');
      process.exit(1);
    }

    // After source check, config is FinalConfig
    const validationConfig = config as FinalConfig;

    // Phase 1: Static validation
    logger.log('\n' + formatProgressMessage('Validating configuration...', 'info'));

    const warningResult = validateConfigWarnings(validationConfig);
    let hasAnyWarnings = warningResult.hasWarnings;

    if (warningResult.hasWarnings) {
      console.warn(colors.yellow('\n⚠️  Configuration Warnings (non-fatal):\n'));
      for (const warning of warningResult.warnings) console.warn(colors.yellow(`  • ${warning}`));
    }

    // Phase 2: File-based validation
    logger.log('\n' + formatProgressMessage('Loading files for validation...', 'loading'));

    const sourceResult = await loadFiles(
      {
        baseDirectory: validationConfig.source,
        include: validationConfig.include,
        exclude: validationConfig.exclude,
        transforms: validationConfig.transforms,
        skipExclude: true
      },
      logger
    );
    let sourceFiles = sourceResult.fileMap;

    const destinationResult = await loadFiles(
      {
        baseDirectory: validationConfig.destination,
        include: validationConfig.include,
        exclude: validationConfig.exclude,
        skipExclude: true
      },
      logger
    );
    let destinationFiles = destinationResult.fileMap;

    // Apply filter if provided
    if (command.filter) {
      const filtered = filterFileMaps(sourceFiles, destinationFiles, command.filter);
      sourceFiles = filtered.sourceFiles;
      destinationFiles = filtered.destinationFiles;
    }

    // Apply --my git author filter if provided
    if (command.my) {
      const absoluteSourceDirectory = path.isAbsolute(validationConfig.source)
        ? validationConfig.source
        : path.resolve(process.cwd(), validationConfig.source);
      const author = await getGitUser();
      const filtered = await filterFileMapsByGitAuthor(
        sourceFiles,
        destinationFiles,
        absoluteSourceDirectory,
        author,
        command.myDays
      );
      sourceFiles = filtered.sourceFiles;
      destinationFiles = filtered.destinationFiles;
      logger.progress(
        `--my filter (${command.myDays} days, author: "${author}") matched ${sourceFiles.size} source, ${destinationFiles.size} destination file(s)`,
        'info'
      );
    }

    logger.progress(`Loaded ${sourceFiles.size} source, ${destinationFiles.size} destination file(s)`, 'success');

    logger.log('\n' + formatProgressMessage('Validating pattern usage...', 'info'));

    const usageResult = validatePatternUsage(validationConfig, sourceFiles, destinationFiles);
    hasAnyWarnings = hasAnyWarnings || usageResult.hasWarnings;

    if (usageResult.hasWarnings) {
      console.warn(colors.yellow('\n⚠️  Pattern Usage Warnings (non-fatal):\n'));
      for (const warning of usageResult.warnings) {
        const contextString = warning.context ? colors.dim(` (${warning.context})`) : '';
        console.warn(colors.yellow(`  • ${warning.message}${contextString}`));
        if (warning.hint) console.warn(colors.dim(`    Hint: ${warning.hint}`));
      }
    }

    // Final result
    if (hasAnyWarnings) logger.log('\n' + formatProgressMessage('Configuration has warnings but is usable', 'info'));
    else logger.log('\n' + formatProgressMessage('Configuration is valid', 'success'));

    return;
  }

  // Add verbose debug output for config
  if (logger.shouldShow('debug')) {
    logger.debug('\nConfig details:');
    if (config.source) logger.debug(`  Source: ${config.source}`);
    logger.debug(`  Destination: ${config.destination}`);
    logger.debug(`  Include patterns: ${config.include.join(', ')}`);
    logger.debug(`  Exclude patterns: ${config.exclude.join(', ')}`);
    logger.debug(`  Transforms: ${Object.keys(config.transforms || {}).length} pattern(s)`);
    logger.debug(`  Prune enabled: ${config.prune}`);
  }

  // Early exit for format-only mode (no source required)
  if (command.formatOnly) {
    if (!config.outputFormat) {
      logger.log(colors.yellow('\n⚠️  No outputFormat configured. Nothing to format.'));
      return;
    }

    logger.log('\n' + formatProgressMessage('Loading destination files...', 'loading'));
    const destinationResult = await loadFiles(
      {
        baseDirectory: config.destination,
        include: config.include,
        exclude: config.exclude
      },
      logger
    );
    let destinationFiles = destinationResult.fileMap;

    // Apply filter if provided
    if (command.filter) destinationFiles = filterFileMap(destinationFiles, command.filter);

    logger.progress(`Loaded ${destinationFiles.size} destination file(s)`, 'success');

    // Early exit for list-files mode in format-only context
    if (command.listFiles) {
      const filesList = [...destinationFiles.keys()].toSorted();
      console.log(colors.cyan('\n📋 Files to be formatted:\n'));
      console.log(colors.yellow(`Destination files: ${filesList.length}`));
      for (const file of filesList) console.log(`  ${colors.dim(file)}`);
      return;
    }

    logger.log('\n' + formatProgressMessage('Formatting files...', 'info'));

    let formattedCount = 0;
    const errors: Array<{ path: string; error: Error }> = [];

    for (const [relativePath, content] of destinationFiles) {
      if (!isYamlFile(relativePath)) continue;
      if (isCommentOnlyContent(content)) continue;

      try {
        const formatted = formatYaml(content, relativePath, config.outputFormat);

        if (formatted !== content) {
          const absolutePath = path.join(config.destination, relativePath);

          if (command.dryRun) logger.fileOp('format', relativePath, true);
          else {
            await writeFile(absolutePath, formatted, 'utf8');
            logger.fileOp('format', relativePath, false);
          }
          formattedCount++;
        }
      } catch (error) {
        errors.push({ path: relativePath, error: error as Error });
      }
    }

    if (command.dryRun) logger.log(`\n[DRY RUN] Would format ${formattedCount} file(s)`);
    else logger.log(`\n✓ Formatted ${formattedCount} file(s)`);

    if (errors.length > 0) {
      logger.error(`\n❌ Encountered ${errors.length} error(s):`, 'critical');
      for (const { path: errorPath, error } of errors) logger.error(`  ${errorPath}: ${error.message}`, 'critical');

      process.exit(1);
    }

    return;
  }

  // From here, source is required (FinalConfig) - TypeScript narrows the type
  if (!config.source) {
    logger.error('\nSource folder is required for sync operations.', 'critical');
    process.exit(1);
  }

  // After source check, config is FinalConfig
  const syncConfig = config as FinalConfig;

  // Load source + destination files
  logger.log('\n' + formatProgressMessage('Loading files...', 'loading'));
  const sourceResult = await loadFiles(
    {
      baseDirectory: syncConfig.source,
      include: syncConfig.include,
      exclude: syncConfig.exclude,
      transforms: syncConfig.transforms
    },
    logger
  );
  let sourceFiles = sourceResult.fileMap;
  const originalPaths = sourceResult.originalPaths;
  logger.progress(`Loaded ${sourceFiles.size} source file(s)`, 'success');

  // Detect filename collisions
  const collisions = detectCollisions(sourceFiles, syncConfig.transforms);
  if (collisions.length > 0) validateNoCollisions(collisions);

  if (logger.shouldShow('debug')) logger.debug('Filename collision check: passed');

  const destinationResult = await loadFiles(
    {
      baseDirectory: syncConfig.destination,
      include: syncConfig.include,
      exclude: syncConfig.exclude
    },
    logger
  );
  let destinationFiles = destinationResult.fileMap;
  logger.progress(`Loaded ${destinationFiles.size} destination file(s)`, 'success');

  // Apply filter if provided
  if (command.filter) {
    const filtered = filterFileMaps(sourceFiles, destinationFiles, command.filter);
    sourceFiles = filtered.sourceFiles;
    destinationFiles = filtered.destinationFiles;
    logger.progress(
      `Filter '${command.filter}' matched ${sourceFiles.size} source, ${destinationFiles.size} destination file(s)`,
      'info'
    );
  }

  // Apply --my git author filter if provided
  if (command.my) {
    const absoluteSourceDirectory = path.isAbsolute(syncConfig.source)
      ? syncConfig.source
      : path.resolve(process.cwd(), syncConfig.source);
    const author = await getGitUser();
    const filtered = await filterFileMapsByGitAuthor(
      sourceFiles,
      destinationFiles,
      absoluteSourceDirectory,
      author,
      command.myDays
    );
    sourceFiles = filtered.sourceFiles;
    destinationFiles = filtered.destinationFiles;
    logger.progress(
      `--my filter (${command.myDays} days, author: "${author}") matched ${sourceFiles.size} source, ${destinationFiles.size} destination file(s)`,
      'info'
    );
  }

  // Early exit for list-files mode
  if (command.listFiles) {
    const sourceFilesList = [...sourceFiles.keys()].toSorted();
    const destinationFilesList = [...destinationFiles.keys()].toSorted();

    console.log(colors.cyan('\n📋 Files to be synced:\n'));
    console.log(colors.green(`Source files: ${sourceFilesList.length}`));
    for (const file of sourceFilesList) console.log(`  ${colors.dim(file)}`);

    console.log(colors.yellow(`\nDestination files: ${destinationFilesList.length}`));
    for (const file of destinationFilesList) console.log(`  ${colors.dim(file)}`);

    return;
  }

  // Compute file differences
  logger.log('\n' + formatProgressMessage('Computing differences...', 'info'));
  const rawDiffResult = computeFileDiff(sourceFiles, destinationFiles, syncConfig, logger, originalPaths);

  // Apply mode filter
  const diffResult = filterDiffResultByMode(rawDiffResult, command.mode);

  if (logger.shouldShow('debug')) logger.debug('Diff pipeline: parse → transforms → skipPath → normalize → compare');

  // Show console diff if requested (suppress in quiet mode)
  if (command.diff && !command.quiet) showConsoleDiff(diffResult, syncConfig);
  else {
    logger.log(`  New files: ${diffResult.addedFiles.length}`);
    logger.log(`  Deleted files: ${diffResult.deletedFiles.length}`);
    logger.log(`  Changed files: ${diffResult.changedFiles.length}`);
    logger.log(`  Unchanged files: ${diffResult.unchangedFiles.length}`);
  }

  // Early exit for suggest mode
  if (command.suggest) {
    logger.log('\n' + formatProgressMessage('Analyzing differences for suggestions...', 'info'));

    try {
      const suggestions = analyzeDifferencesForSuggestions(diffResult, syncConfig, command.suggestThreshold);
      const yaml = formatSuggestionsAsYaml(suggestions);

      console.log(colors.cyan('\n💡 Suggested Configuration:\n'));
      console.log(yaml);

      if (suggestions.metadata.changedFiles === 0)
        console.log(colors.yellow('\nℹ️  No changes detected. Files are already in sync.'));
      else {
        console.log(colors.dim('\n---'));
        console.log(colors.dim('💡 Tip: Copy relevant sections to your config.yaml and test with --dry-run'));
      }

      return;
    } catch (error) {
      if (isSuggestionEngineError(error)) {
        logger.error('\nFailed to generate suggestions: ' + error.message, 'critical');
        process.exit(1);
      }
      throw error;
    }
  }

  // Validate stop rules
  const configFileDirectory = path.dirname(path.resolve(command.config));
  const validationResult = validateStopRules(diffResult, syncConfig.stopRules, configFileDirectory, logger);

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
    console.log(colors.cyan('\n📊 Sync Summary:'));
    console.log(colors.dim('─'.repeat(60)));
    console.log(`  ${colors.green('Added:')}     ${diffResult.addedFiles.length} files`);
    console.log(`  ${colors.yellow('Changed:')}   ${diffResult.changedFiles.length} files`);
    console.log(
      `  ${colors.red('Deleted:')}   ${diffResult.deletedFiles.length} files (${syncConfig.prune ? 'prune enabled' : 'prune disabled'})`
    );
    console.log(`  ${colors.blue('Unchanged:')} ${diffResult.unchangedFiles.length} files`);
    console.log(colors.dim('─'.repeat(60)));

    if (diffResult.deletedFiles.length > 0 && syncConfig.prune) {
      console.warn(colors.red('⚠️  Warning: Prune is enabled. The following files will be permanently deleted:'));
      for (const f of diffResult.deletedFiles) console.warn(colors.red(`    - ${f}`));
    }

    if (syncConfig.confirmationDelay > 0) {
      const totalSeconds = Math.ceil(syncConfig.confirmationDelay / 1000);
      console.log(colors.dim('\nPress Ctrl+C to cancel.\n'));
      for (let remaining = totalSeconds; remaining > 0; remaining--) {
        process.stdout.write(colors.dim(`  Proceeding in ${remaining}s...\r`));
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      process.stdout.write(' '.repeat(40) + '\r'); // Clear line
    } else console.log(colors.dim('\nPress Ctrl+C to cancel, or use --dry-run to preview changes first.\n'));
  }

  // Update files
  const formattedFiles = await updateFiles(
    diffResult,
    sourceFiles,
    destinationFiles,
    syncConfig,
    command.dryRun,
    command.skipFormat,
    logger
  );

  // Generate HTML report if requested (suppress in quiet mode)
  if ((command.diffHtml || command.reportOutput) && !command.quiet)
    await generateHtmlReport(
      diffResult,
      formattedFiles,
      syncConfig,
      command.dryRun,
      logger,
      command.dryRun ? validationResult : undefined,
      command.reportOutput
    );

  // Generate JSON report if requested (always outputs regardless of verbosity)
  if (command.diffJson)
    generateJsonReport(diffResult, formattedFiles, validationResult, syncConfig, command.dryRun, packageJson.version);
};

// Execute main function with error handling
let configHasRequiredVersion = false;
// eslint-disable-next-line unicorn/prefer-top-level-await -- CommonJS doesn't support top-level await
(async () => {
  try {
    await main();
  } catch (error: unknown) {
    // Errors are always critical and should be shown regardless of verbosity
    if (isConfigMergerError(error)) console.error(error.message);
    else if (isConfigLoaderError(error)) console.error(error.message);
    else if (isZodValidationError(error)) console.error(error.message);
    else if (isFileLoaderError(error)) console.error(error.message);
    else if (isFilenameTransformerError(error)) console.error(error.message);
    else if (isCollisionDetectorError(error)) console.error(error.message);
    else if (isFileDiffError(error)) console.error(error.message);
    else if (isFileUpdaterError(error)) console.error(error.message);
    else if (isHtmlReporterError(error)) console.error(error.message);
    else if (isJsonReporterError(error)) console.error(error.message);
    else if (isSuggestionEngineError(error)) console.error(error.message);
    else if (isFilterParseError(error)) console.error(error.message);
    else if (isGitFilterError(error)) console.error(error.message);
    else if (error instanceof Error) console.error('Unexpected error:', error.message);
    else console.error('Unexpected error:', error);
    process.exit(1);
  } finally {
    // Fire-and-forget version check (skip in quiet mode or when requiredVersion is set in config)
    const command = parseCommandLine();
    if (!command.quiet && !configHasRequiredVersion) void checkForUpdates(packageJson.version);
  }
})();
