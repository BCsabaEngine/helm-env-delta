import packageJson from '../package.json';
import { parseCommandLine } from './commandLine';
import { isConfigLoaderError, loadConfigFile } from './configLoader';
import { showConsoleDiff } from './consoleDiffReporter';
import { formatProgressMessage, formatStopRuleViolation } from './consoleFormatter';
import { computeFileDiff, isFileDiffError } from './fileDiff';
import { isFileLoaderError, loadFiles } from './fileLoader';
import { isFileUpdaterError, updateFiles } from './fileUpdater';
import { generateHtmlReport, isHtmlReporterError } from './htmlReporter';
import { validateStopRules } from './stopRulesValidator';
import { isZodValidationError } from './ZodError';

/**
 * Main entry point for helm-env-delta CLI tool.
 * Orchestrates CLI argument parsing, config loading, and sync execution.
 */
const main = async (): Promise<void> => {
  // Display application header
  console.log(`Now you run ${packageJson.name} v${packageJson.version}...`);

  // Parse command-line arguments
  const options = parseCommandLine();

  // Load and validate config
  const config = loadConfigFile(options.config);

  // Load source + destination files
  console.log('\n' + formatProgressMessage('Loading files...', 'loading'));
  const sourceFiles = await loadFiles({
    baseDirectory: config.source,
    include: config.include,
    exclude: config.exclude
  });
  console.log(formatProgressMessage(`Loaded ${sourceFiles.size} source file(s)`, 'success'));
  const destinationFiles = await loadFiles({
    baseDirectory: config.destination,
    include: config.include,
    exclude: config.exclude
  });
  console.log(formatProgressMessage(`Loaded ${destinationFiles.size} destination file(s)`, 'success'));

  // Compute file differences
  console.log('\n' + formatProgressMessage('Computing differences...', 'info'));
  const diffResult = computeFileDiff(sourceFiles, destinationFiles, config);

  // Show console diff if requested
  if (options.showDiff) showConsoleDiff(diffResult, config);
  else {
    console.log(`  New files: ${diffResult.addedFiles.length}`);
    console.log(`  Deleted files: ${diffResult.deletedFiles.length}`);
    console.log(`  Changed files: ${diffResult.changedFiles.length}`);
    console.log(`  Unchanged files: ${diffResult.unchangedFiles.length}`);
  }

  // TODO: Apply transformations (config.transforms)

  // Validate stop rules
  const validationResult = validateStopRules(diffResult, config.stopRules);

  if (validationResult.violations.length > 0)
    if (options.force)
      for (const violation of validationResult.violations)
        console.warn('\n' + formatStopRuleViolation(violation, 'force'));
    else if (options.dryRun)
      for (const violation of validationResult.violations)
        console.warn('\n' + formatStopRuleViolation(violation, 'warning'));
    else {
      for (const violation of validationResult.violations)
        console.error('\n' + formatStopRuleViolation(violation, 'error'));

      console.error('\nUse --force to override stop rules or --dry-run to preview changes.');
      process.exit(1);
    }

  // Update files
  const formattedFiles = await updateFiles(diffResult, sourceFiles, destinationFiles, config, options.dryRun);

  // Generate HTML report if requested
  if (options.showDiffHtml) await generateHtmlReport(diffResult, formattedFiles, config, options.dryRun);
};

// Execute main function with error handling
// eslint-disable-next-line unicorn/prefer-top-level-await -- CommonJS doesn't support top-level await
(async () => {
  try {
    await main();
  } catch (error: unknown) {
    if (isConfigLoaderError(error)) console.error(error.message);
    else if (isZodValidationError(error)) console.error(error.message);
    else if (isFileLoaderError(error)) console.error(error.message);
    else if (isFileDiffError(error)) console.error(error.message);
    else if (isFileUpdaterError(error)) console.error(error.message);
    else if (isHtmlReporterError(error)) console.error(error.message);
    else console.error('Unexpected error:', error);
    process.exit(1);
  }
})();
