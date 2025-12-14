import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createTwoFilesPatch } from 'diff';
import { html as diff2html } from 'diff2html';
import YAML from 'yaml';

import { Config } from './configFile';
import { ChangedFile, FileDiffResult } from './fileDiff';
import { FileMap } from './fileLoader';

// Types
export interface ReportMetadata {
  timestamp: string;
  source: string;
  destination: string;
  dryRun: boolean;
}

// Error Handling
export class HtmlReporterError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly path?: string,
    public override readonly cause?: Error
  ) {
    super(HtmlReporterError.formatMessage(message, code, path, cause));
    this.name = 'HtmlReporterError';
  }

  private static formatMessage = (message: string, code?: string, path?: string, cause?: Error): string => {
    let fullMessage = `HTML Reporter Error: ${message}`;

    if (path) fullMessage += `\n  Path: ${path}`;

    if (code) {
      const codeExplanations: Record<string, string> = {
        WRITE_FAILED: 'Failed to write HTML report file',
        BROWSER_OPEN_FAILED: 'Failed to open report in browser',
        DIFF_GENERATION_FAILED: 'Failed to generate diff content',
        INVALID_OUTPUT_PATH: 'Invalid output path for HTML report'
      };

      const explanation = codeExplanations[code] || `Error (${code})`;
      fullMessage += `\n  Reason: ${explanation}`;
    }

    if (cause) fullMessage += `\n  Details: ${cause.message}`;

    return fullMessage;
  };
}

export const isHtmlReporterError = (error: unknown): error is HtmlReporterError => error instanceof HtmlReporterError;

// Helper Functions
const serializeForDiff = (content: unknown, isYaml: boolean): string => {
  if (!isYaml) return String(content);

  // Serialize YAML objects consistently for diffing
  return YAML.stringify(content, {
    indent: 2,
    lineWidth: 0,
    sortMapEntries: true
  });
};

const generateUnifiedDiff = (filePath: string, destinationContent: string, sourceContent: string): string => {
  return createTwoFilesPatch(
    filePath, // filename
    filePath, // filename
    destinationContent,
    sourceContent,
    'Destination', // old header
    'Source' // new header
  );
};

const generateChangedFileSection = (file: ChangedFile): string => {
  const isYaml = /\.ya?ml$/i.test(file.path);

  // Serialize processed content for diff
  const destinationContent = serializeForDiff(file.processedDestContent, isYaml);
  const sourceContent = serializeForDiff(file.processedSourceContent, isYaml);

  // Generate unified diff
  const unifiedDiff = generateUnifiedDiff(file.path, destinationContent, sourceContent);

  // Convert to HTML using diff2html
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
};

const generateAddedFileSection = (relativePath: string, content: string): string => {
  const unifiedDiff = generateUnifiedDiff(
    relativePath,
    '', // Empty old content
    content
  );

  const diffHtml = diff2html(unifiedDiff, {
    drawFileList: false,
    matching: 'lines',
    outputFormat: 'side-by-side'
  });

  return `
    <details class="file-section" open>
      <summary>${relativePath}</summary>
      <div class="diff-container">
        ${diffHtml}
      </div>
    </details>
  `;
};

const generateDeletedFileSection = (relativePath: string, sourceFiles: FileMap): string => {
  const content = sourceFiles.get(relativePath) || '';

  const unifiedDiff = generateUnifiedDiff(
    relativePath,
    content,
    '' // Empty new content
  );

  const diffHtml = diff2html(unifiedDiff, {
    drawFileList: false,
    matching: 'lines',
    outputFormat: 'side-by-side'
  });

  return `
    <details class="file-section" open>
      <summary>${relativePath}</summary>
      <div class="diff-container">
        ${diffHtml}
      </div>
    </details>
  `;
};

const generateHtmlTemplate = (
  diffResult: FileDiffResult,
  metadata: ReportMetadata,
  sections: {
    changed: string[];
    added: string[];
    deleted: string[];
  }
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
      <span class="stat unchanged">${diffResult.unchangedFiles.length} Unchanged</span>
    </div>
  </header>

  <nav class="tabs">
    <button class="tab active" data-tab="changed">Changed (${diffResult.changedFiles.length})</button>
    <button class="tab" data-tab="added">Added (${diffResult.addedFiles.length})</button>
    <button class="tab" data-tab="deleted">Deleted (${diffResult.deletedFiles.length})</button>
    <button class="tab" data-tab="unchanged">Unchanged (${diffResult.unchangedFiles.length})</button>
  </nav>

  <main>
    <section id="changed" class="tab-content active">
      ${sections.changed.join('\n')}
      ${sections.changed.length === 0 ? '<p style="color: #586069; text-align: center; padding: 40px;">No changed files</p>' : ''}
    </section>

    <section id="added" class="tab-content">
      ${sections.added.join('\n')}
      ${sections.added.length === 0 ? '<p style="color: #586069; text-align: center; padding: 40px;">No added files</p>' : ''}
    </section>

    <section id="deleted" class="tab-content">
      ${sections.deleted.join('\n')}
      ${sections.deleted.length === 0 ? '<p style="color: #586069; text-align: center; padding: 40px;">No deleted files</p>' : ''}
    </section>

    <section id="unchanged" class="tab-content">
      <details class="file-list">
        <summary>Show ${diffResult.unchangedFiles.length} unchanged files</summary>
        <ul>
          ${diffResult.unchangedFiles.map((file) => `<li>${file}</li>`).join('\n')}
        </ul>
      </details>
      ${diffResult.unchangedFiles.length === 0 ? '<p style="color: #586069; text-align: center; padding: 40px;">No unchanged files</p>' : ''}
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
    throw new HtmlReporterError('Failed to write HTML report file', 'WRITE_FAILED', outputPath, error as Error);
  }
};

const openInBrowser = async (filePath: string): Promise<void> => {
  try {
    const openModule = await import('open');
    const open = openModule.default;
    const absolutePath = path.resolve(filePath);
    await open(absolutePath);
  } catch (error) {
    throw new HtmlReporterError('Failed to open report in browser', 'BROWSER_OPEN_FAILED', filePath, error as Error);
  }
};

// Public API
export const generateHtmlReport = async (
  diffResult: FileDiffResult,
  sourceFiles: FileMap,
  config: Config,
  options: { htmlReport: string; dryRun: boolean }
): Promise<void> => {
  console.log('\nGenerating HTML report...');

  // Generate metadata
  const metadata: ReportMetadata = {
    timestamp: new Date().toISOString(),
    source: config.source,
    destination: config.destination,
    dryRun: options.dryRun
  };

  // Generate file sections
  console.log(`  Processing ${diffResult.changedFiles.length} changed file(s)...`);
  const changedSections = diffResult.changedFiles.map((file) => generateChangedFileSection(file));

  console.log(`  Processing ${diffResult.addedFiles.length} added file(s)...`);
  const addedSections = diffResult.addedFiles.map((relativePath) =>
    generateAddedFileSection(relativePath, sourceFiles.get(relativePath)!)
  );

  console.log(`  Processing ${diffResult.deletedFiles.length} deleted file(s)...`);
  const deletedSections = diffResult.deletedFiles.map((relativePath) =>
    generateDeletedFileSection(relativePath, sourceFiles)
  );

  // Generate complete HTML
  const htmlContent = generateHtmlTemplate(diffResult, metadata, {
    changed: changedSections,
    added: addedSections,
    deleted: deletedSections
  });

  // Write HTML file
  console.log(`  Writing HTML to: ${options.htmlReport}`);
  await writeHtmlFile(htmlContent, options.htmlReport);
  console.log(`✓ HTML report generated: ${options.htmlReport}`);

  // Open in browser
  console.log('  Opening in browser...');
  try {
    await openInBrowser(options.htmlReport);
    console.log('✓ Report opened in default browser');
  } catch {
    const absolutePath = path.resolve(options.htmlReport);
    console.log('⚠ Could not open browser automatically. Please open manually:');
    console.log(`  file://${absolutePath}`);
  }
};
