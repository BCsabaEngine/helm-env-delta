import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { html as diff2html } from 'diff2html';

import { Config } from './configFile';
import { AddedFile, ChangedFile, FileDiffResult } from './fileDiff';
import { openInBrowser } from './reporters/browserLauncher';
import { DiffStats, generateHtmlTemplate, HtmlStopRuleViolation, ReportMetadata } from './reporters/htmlTemplate';
import { escapeHtml } from './reporters/treeRenderer';
import type { ValidationResult } from './stopRulesValidator';
import { generateUnifiedDiff } from './utils/diffGenerator';
import { createErrorClass, createErrorTypeGuard } from './utils/errors';
import { isYamlFile } from './utils/fileType';
import { serializeForDiff } from './utils/serialization';

// Re-export types for backward compatibility
export type { DiffStats, ReportMetadata } from './reporters/htmlTemplate';

// Error Handling
const HtmlReporterErrorClass = createErrorClass('HTML Reporter Error', {
  WRITE_FAILED: 'Failed to write HTML report file',
  BROWSER_OPEN_FAILED: 'Failed to open report in browser',
  DIFF_GENERATION_FAILED: 'Failed to generate diff content',
  INVALID_OUTPUT_PATH: 'Invalid output path for HTML report'
});

export class HtmlReporterError extends HtmlReporterErrorClass {}
export const isHtmlReporterError = createErrorTypeGuard(HtmlReporterError);

// Helper Functions
const generateTemporaryFilePath = (): string => {
  const randomName = randomBytes(8).toString('hex');
  const timestamp = new Date().toISOString().replaceAll(/[.:]/g, '-');
  const filename = `helm-env-delta-${timestamp}-${randomName}.html`;
  return path.join(tmpdir(), filename);
};

const DIFF2HTML_OPTIONS = {
  drawFileList: false,
  matching: 'lines',
  outputFormat: 'side-by-side'
} as const;

const generateDiffHtml = (unifiedDiff: string): string => diff2html(unifiedDiff, DIFF2HTML_OPTIONS);

const countDiffLines = (unifiedDiff: string): { added: number; removed: number } => {
  const lines = unifiedDiff.split('\n');
  let added = 0;
  let removed = 0;
  for (const line of lines)
    if (line.startsWith('+') && !line.startsWith('+++')) added++;
    else if (line.startsWith('-') && !line.startsWith('---')) removed++;

  return { added, removed };
};

const generateFileSummary = (file: ChangedFile): string => {
  if (!file.originalPath) return file.path;

  return `<span class="filename-transform">${file.originalPath} → ${file.path}</span>`;
};

const generateAddedFileSummary = (file: AddedFile): string => {
  if (!file.originalPath) return file.path;

  return `<span class="filename-transform">${file.originalPath} → ${file.path}</span>`;
};

const generateAddedFileSection = (file: AddedFile, fileId: string): string => {
  const summary = generateAddedFileSummary(file);
  const escapedContent = escapeHtml(file.processedContent);
  const filename = file.path.split('/').pop() || file.path;

  return `
    <details class="file-section" id="${fileId}" data-file-id="${fileId}" open>
      <summary>${summary}</summary>
      <div class="content-container">
        <div class="content-actions">
          <button class="copy-btn" data-file-id="${fileId}" title="Copy to clipboard">📋 Copy</button>
          <button class="download-btn" data-file-id="${fileId}" data-filename="${escapeHtml(filename)}" title="Download file">⬇ Download</button>
        </div>
        <pre class="file-content"><code>${escapedContent}</code></pre>
      </div>
    </details>
  `;
};

const generateChangedFileSection = (
  file: ChangedFile,
  fileId: string
): { html: string; added: number; removed: number } => {
  const isYaml = isYamlFile(file.path);
  const summary = generateFileSummary(file);
  const destinationContent = serializeForDiff(file.processedDestContent, isYaml);
  const sourceContent = serializeForDiff(file.processedSourceContent, isYaml);
  const unifiedDiff = generateUnifiedDiff(file.path, destinationContent, sourceContent);
  const diffHtml = generateDiffHtml(unifiedDiff);
  const { added, removed } = countDiffLines(unifiedDiff);
  const escapedDiff = escapeHtml(unifiedDiff);

  const html = `
    <details class="file-section" id="${fileId}" data-file-id="${fileId}" open>
      <summary>${summary}<span class="summary-badges"><span class="line-badge line-added">+${added}</span><span class="line-badge line-removed">-${removed}</span></span></summary>
      <div class="diff-toolbar">
        <button class="copy-diff-btn" data-file-id="${fileId}">Copy Diff</button>
      </div>
      <pre class="unified-diff-source" style="display:none">${escapedDiff}</pre>
      <div class="diff-container">
        ${diffHtml}
      </div>
    </details>
  `;

  return { html, added, removed };
};

// Template generation moved to reporters/htmlTemplate.ts

const writeHtmlFile = async (htmlContent: string, outputPath: string): Promise<void> => {
  try {
    // Ensure parent directory exists
    const directory = path.dirname(outputPath);
    await mkdir(directory, { recursive: true });

    // Write HTML file
    await writeFile(outputPath, htmlContent, 'utf8');
  } catch (error) {
    throw new HtmlReporterError('Failed to write HTML report file', {
      code: 'WRITE_FAILED',
      path: outputPath,
      cause: error as Error,
      hints: [
        'Check temp directory permissions',
        'Use --diff for console output instead',
        'Or --diff-json to pipe to jq'
      ]
    });
  }
};

// Browser opening logic moved to reporters/browserLauncher.ts

// Public API
export const generateHtmlReport = async (
  diffResult: FileDiffResult,
  formattedFiles: string[],
  config: Config,
  dryRun: boolean,
  logger?: import('./logger').Logger,
  validationResult?: ValidationResult
): Promise<void> => {
  // Generate random temp file path
  const reportPath = generateTemporaryFilePath();

  // Generate metadata
  const metadata: ReportMetadata = {
    timestamp: new Date().toISOString(),
    source: config.source,
    destination: config.destination,
    dryRun
  };

  // Separate truly unchanged from formatted files
  const formattedSet = new Set(formattedFiles);
  const trulyUnchangedFiles = diffResult.unchangedFiles.filter((file) => !formattedSet.has(file));

  // Generate file IDs map for sidebar navigation
  const changedFileIds = new Map<string, string>();
  for (const [index, file] of diffResult.changedFiles.entries()) changedFileIds.set(file.path, `file-${index}`);

  // Generate file sections with IDs and collect stats
  const fileStats = new Map<string, { added: number; removed: number }>();
  const changedSections = diffResult.changedFiles.map((file, index) => {
    const result = generateChangedFileSection(file, `file-${index}`);
    fileStats.set(file.path, { added: result.added, removed: result.removed });
    return result.html;
  });

  // Generate added file IDs map for sidebar navigation
  const addedFileIds = new Map<string, string>();
  for (const [index, file] of diffResult.addedFiles.entries()) addedFileIds.set(file.path, `added-file-${index}`);

  // Generate added file sections with IDs
  const addedSections = diffResult.addedFiles.map((file, index) =>
    generateAddedFileSection(file, `added-file-${index}`)
  );

  // Build diff stats for dashboard
  let totalAdded = 0;
  let totalRemoved = 0;
  const statsArray: DiffStats['fileStats'] = [];
  for (const [filePath, stats] of fileStats) {
    totalAdded += stats.added;
    totalRemoved += stats.removed;
    statsArray.push({ path: filePath, added: stats.added, removed: stats.removed });
  }
  statsArray.sort((a, b) => b.added + b.removed - (a.added + a.removed));
  const diffStats: DiffStats = { totalAdded, totalRemoved, fileStats: statsArray };

  // Map stop rule violations for HTML display
  const stopRuleViolations: HtmlStopRuleViolation[] | undefined =
    validationResult && validationResult.violations.length > 0
      ? validationResult.violations.map((violation) => ({
          file: violation.file,
          rule: { type: violation.rule.type, path: violation.rule.path },
          path: violation.path,
          oldValue: violation.oldValue,
          updatedValue: violation.updatedValue,
          message: violation.message
        }))
      : undefined;

  // Generate complete HTML
  const htmlContent = generateHtmlTemplate(
    diffResult,
    formattedFiles,
    trulyUnchangedFiles,
    metadata,
    changedSections,
    changedFileIds,
    addedSections,
    addedFileIds,
    diffStats,
    stopRuleViolations
  );

  // Write HTML file
  await writeHtmlFile(htmlContent, reportPath);
  logger?.log(`✓ HTML report generated: ${reportPath}, opening in browser...`);

  // Open in browser
  try {
    await openInBrowser(reportPath);
  } catch {
    const absolutePath = path.resolve(reportPath);
    logger?.log('⚠ Could not open browser automatically. Please open manually:');
    logger?.log(`  file://${absolutePath}`);
  }
};
