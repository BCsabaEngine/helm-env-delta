import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { html as diff2html } from 'diff2html';
import YAML from 'yaml';

import { diffArrays, findArrayPaths, hasArrays } from './arrayDiffer';
import { Config } from './configFile';
import { ChangedFile, FileDiffResult } from './fileDiff';
import { deepEqual } from './utils/deepEqual';
import { generateUnifiedDiff } from './utils/diffGenerator';
import { createErrorClass, createErrorTypeGuard } from './utils/errors';
import { isYamlFile } from './utils/fileType';
import { getValueAtPath } from './utils/jsonPath';
import { normalizeForComparison, serializeForDiff } from './utils/serialization';

// Types
export interface ReportMetadata {
  timestamp: string;
  source: string;
  destination: string;
  dryRun: boolean;
}

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

const escapeHtml = (text: string): string => {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};

const generateArrayDiffHtml = (sourceArray: unknown[], destinationArray: unknown[]): string => {
  const diff = diffArrays(sourceArray, destinationArray);

  let html = '<div class="array-diff">';

  if (diff.removed.length > 0) {
    html += '<div class="removed-items">';
    html += `<h4>Removed (${diff.removed.length})</h4>`;
    html += '<ul>';
    for (const item of diff.removed) {
      const yaml = YAML.stringify(item, { indent: 2 });
      html += `<li class="removed"><pre>${escapeHtml(yaml)}</pre></li>`;
    }
    html += '</ul></div>';
  }

  if (diff.added.length > 0) {
    html += '<div class="added-items">';
    html += `<h4>Added (${diff.added.length})</h4>`;
    html += '<ul>';
    for (const item of diff.added) {
      const yaml = YAML.stringify(item, { indent: 2 });
      html += `<li class="added"><pre>${escapeHtml(yaml)}</pre></li>`;
    }
    html += '</ul></div>';
  }

  if (diff.unchanged.length > 0) html += `<div class="unchanged-count">Unchanged: ${diff.unchanged.length} items</div>`;

  html += '</div>';
  return html;
};

const generateChangedFileSection = (file: ChangedFile): string => {
  const isYaml = isYamlFile(file.path);

  if (!isYaml) {
    const destinationContent = serializeForDiff(file.processedDestContent, false);
    const sourceContent = serializeForDiff(file.processedSourceContent, false);
    const unifiedDiff = generateUnifiedDiff(file.path, destinationContent, sourceContent);
    const diffHtml = diff2html(unifiedDiff, {
      drawFileList: false,
      matching: 'lines',
      outputFormat: 'side-by-side'
    });

    return `
    <details class="file-section" open>
      <summary>${file.path}</summary>
      <div class="diff-container">
        ${diffHtml}
      </div>
    </details>
  `;
  }

  const hasArraysInFile = hasArrays(file.rawParsedSource) || hasArrays(file.rawParsedDest);

  if (!hasArraysInFile) {
    const destinationContent = serializeForDiff(file.processedDestContent, true);
    const sourceContent = serializeForDiff(file.processedSourceContent, true);
    const unifiedDiff = generateUnifiedDiff(file.path, destinationContent, sourceContent);
    const diffHtml = diff2html(unifiedDiff, {
      drawFileList: false,
      matching: 'lines',
      outputFormat: 'side-by-side'
    });

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
  const diffHtml = diff2html(unifiedDiff, {
    drawFileList: false,
    matching: 'lines',
    outputFormat: 'side-by-side'
  });

  const arrayPaths = findArrayPaths(file.rawParsedSource);
  const hasArrayChanges = arrayPaths.some((path) => {
    const sourceArray = getValueAtPath(file.rawParsedSource, path);
    const destinationArray = getValueAtPath(file.rawParsedDest, path);
    if (!Array.isArray(sourceArray) || !Array.isArray(destinationArray)) return false;
    return !deepEqual(normalizeForComparison(sourceArray), normalizeForComparison(destinationArray));
  });

  let arrayDiffsHtml = '';

  if (hasArrayChanges) {
    arrayDiffsHtml = '<div class="array-details"><h3>Array-specific details:</h3>';

    for (const path of arrayPaths) {
      const pathString = path.join('.');
      const sourceArray = getValueAtPath(file.rawParsedSource, path);
      const destinationArray = getValueAtPath(file.rawParsedDest, path);

      if (!Array.isArray(sourceArray)) continue;
      if (!Array.isArray(destinationArray)) continue;

      const normalizedSource = normalizeForComparison(sourceArray);
      const normalizedDestination = normalizeForComparison(destinationArray);

      if (deepEqual(normalizedSource, normalizedDestination)) continue;

      arrayDiffsHtml += `<div class="array-section"><h4>${pathString}:</h4>`;
      arrayDiffsHtml += generateArrayDiffHtml(normalizedSource as unknown[], normalizedDestination as unknown[]);
      arrayDiffsHtml += '</div>';
    }

    arrayDiffsHtml += '</div>';
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

const generateHtmlTemplate = (
  diffResult: FileDiffResult,
  formattedFiles: string[],
  trulyUnchangedFiles: string[],
  metadata: ReportMetadata,
  changedSections: string[]
): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>helm-env-delta Report - ${metadata.timestamp}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css">
  <style>
    /* Custom styles */
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f6f8fa;
    }

    header {
      background: white;
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    }

    h1 {
      margin: 0 0 10px 0;
      color: #24292e;
    }

    .metadata {
      display: flex;
      gap: 20px;
      margin: 10px 0;
      color: #586069;
      font-size: 14px;
    }

    .dry-run-badge {
      display: inline-block;
      padding: 4px 8px;
      background: #cfe2ff;
      color: #084298;
      border-radius: 4px;
      font-weight: bold;
      font-size: 12px;
    }

    .summary {
      display: flex;
      gap: 12px;
      margin: 15px 0;
    }

    .stat {
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
    }

    .stat.added { background: #d4edda; color: #155724; }
    .stat.changed { background: #fff3cd; color: #856404; }
    .stat.deleted { background: #f8d7da; color: #721c24; }
    .stat.formatted { background: #d1ecf1; color: #0c5460; }
    .stat.unchanged { background: #e2e3e5; color: #383d41; }

    .tabs {
      display: flex;
      background: white;
      border-radius: 6px 6px 0 0;
      border-bottom: 1px solid #d0d7de;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    }

    .tab {
      padding: 12px 24px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 14px;
      color: #586069;
      transition: all 0.2s;
    }

    .tab:hover {
      color: #24292e;
    }

    .tab.active {
      border-bottom: 2px solid #0969da;
      color: #0969da;
      font-weight: 600;
    }

    main {
      background: white;
      padding: 20px;
      border-radius: 0 0 6px 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    .file-section {
      margin: 12px 0;
      border: 1px solid #d0d7de;
      border-radius: 6px;
    }

    .file-section summary {
      padding: 12px 16px;
      background: #f6f8fa;
      cursor: pointer;
      font-weight: 600;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 13px;
      color: #24292e;
    }

    .file-section summary:hover {
      background: #eaeef2;
    }

    .diff-container {
      padding: 0;
    }

    /* Hide diff2html file header with rename badge */
    .d2h-file-header {
      display: none;
    }

    .file-list {
      margin: 20px 0;
    }

    .file-list ul {
      list-style: none;
      padding: 0;
      margin: 10px 0;
    }

    .file-list li {
      padding: 8px 16px;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 13px;
      color: #586069;
      border-bottom: 1px solid #f6f8fa;
    }

    .file-list li:hover {
      background: #f6f8fa;
    }

    .array-details {
      margin: 20px 0;
      padding: 15px;
      background: #f6f8fa;
      border-radius: 6px;
      border-left: 3px solid #0969da;
    }

    .array-details h3 {
      margin: 0 0 15px 0;
      color: #0969da;
      font-size: 16px;
    }

    .array-section {
      margin: 15px 0;
      padding: 10px;
      background: white;
      border-radius: 4px;
      border: 1px solid #d0d7de;
    }

    .array-section h4 {
      margin: 0 0 10px 0;
      color: #24292e;
      font-size: 14px;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
    }

    .array-unchanged {
      padding: 8px;
      color: #586069;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
    }

    .added-items, .removed-items {
      margin: 10px 0;
    }

    .added-items h4 {
      color: #1a7f37;
      margin: 0 0 8px 0;
      font-size: 13px;
    }

    .removed-items h4 {
      color: #cf222e;
      margin: 0 0 8px 0;
      font-size: 13px;
    }

    .added-items ul, .removed-items ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .added-items li {
      padding: 6px 10px;
      background: #dafbe1;
      border-left: 3px solid #1a7f37;
      margin: 4px 0;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
    }

    .removed-items li {
      padding: 6px 10px;
      background: #ffebe9;
      border-left: 3px solid #cf222e;
      margin: 4px 0;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
    }

    .added-items pre, .removed-items pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .unchanged-count {
      padding: 8px 10px;
      color: #586069;
      font-size: 12px;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      background: #f6f8fa;
      border-radius: 4px;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <header>
    <h1>helm-env-delta Diff Report</h1>
    <div class="metadata">
      <span>📅 Generated: ${metadata.timestamp}</span>
      <span>📂 Source: ${metadata.source}</span>
      <span>🎯 Destination: ${metadata.destination}</span>
      ${metadata.dryRun ? '<span class="dry-run-badge">DRY RUN - No Files Modified</span>' : ''}
    </div>
    <div class="summary">
      <span class="stat added">${diffResult.addedFiles.length} Added</span>
      <span class="stat changed">${diffResult.changedFiles.length} Changed</span>
      <span class="stat deleted">${diffResult.deletedFiles.length} Deleted</span>
      <span class="stat formatted">${formattedFiles.length} Formatted</span>
      <span class="stat unchanged">${trulyUnchangedFiles.length} Unchanged</span>
    </div>
  </header>

  <nav class="tabs">
    <button class="tab active" data-tab="changed">Changed (${diffResult.changedFiles.length})</button>
    <button class="tab" data-tab="added">Added (${diffResult.addedFiles.length})</button>
    <button class="tab" data-tab="deleted">Deleted (${diffResult.deletedFiles.length})</button>
    <button class="tab" data-tab="formatted">Formatted (${formattedFiles.length})</button>
    <button class="tab" data-tab="unchanged">Unchanged (${trulyUnchangedFiles.length})</button>
  </nav>

  <main>
    <section id="changed" class="tab-content active">
      ${changedSections.join('\n')}
      ${changedSections.length === 0 ? '<p style="color: #586069; text-align: center; padding: 40px;">No changed files</p>' : ''}
    </section>

    <section id="added" class="tab-content">
      ${
        diffResult.addedFiles.length > 0
          ? `
        <div class="file-list">
          <ul>
            ${diffResult.addedFiles.map((file) => `<li>${file}</li>`).join('\n')}
          </ul>
        </div>
      `
          : '<p style="color: #586069; text-align: center; padding: 40px;">No added files</p>'
      }
    </section>

    <section id="deleted" class="tab-content">
      ${
        diffResult.deletedFiles.length > 0
          ? `
        <div class="file-list">
          <ul>
            ${diffResult.deletedFiles.map((file) => `<li>${file}</li>`).join('\n')}
          </ul>
        </div>
      `
          : '<p style="color: #586069; text-align: center; padding: 40px;">No deleted files</p>'
      }
    </section>

    <section id="formatted" class="tab-content">
      ${
        formattedFiles.length > 0
          ? `
        <div class="file-list">
          <ul>
            ${formattedFiles.map((file) => `<li>${file}</li>`).join('\n')}
          </ul>
        </div>
      `
          : '<p style="color: #586069; text-align: center; padding: 40px;">No files with only formatting changes</p>'
      }
    </section>

    <section id="unchanged" class="tab-content">
      ${
        trulyUnchangedFiles.length > 0
          ? `
        <div class="file-list">
          <ul>
            ${trulyUnchangedFiles.map((file) => `<li>${file}</li>`).join('\n')}
          </ul>
        </div>
      `
          : '<p style="color: #586069; text-align: center; padding: 40px;">No unchanged files</p>'
      }
    </section>
  </main>

  <script>
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');

        // Update tabs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
      });
    });
  </script>
</body>
</html>
  `;
};

const writeHtmlFile = async (htmlContent: string, outputPath: string): Promise<void> => {
  try {
    // Ensure parent directory exists
    const directory = path.dirname(outputPath);
    await mkdir(directory, { recursive: true });

    // Write HTML file
    await writeFile(outputPath, htmlContent, 'utf8');
  } catch (error) {
    const writeError = new HtmlReporterError('Failed to write HTML report file', {
      code: 'WRITE_FAILED',
      path: outputPath,
      cause: error as Error
    });

    writeError.message += '\n\n  Hint: Cannot write HTML report:';
    writeError.message += '\n    - Check temp directory permissions';
    writeError.message += '\n    - Use --diff for console output instead';
    writeError.message += '\n    - Or --diff-json to pipe to jq';

    throw writeError;
  }
};

const openInBrowser = async (filePath: string): Promise<void> => {
  try {
    const openModule = await import('open');
    const open = openModule.default;
    const absolutePath = path.resolve(filePath);
    await open(absolutePath);
  } catch (error) {
    const openError = new HtmlReporterError('Failed to open report in browser', {
      code: 'BROWSER_OPEN_FAILED',
      path: filePath,
      cause: error as Error
    });

    const absolutePath = path.resolve(filePath);
    openError.message += '\n\n  Hint: Open the report manually:';
    openError.message += `\n    - File location: ${absolutePath}`;
    openError.message += `\n    - macOS: open ${absolutePath}`;
    openError.message += `\n    - Linux: xdg-open ${absolutePath}`;

    throw openError;
  }
};

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
