// ============================================================================
// HTML Styles and Scripts
// ============================================================================

/**
 * CSS styles for the HTML diff report.
 *
 * Includes GitHub-inspired styling for:
 * - Layout and typography
 * - Tabs and navigation
 * - File sections and diffs
 * - Array diff visualizations
 * - Status badges and metadata
 */
export const HTML_STYLES = `
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
    background: #f6f8fa;
    border-radius: 6px;
    border-left: 3px solid #0969da;
  }

  .array-details summary {
    padding: 12px 15px;
    cursor: pointer;
    color: #0969da;
    font-size: 13px;
    font-weight: 600;
  }

  .array-details summary:hover {
    background: #eaeef2;
  }

  .array-details > .array-section {
    margin: 0 15px 15px 15px;
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
`;

/**
 * JavaScript for tab switching functionality.
 *
 * Enables interactive navigation between different sections:
 * - Changed files
 * - Added files
 * - Deleted files
 * - Formatted files
 * - Unchanged files
 */
export const TAB_SCRIPT = `
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
`;
