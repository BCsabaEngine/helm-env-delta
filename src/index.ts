import packageJson from '../package.json';
import { parseCommandLine } from './commandLine';
import { isConfigLoaderError, loadConfigFile } from './configLoader';
import { computeFileDiff, isFileDiffError } from './fileDiff';
import { isFileLoaderError, loadFiles } from './fileLoader';
import { isFileUpdaterError, updateFiles } from './fileUpdater';
import { generateHtmlReport, isHtmlReporterError } from './htmlReporter';
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

  console.log(`  New files: ${diffResult.addedFiles.length}`);
  console.log(`  Deleted files: ${diffResult.deletedFiles.length}`);
  console.log(`  Changed files: ${diffResult.changedFiles.length}`);
  console.log(`  Unchanged files: ${diffResult.unchangedFiles.length}`);

  // TODO: Apply transformations (config.transforms)
  // TODO: Check stop rules (config.stopRules, unless options.force is true)

  // Update files
  await updateFiles(diffResult, sourceFiles, config, options.dryRun);

  // Generate HTML report if requested
  if (options.htmlReport) await generateHtmlReport(diffResult, config, options.dryRun);
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
