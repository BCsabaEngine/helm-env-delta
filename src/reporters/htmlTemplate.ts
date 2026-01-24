import { FileDiffResult } from '../fileDiff';
import { HTML_STYLES, SELECTION_SCRIPT, TAB_SCRIPT } from './htmlStyles';
import { buildFileTree } from './treeBuilder';
import { renderSidebarTree, renderTreeview } from './treeRenderer';

// ============================================================================
// Types
// ============================================================================

export interface ReportMetadata {
  timestamp: string;
  source: string;
  destination: string;
  dryRun: boolean;
}

// ============================================================================
// HTML Template Generation
// ============================================================================

/**
 * Generates a complete HTML document for the diff report.
 *
 * Creates a tabbed interface with sections for:
 * - Changed files (with inline diffs)
 * - Added files
 * - Deleted files
 * - Formatted files
 * - Unchanged files
 *
 * @param diffResult - Result of file diffing operation
 * @param formattedFiles - Files with only formatting changes
 * @param trulyUnchangedFiles - Files with no changes at all
 * @param metadata - Report metadata (timestamp, paths, etc.)
 * @param changedSections - Pre-rendered HTML sections for changed files
 * @param changedFileIds - Map of changed file paths to their DOM element IDs
 * @returns Complete HTML document as a string
 *
 * @example
 * ```typescript
 * const metadata = {
 *   timestamp: new Date().toISOString(),
 *   source: 'source/dir',
 *   destination: 'dest/dir',
 *   dryRun: true
 * };
 *
 * const html = generateHtmlTemplate(
 *   diffResult,
 *   formattedFiles,
 *   unchangedFiles,
 *   metadata,
 *   changedSections,
 *   changedFileIds
 * );
 * ```
 */
export const generateHtmlTemplate = (
  diffResult: FileDiffResult,
  formattedFiles: string[],
  trulyUnchangedFiles: string[],
  metadata: ReportMetadata,
  changedSections: string[],
  changedFileIds: Map<string, string> = new Map()
): string => {
  // Build trees for all file lists
  const changedFilePaths = diffResult.changedFiles.map((f) => f.path);
  const changedTree = buildFileTree(changedFilePaths);
  const addedTree = buildFileTree(diffResult.addedFiles);
  const deletedTree = buildFileTree(diffResult.deletedFiles);
  const formattedTree = buildFileTree(formattedFiles);
  const unchangedTree = buildFileTree(trulyUnchangedFiles);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>helm-env-delta Report - ${metadata.timestamp}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css">
  <style>
${HTML_STYLES}
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
    <div class="hed-selection-toolbar">
      <button class="hed-selection-mode-btn" title="Enable selection mode to mark lines to keep">Enable Selection Mode</button>
      <span class="hed-selection-count"></span>
      <button class="hed-export-btn" disabled title="Export selected lines">Export Selections</button>
      <button class="hed-clear-btn" disabled title="Clear all selections">Clear</button>
    </div>
  </header>

  <!-- Export Modal -->
  <div id="hed-export-modal" class="hed-modal">
    <div class="hed-modal-overlay"></div>
    <div class="hed-modal-content">
      <div class="hed-modal-header">
        <h2>Export Selections</h2>
        <button class="hed-modal-close">&times;</button>
      </div>
      <div class="hed-export-tabs">
        <button class="hed-export-tab active" data-format="skipPath">skipPath</button>
        <button class="hed-export-tab" data-format="fixedValues">fixedValues</button>
        <button class="hed-export-tab" data-format="json">JSON (skip now)</button>
      </div>
      <div class="hed-export-description">
        <p class="hed-desc-skipPath">Add to your config to permanently skip syncing these paths.</p>
        <p class="hed-desc-fixedValues" style="display:none;">Add to your config to lock these values permanently.</p>
        <p class="hed-desc-json" style="display:none;">Save as file and use with --skip-selection for one-time skip.</p>
      </div>
      <textarea class="hed-export-output" readonly></textarea>
      <div class="hed-modal-actions">
        <button class="hed-copy-btn">Copy to Clipboard</button>
        <button class="hed-download-btn">Download</button>
      </div>
    </div>
  </div>

  <nav class="tabs">
    <button class="tab active" data-tab="changed">Changed (${diffResult.changedFiles.length})</button>
    <button class="tab" data-tab="added">Added (${diffResult.addedFiles.length})</button>
    <button class="tab" data-tab="deleted">Deleted (${diffResult.deletedFiles.length})</button>
    <button class="tab" data-tab="formatted">Formatted (${formattedFiles.length})</button>
    <button class="tab" data-tab="unchanged">Unchanged (${trulyUnchangedFiles.length})</button>
  </nav>

  <main>
    <section id="changed" class="tab-content active">
      ${
        changedSections.length > 0
          ? `
        <div class="sidebar-container">
          <aside class="sidebar" id="changed-sidebar">
            <div class="sidebar-header">
              <span>Changed Files</span>
              <button class="sidebar-toggle">&#9664;</button>
            </div>
            <div class="sidebar-content">
              ${renderSidebarTree(changedTree, changedFileIds)}
            </div>
          </aside>
          <button class="sidebar-expand-btn">&#9654;</button>
          <div class="changed-content">
            ${changedSections.join('\n')}
          </div>
        </div>
      `
          : '<p style="color: #586069; text-align: center; padding: 40px;">No changed files</p>'
      }
    </section>

    <section id="added" class="tab-content">
      ${
        diffResult.addedFiles.length > 0
          ? `
        <div class="file-list">
          ${renderTreeview(addedTree)}
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
          ${renderTreeview(deletedTree)}
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
          ${renderTreeview(formattedTree)}
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
          ${renderTreeview(unchangedTree)}
        </div>
      `
          : '<p style="color: #586069; text-align: center; padding: 40px;">No unchanged files</p>'
      }
    </section>
  </main>

  <script>
${TAB_SCRIPT}
${SELECTION_SCRIPT}
  </script>
</body>
</html>
  `;
};
