import chalk from 'chalk';
import YAML from 'yaml';

import { Config } from './configFile';
import { ChangedFile, FileDiffResult, getSkipPathsForFile } from './fileDiff';
import { ArrayChange, detectArrayChanges } from './utils/arrayDiffProcessor';
import { generateUnifiedDiff } from './utils/diffGenerator';
import { isYamlFile } from './utils/fileType';
import { serializeForDiff } from './utils/serialization';

// ============================================================================
// Helper Functions
// ============================================================================

const colorizeUnifiedDiff = (diff: string): string => {
  return diff
    .split('\n')
    .map((line) => {
      if (line.startsWith('+') && !line.startsWith('+++')) return chalk.green(line);
      if (line.startsWith('-') && !line.startsWith('---')) return chalk.red(line);
      if (line.startsWith('@@')) return chalk.cyan(line);
      return chalk.gray(line);
    })
    .join('\n');
};

const formatAddedFiles = (files: string[]): string => {
  if (files.length === 0) return '';

  const header = chalk.green.bold(`\nAdded Files (${files.length}):`);
  const fileList = files.map((file) => chalk.green(`  + ${file}`)).join('\n');

  return `${header}\n${fileList}\n`;
};

const formatDeletedFiles = (files: string[]): string => {
  if (files.length === 0) return '';

  const header = chalk.red.bold(`\nDeleted Files (${files.length}):`);
  const fileList = files.map((file) => chalk.red(`  - ${file}`)).join('\n');

  return `${header}\n${fileList}\n`;
};

const formatArrayDiff = (change: ArrayChange): string => {
  let output = '';

  if (change.removed.length > 0) {
    output += chalk.red.bold(`\n  Removed (${change.removed.length}):\n`);
    for (const item of change.removed) {
      const yaml = YAML.stringify(item, { indent: 4 });
      const lines = yaml.split('\n').filter((l) => l.trim());
      output += lines.map((l) => chalk.red(`    - ${l}`)).join('\n');
      output += '\n';
    }
  }

  if (change.added.length > 0) {
    output += chalk.green.bold(`\n  Added (${change.added.length}):\n`);
    for (const item of change.added) {
      const yaml = YAML.stringify(item, { indent: 4 });
      const lines = yaml.split('\n').filter((l) => l.trim());
      output += lines.map((l) => chalk.green(`    + ${l}`)).join('\n');
      output += '\n';
    }
  }

  if (change.unchanged.length > 0) output += chalk.gray(`\n  Unchanged: ${change.unchanged.length} items\n`);

  return output;
};

const formatChangedFile = (file: ChangedFile, config: Config): string => {
  const isYaml = isYamlFile(file.path);
  const separator = chalk.yellow('━'.repeat(60));
  const skipPaths = getSkipPathsForFile(file.path, config.skipPath);
  const skipPathInfo =
    skipPaths.length > 0
      ? chalk.dim(`SkipPath patterns applied: ${skipPaths.join(', ')}`)
      : chalk.dim('No skipPath patterns applied');

  if (!isYaml) {
    const destinationContent = String(file.processedDestContent);
    const sourceContent = String(file.processedSourceContent);
    const unifiedDiff = generateUnifiedDiff(file.path, destinationContent, sourceContent);
    const colorizedDiff = colorizeUnifiedDiff(unifiedDiff);

    return `
${separator}
${chalk.yellow.bold(`File: ${file.path}`)}
${skipPathInfo}

${colorizedDiff}
`;
  }

  const arrayInfo = detectArrayChanges(file);

  if (!arrayInfo.hasArrays) {
    const destinationContent = serializeForDiff(file.processedDestContent, true);
    const sourceContent = serializeForDiff(file.processedSourceContent, true);
    const unifiedDiff = generateUnifiedDiff(file.path, destinationContent, sourceContent);
    const colorizedDiff = colorizeUnifiedDiff(unifiedDiff);

    return `
${separator}
${chalk.yellow.bold(`File: ${file.path}`)}
${skipPathInfo}

${colorizedDiff}
`;
  }

  let output = `\n${separator}\n${chalk.yellow.bold(`File: ${file.path}`)}\n${skipPathInfo}\n`;

  const destinationContent = serializeForDiff(file.processedDestContent, true);
  const sourceContent = serializeForDiff(file.processedSourceContent, true);
  const unifiedDiff = generateUnifiedDiff(file.path, destinationContent, sourceContent);
  const colorizedDiff = colorizeUnifiedDiff(unifiedDiff);

  output += `\n${colorizedDiff}\n`;

  if (arrayInfo.hasChanges) {
    output += chalk.cyan.bold('\nArray-specific details:\n');

    for (const change of arrayInfo.changes) {
      const pathString = change.path.join('.');
      output += chalk.cyan(`\n  ${pathString}:\n`);
      output += formatArrayDiff(change);
    }
  }

  return output;
};

const formatChangedFiles = (files: ChangedFile[], config: Config): string => {
  if (files.length === 0) return '';

  const header = chalk.yellow.bold(`\nChanged Files (${files.length}):`);
  const fileContent = files.map((file) => formatChangedFile(file, config)).join('\n');

  return `${header}\n${fileContent}`;
};

// ============================================================================
// Summary Box
// ============================================================================

const formatSummaryBox = (diffResult: FileDiffResult, pruneEnabled: boolean): string => {
  const width = 60;
  const topBorder = chalk.cyan(`╭─ Diff Summary ${'─'.repeat(width - 14)}╮`);
  const bottomBorder = chalk.cyan(`╰${'─'.repeat(width + 1)}╯`);

  const addedLine = chalk.cyan(
    `│  ${chalk.green('✚ Added:')}     ${diffResult.addedFiles.length.toString().padEnd(width - 15)} │`
  );

  const changedLine = chalk.cyan(
    `│  ${chalk.yellow('✎ Changed:')}   ${diffResult.changedFiles.length.toString().padEnd(width - 15)} │`
  );

  const deletedText = pruneEnabled
    ? `${diffResult.deletedFiles.length} (prune enabled)`
    : `${diffResult.deletedFiles.length} (prune disabled)`;
  const deletedLine = chalk.cyan(`│  ${chalk.red('✖ Deleted:')}   ${deletedText.padEnd(width - 15)} │`);

  const unchangedLine = chalk.cyan(
    `│  ${chalk.gray('✓ Unchanged:')} ${diffResult.unchangedFiles.length.toString().padEnd(width - 15)} │`
  );

  return `${topBorder}\n${addedLine}\n${changedLine}\n${deletedLine}\n${unchangedLine}\n${bottomBorder}\n`;
};

// ============================================================================
// Public API
// ============================================================================

export const showConsoleDiff = (diffResult: FileDiffResult, config: Config): void => {
  console.log('');
  console.log(formatSummaryBox(diffResult, config.prune));

  console.log(chalk.bold('\nInclude patterns:'), config.include.join(', '));
  console.log(
    chalk.bold('Exclude patterns:'),
    config.exclude.length > 0 ? config.exclude.join(', ') : chalk.dim('(none)')
  );

  if (
    diffResult.addedFiles.length === 0 &&
    diffResult.changedFiles.length === 0 &&
    diffResult.deletedFiles.length === 0
  ) {
    console.log(chalk.green.bold('\n✓ No differences found\n'));
    return;
  }

  console.log(formatAddedFiles(diffResult.addedFiles));
  console.log(formatDeletedFiles(diffResult.deletedFiles));
  console.log(formatChangedFiles(diffResult.changedFiles, config));
};
