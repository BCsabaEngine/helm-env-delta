import { AddedFile, FileDiffResult } from '../fileDiff';
import { DIFF2HTML_STYLES, HTML_STYLES, TAB_SCRIPT } from './htmlStyles';
import { buildFileTree } from './treeBuilder';
import { escapeHtml, renderSidebarTree, renderTreeview } from './treeRenderer';

const renderStatsDashboard = (diffStats: DiffStats): string => {
  const total = diffStats.totalAdded + diffStats.totalRemoved;
  if (total === 0) return '';

  const addedPercent = Math.round((diffStats.totalAdded / total) * 100);
  const removedPercent = 100 - addedPercent;

  const top10 = diffStats.fileStats.slice(0, 10);
  const topFilesHtml = top10
    .map(
      (f) =>
        `<li><span class="file-path">${escapeHtml(f.path)}</span><span class="file-stats"><span class="line-badge line-added">+${f.added}</span> <span class="line-badge line-removed">-${f.removed}</span></span></li>`
    )
    .join('');

  return `
    <div class="stats-dashboard">
      <button class="stats-toggle-btn" id="stats-toggle-btn">Show Details</button>
      <div id="stats-dashboard-content" style="display: none">
        <div class="stats-summary">
          <span class="total-added">+${diffStats.totalAdded}</span>
          <span class="total-removed">-${diffStats.totalRemoved}</span>
          <span style="color: #586069; font-size: 13px;">lines across ${diffStats.fileStats.length} file${diffStats.fileStats.length === 1 ? '' : 's'}</span>
        </div>
        <div class="stats-bar">
          <div class="stats-segment added-segment" style="width: ${addedPercent}%"></div>
          <div class="stats-segment removed-segment" style="width: ${removedPercent}%"></div>
        </div>
        ${top10.length > 0 ? `<ul class="top-changed-files">${topFilesHtml}</ul>` : ''}
      </div>
    </div>`;
};

// ============================================================================
// Types
// ============================================================================

export interface ReportMetadata {
  timestamp: string;
  source: string;
  destination: string;
  dryRun: boolean;
}

export interface DiffStats {
  totalAdded: number;
  totalRemoved: number;
  fileStats: Array<{ path: string; added: number; removed: number }>;
}

// ============================================================================
// HTML Template Generation
// ============================================================================

/**
 * Generates a complete HTML document for the diff report.
 *
 * Creates a tabbed interface with sections for:
 * - Changed files (with inline diffs)
 * - Added files (with content display, copy/download)
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
 * @param addedSections - Pre-rendered HTML sections for added files
 * @param addedFileIds - Map of added file paths to their DOM element IDs
 * @param diffStats - Aggregated diff statistics for the dashboard
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
 *   changedFileIds,
 *   addedSections,
 *   addedFileIds
 * );
 * ```
 */
export const generateHtmlTemplate = (
  diffResult: FileDiffResult,
  formattedFiles: string[],
  trulyUnchangedFiles: string[],
  metadata: ReportMetadata,
  changedSections: string[],
  changedFileIds: Map<string, string> = new Map(),
  addedSections: string[] = [],
  addedFileIds: Map<string, string> = new Map(),
  diffStats?: DiffStats
): string => {
  // Build trees for all file lists
  const changedFilePaths = diffResult.changedFiles.map((f) => f.path);
  const changedTree = buildFileTree(changedFilePaths);
  const addedFilePaths = diffResult.addedFiles.map((f: AddedFile) => f.path);
  const addedTree = buildFileTree(addedFilePaths);
  const deletedTree = buildFileTree(diffResult.deletedFiles);
  const formattedTree = buildFileTree(formattedFiles);
  const unchangedTree = buildFileTree(trulyUnchangedFiles);

  const categories = [
    { id: 'changed', label: 'Changed', count: diffResult.changedFiles.length },
    { id: 'added', label: 'Added', count: diffResult.addedFiles.length },
    { id: 'deleted', label: 'Deleted', count: diffResult.deletedFiles.length },
    { id: 'formatted', label: 'Formatted', count: formattedFiles.length },
    { id: 'unchanged', label: 'Unchanged', count: trulyUnchangedFiles.length }
  ];
  const activeCategories = categories.filter((c) => c.count > 0);
  const firstActiveTab = activeCategories[0]?.id ?? 'changed';

  const summaryBadges = activeCategories
    .map((c) => `<span class="stat ${c.id}">${c.count} ${c.label}</span>`)
    .join('\n      ');

  const tabButtons = activeCategories
    .map(
      (c) =>
        `<button class="tab${c.id === firstActiveTab ? ' active' : ''}" data-tab="${c.id}">${c.label} (${c.count})</button>`
    )
    .join('\n    ');

  const renderSection = (id: string, content: string): string => {
    const cat = categories.find((c) => c.id === id);
    if (!cat || cat.count === 0) return '';
    return `
    <section id="${id}" class="tab-content${id === firstActiveTab ? ' active' : ''}">
      ${content}
    </section>`;
  };

  const changedContent =
    changedSections.length > 0
      ? `
        <div class="sidebar-container">
          <aside class="sidebar" id="changed-sidebar">
            <div class="sidebar-header">
              <span>Changed Files</span>
              <button class="sidebar-toggle">&#9664;</button>
            </div>
            <div class="sidebar-content">
              <input type="text" class="sidebar-search" placeholder="Filter files..." />
              ${renderSidebarTree(changedTree, changedFileIds)}
            </div>
          </aside>
          <button class="sidebar-expand-btn">&#9654;</button>
          <div class="changed-content">
            <div class="content-toolbar">
              <button class="collapse-all-btn">Collapse All</button>
              <button class="expand-all-btn">Expand All</button>
            </div>
            ${changedSections.join('\n')}
          </div>
        </div>
      `
      : '<p style="color: #586069; text-align: center; padding: 40px;">No changed files</p>';

  const addedContent =
    addedSections.length > 0
      ? `
        <div class="sidebar-container">
          <aside class="sidebar" id="added-sidebar">
            <div class="sidebar-header">
              <span>Added Files</span>
              <button class="sidebar-toggle" data-sidebar="added">&#9664;</button>
            </div>
            <div class="sidebar-content">
              <input type="text" class="sidebar-search" placeholder="Filter files..." />
              ${renderSidebarTree(addedTree, addedFileIds)}
            </div>
          </aside>
          <button class="sidebar-expand-btn" data-sidebar="added">&#9654;</button>
          <div class="added-content">
            ${addedSections.join('\n')}
          </div>
        </div>
      `
      : '<p style="color: #586069; text-align: center; padding: 40px;">No added files</p>';

  const deletedContent =
    diffResult.deletedFiles.length > 0
      ? `<div class="file-list">${renderTreeview(deletedTree)}</div>`
      : '<p style="color: #586069; text-align: center; padding: 40px;">No deleted files</p>';

  const formattedContent =
    formattedFiles.length > 0
      ? `<div class="file-list">${renderTreeview(formattedTree)}</div>`
      : '<p style="color: #586069; text-align: center; padding: 40px;">No files with only formatting changes</p>';

  const unchangedContent =
    trulyUnchangedFiles.length > 0
      ? `<div class="file-list">${renderTreeview(unchangedTree)}</div>`
      : '<p style="color: #586069; text-align: center; padding: 40px;">No unchanged files</p>';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>helm-env-delta Report - ${metadata.timestamp}</title>
  <style>${DIFF2HTML_STYLES}</style>
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
      ${summaryBadges}
    </div>
    ${diffStats ? renderStatsDashboard(diffStats) : ''}
  </header>

  <nav class="tabs">
    ${tabButtons}
  </nav>

  <main>
    ${renderSection('changed', changedContent)}
    ${renderSection('added', addedContent)}
    ${renderSection('deleted', deletedContent)}
    ${renderSection('formatted', formattedContent)}
    ${renderSection('unchanged', unchangedContent)}
  </main>

  <button class="scroll-to-top" title="Scroll to top">&#9650;</button>

  <script>
${TAB_SCRIPT}
  </script>
</body>
</html>
  `;
};
