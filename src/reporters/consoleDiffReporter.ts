import colors from 'ansi-colors';

import { Config } from '../config';
import { AddedFile, ChangedFile, FileDiffResult, getSkipPathsForFile } from '../pipeline';
import { generateUnifiedDiff } from '../utils/diffGenerator';
import { isYamlFile } from '../utils/fileType';
import { serializeForDiff } from '../utils/serialization';

// ============================================================================
// Helper Functions
// ============================================================================

const colorizeUnifiedDiff = (diff: string): string => {
  return diff
    .split('\n')
    .map((line) => {
      if (line.startsWith('+') && !line.startsWith('+++')) return colors.green(line);
      if (line.startsWith('-') && !line.startsWith('---')) return colors.red(line);
      if (line.startsWith('@@')) return colors.cyan(line);
      return colors.gray(line);
    })
    .join('\n');
};

const formatAddedFiles = (files: AddedFile[]): string => {
  if (files.length === 0) return '';

  const header = colors.green.bold(`\nAdded Files (${files.length}):`);
  const fileList = files.map((file) => colors.green(`  + ${file.path}`)).join('\n');

  return `${header}\n${fileList}\n`;
};

const formatDeletedFiles = (files: string[]): string => {
  if (files.length === 0) return '';

  const header = colors.red.bold(`\nDeleted Files (${files.length}):`);
  const fileList = files.map((file) => colors.red(`  - ${file}`)).join('\n');

  return `${header}\n${fileList}\n`;
};

const formatChangedFile = (file: ChangedFile, config: Config): string => {
  const isYaml = isYamlFile(file.path);
  const separator = colors.yellow('━'.repeat(60));
  const skipPaths = getSkipPathsForFile(file.path, config.skipPath);
  const skipPathInfo =
    skipPaths.length > 0
      ? colors.dim(`SkipPath patterns applied: ${skipPaths.join(', ')}`)
      : colors.dim('No skipPath patterns applied');

  const destinationContent = isYaml
    ? serializeForDiff(file.processedDestContent, true)
    : String(file.processedDestContent);
  const sourceContent = isYaml
    ? serializeForDiff(file.processedSourceContent, true)
    : String(file.processedSourceContent);
  const unifiedDiff = generateUnifiedDiff(file.path, destinationContent, sourceContent);
  const colorizedDiff = colorizeUnifiedDiff(unifiedDiff);

  return `
${separator}
${colors.yellow.bold(`File: ${file.path}`)}
${skipPathInfo}

${colorizedDiff}
`;
};

const formatChangedFiles = (files: ChangedFile[], config: Config): string => {
  if (files.length === 0) return '';

  const header = colors.yellow.bold(`\nChanged Files (${files.length}):`);
  const fileContent = files.map((file) => formatChangedFile(file, config)).join('\n');

  return `${header}\n${fileContent}`;
};

// ============================================================================
// Summary Box
// ============================================================================

const formatSummaryBox = (diffResult: FileDiffResult, pruneEnabled: boolean): string => {
  const width = 60;
  const topBorder = colors.cyan(`╭─ Diff Summary ${'─'.repeat(width - 14)}╮`);
  const bottomBorder = colors.cyan(`╰${'─'.repeat(width + 1)}╯`);

  const addedLine = colors.cyan(
    `│  ${colors.green('✚ Added:')}     ${diffResult.addedFiles.length.toString().padEnd(width - 15)} │`
  );

  const changedLine = colors.cyan(
    `│  ${colors.yellow('✎ Changed:')}   ${diffResult.changedFiles.length.toString().padEnd(width - 15)} │`
  );

  const deletedText = pruneEnabled
    ? `${diffResult.deletedFiles.length} (prune enabled)`
    : `${diffResult.deletedFiles.length} (prune disabled)`;
  const deletedLine = colors.cyan(`│  ${colors.red('✖ Deleted:')}   ${deletedText.padEnd(width - 15)} │`);

  const unchangedLine = colors.cyan(
    `│  ${colors.gray('✓ Unchanged:')} ${diffResult.unchangedFiles.length.toString().padEnd(width - 15)} │`
  );

  return `${topBorder}\n${addedLine}\n${changedLine}\n${deletedLine}\n${unchangedLine}\n${bottomBorder}\n`;
};

// ============================================================================
// Public API
// ============================================================================

export const showConsoleDiff = (diffResult: FileDiffResult, config: Config): void => {
  console.log('');
  console.log(formatSummaryBox(diffResult, config.prune));

  console.log(colors.bold('\nInclude patterns:'), config.include.join(', '));
  console.log(
    colors.bold('Exclude patterns:'),
    config.exclude.length > 0 ? config.exclude.join(', ') : colors.dim('(none)')
  );

  if (
    diffResult.addedFiles.length === 0 &&
    diffResult.changedFiles.length === 0 &&
    diffResult.deletedFiles.length === 0
  ) {
    const totalCompared = diffResult.unchangedFiles.length;
    const hasSkipPath = config.skipPath && Object.keys(config.skipPath).length > 0;
    const skipNote = hasSkipPath ? colors.dim(' (some paths may be excluded via skipPath)') : '';

    if (totalCompared === 0) console.log(colors.yellow.bold('\n⚠ No files matched the include/exclude patterns\n'));
    else
      console.log(
        colors.green.bold(`\n✓ No differences found`) +
          colors.dim(` — ${totalCompared} file(s) compared, all identical`) +
          skipNote +
          '\n'
      );
    return;
  }

  console.log(formatAddedFiles(diffResult.addedFiles));
  console.log(formatDeletedFiles(diffResult.deletedFiles));
  console.log(formatChangedFiles(diffResult.changedFiles, config));
};
