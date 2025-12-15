import packageJson from '../package.json';
import { parseCommandLine } from './commandLine';
import { isConfigLoaderError, loadConfigFile } from './configLoader';
import { showConsoleDiff } from './consoleDiffReporter';
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
  console.log('\nLoading files...');
  const sourceFiles = await loadFiles({
    baseDirectory: config.source,
    include: config.include,
    exclude: config.exclude
  });
  console.log(`✓ Loaded ${sourceFiles.size} source file(s)`);
  const destinationFiles = await loadFiles({
    baseDirectory: config.destination,
    include: config.include,
    exclude: config.exclude
  });
  console.log(`✓ Loaded ${destinationFiles.size} destination file(s)`);

  // Compute file differences
  console.log('\nComputing differences...');
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
    if (options.force) {
      console.warn('\n⚠️  WARNING: Stop rule violations detected (continuing due to --force):');
      for (const violation of validationResult.violations) {
        console.warn(`  • ${violation.file}`);
        console.warn(`    Path: ${violation.path}`);
        console.warn(`    ${violation.message}`);
        if (violation.oldValue !== undefined) console.warn(`    Old: ${violation.oldValue}`);

        console.warn(`    New: ${violation.updatedValue}`);
        console.warn('');
      }
    } else if (options.dryRun) {
      console.warn('\n⚠️  Stop rule violations detected in dry-run:');
      for (const violation of validationResult.violations) {
        console.warn(`  • ${violation.file}`);
        console.warn(`    Path: ${violation.path}`);
        console.warn(`    ${violation.message}`);
        if (violation.oldValue !== undefined) console.warn(`    Old: ${violation.oldValue}`);

        console.warn(`    New: ${violation.updatedValue}`);
        console.warn('');
      }
    } else {
      console.error('\n❌ Stop rule violations detected:');
      for (const violation of validationResult.violations) {
        console.error(`  • ${violation.file}`);
        console.error(`    Path: ${violation.path}`);
        console.error(`    ${violation.message}`);
        if (violation.oldValue !== undefined) console.error(`    Old: ${violation.oldValue}`);

        console.error(`    New: ${violation.updatedValue}`);
        console.error('');
      }
      console.error('Use --force to override stop rules or --dry-run to preview changes.');
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
