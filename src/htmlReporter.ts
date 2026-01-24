import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { html as diff2html } from 'diff2html';

import { Config } from './configFile';
import { ChangedFile, FileDiffResult } from './fileDiff';
import { openInBrowser } from './reporters/browserLauncher';
import { generateHtmlTemplate, ReportMetadata } from './reporters/htmlTemplate';
import { generateUnifiedDiff } from './utils/diffGenerator';
import { createErrorClass, createErrorTypeGuard } from './utils/errors';
import { isYamlFile } from './utils/fileType';
import { serializeForDiff } from './utils/serialization';
import { computeLineToJsonPath, serializeLineMapping } from './utils/yamlLineMapping';

// Re-export types for backward compatibility
export type { ReportMetadata } from './reporters/htmlTemplate';

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

const generateFileSummary = (file: ChangedFile): string => {
  if (!file.originalPath) return file.path;

  return `<span class="filename-transform">${file.originalPath} → ${file.path}</span>`;
};

const generateChangedFileSection = (file: ChangedFile, fileId: string): string => {
  const isYaml = isYamlFile(file.path);
  const summary = generateFileSummary(file);
  const destinationContent = serializeForDiff(file.processedDestContent, isYaml);
  const sourceContent = serializeForDiff(file.processedSourceContent, isYaml);
  const unifiedDiff = generateUnifiedDiff(file.path, destinationContent, sourceContent);
  const diffHtml = generateDiffHtml(unifiedDiff);

  // Compute line-to-path mappings for selection mode
  let metadataJson = '';
  if (isYaml) {
    const destinationLineMap = computeLineToJsonPath(destinationContent);
    const metadata = {
      path: file.path,
      lineToPath: serializeLineMapping(destinationLineMap),
      parsedDest: file.rawParsedDest
    };
    metadataJson = `
      <script type="application/json" class="hed-file-metadata">
        ${JSON.stringify(metadata)}
      </script>
    `;
  }

  return `
    <details class="file-section" id="${fileId}" data-file-id="${fileId}" open>
      <summary>${summary}</summary>
      <div class="diff-container">
        ${diffHtml}
      </div>
      ${metadataJson}
    </details>
  `;
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
  logger?: import('./logger').Logger
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

  // Generate file sections with IDs
  const changedSections = diffResult.changedFiles.map((file, index) =>
    generateChangedFileSection(file, `file-${index}`)
  );

  // Generate complete HTML
  const htmlContent = generateHtmlTemplate(
    diffResult,
    formattedFiles,
    trulyUnchangedFiles,
    metadata,
    changedSections,
    changedFileIds
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
