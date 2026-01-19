import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { html as diff2html } from 'diff2html';
import YAML from 'yaml';

import { Config } from './configFile';
import { ChangedFile, FileDiffResult } from './fileDiff';
import { openInBrowser } from './reporters/browserLauncher';
import { generateHtmlTemplate, ReportMetadata } from './reporters/htmlTemplate';
import { ArrayChange, detectArrayChanges } from './utils/arrayDiffProcessor';
import { generateUnifiedDiff } from './utils/diffGenerator';
import { createErrorClass, createErrorTypeGuard } from './utils/errors';
import { isYamlFile } from './utils/fileType';
import { serializeForDiff } from './utils/serialization';

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

const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const DIFF2HTML_OPTIONS = {
  drawFileList: false,
  matching: 'lines',
  outputFormat: 'side-by-side'
} as const;

const generateDiffHtml = (unifiedDiff: string): string => diff2html(unifiedDiff, DIFF2HTML_OPTIONS);

const generateArrayDiffHtml = (change: ArrayChange): string => {
  let html = '<div class="array-diff">';

  if (change.removed.length > 0) {
    html += '<div class="removed-items">';
    html += `<h4>Removed (${change.removed.length})</h4>`;
    html += '<ul>';
    for (const item of change.removed) {
      const yaml = YAML.stringify(item, { indent: 2 });
      html += `<li class="removed"><pre>${escapeHtml(yaml)}</pre></li>`;
    }
    html += '</ul></div>';
  }

  if (change.added.length > 0) {
    html += '<div class="added-items">';
    html += `<h4>Added (${change.added.length})</h4>`;
    html += '<ul>';
    for (const item of change.added) {
      const yaml = YAML.stringify(item, { indent: 2 });
      html += `<li class="added"><pre>${escapeHtml(yaml)}</pre></li>`;
    }
    html += '</ul></div>';
  }

  if (change.unchanged.length > 0)
    html += `<div class="unchanged-count">Unchanged: ${change.unchanged.length} items</div>`;

  html += '</div>';
  return html;
};

const generateChangedFileSection = (file: ChangedFile): string => {
  const isYaml = isYamlFile(file.path);

  if (!isYaml) {
    const destinationContent = serializeForDiff(file.processedDestContent, false);
    const sourceContent = serializeForDiff(file.processedSourceContent, false);
    const unifiedDiff = generateUnifiedDiff(file.path, destinationContent, sourceContent);
    const diffHtml = generateDiffHtml(unifiedDiff);

    return `
    <details class="file-section" open>
      <summary>${file.path}</summary>
      <div class="diff-container">
        ${diffHtml}
      </div>
    </details>
  `;
  }

  const arrayInfo = detectArrayChanges(file);

  if (!arrayInfo.hasArrays) {
    const destinationContent = serializeForDiff(file.processedDestContent, true);
    const sourceContent = serializeForDiff(file.processedSourceContent, true);
    const unifiedDiff = generateUnifiedDiff(file.path, destinationContent, sourceContent);
    const diffHtml = generateDiffHtml(unifiedDiff);

    return `
    <details class="file-section" open>
      <summary>${file.path}</summary>
      <div class="diff-container">
        ${diffHtml}
      </div>
    </details>
  `;
  }

  const destinationContent = serializeForDiff(file.processedDestContent, true);
  const sourceContent = serializeForDiff(file.processedSourceContent, true);
  const unifiedDiff = generateUnifiedDiff(file.path, destinationContent, sourceContent);
  const diffHtml = generateDiffHtml(unifiedDiff);

  let arrayDiffsHtml = '';

  if (arrayInfo.hasChanges) {
    arrayDiffsHtml = '<details class="array-details"><summary>Array-specific details:</summary>';

    for (const change of arrayInfo.changes) {
      const pathString = change.path.join('.');
      arrayDiffsHtml += `<div class="array-section"><h4>${pathString}:</h4>`;
      arrayDiffsHtml += generateArrayDiffHtml(change);
      arrayDiffsHtml += '</div>';
    }

    arrayDiffsHtml += '</details>';
  }

  return `
    <details class="file-section" open>
      <summary>${file.path}</summary>
      <div class="diff-container">
        ${diffHtml}
        ${arrayDiffsHtml}
      </div>
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

  // Generate file sections
  const changedSections = diffResult.changedFiles.map((file) => generateChangedFileSection(file));

  // Generate complete HTML
  const htmlContent = generateHtmlTemplate(diffResult, formattedFiles, trulyUnchangedFiles, metadata, changedSections);

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
