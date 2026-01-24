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
export const HTML_STYLES = String.raw`
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

  .filename-transform {
    color: #0969da;
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

  /* Treeview styles */
  .tree-root {
    list-style: none;
    padding: 0;
    margin: 10px 0;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 13px;
  }

  .tree-root ul {
    list-style: none;
    padding-left: 20px;
    margin: 0;
  }

  .tree-folder,
  .tree-file {
    padding: 4px 8px;
    border-radius: 4px;
    cursor: default;
  }

  .tree-folder:hover,
  .tree-file:hover {
    background: #f6f8fa;
  }

  .tree-toggle {
    display: inline-block;
    width: 16px;
    cursor: pointer;
    color: #586069;
    font-size: 10px;
    user-select: none;
  }

  .tree-folder.collapsed > .tree-toggle {
    transform: rotate(-90deg);
  }

  .tree-folder.collapsed > .tree-children {
    display: none;
  }

  .tree-folder-name {
    color: #0969da;
    font-weight: 500;
  }

  .tree-file-name {
    color: #586069;
    padding-left: 16px;
  }

  /* Sidebar styles */
  .sidebar-container {
    display: flex;
    gap: 0;
  }

  .sidebar {
    width: 280px;
    min-width: 280px;
    border-right: 1px solid #d0d7de;
    background: #f6f8fa;
    overflow-y: auto;
    max-height: calc(100vh - 250px);
    position: sticky;
    top: 20px;
    align-self: flex-start;
    transition: width 0.2s, min-width 0.2s, padding 0.2s, opacity 0.2s;
  }

  .sidebar.collapsed {
    width: 0;
    min-width: 0;
    padding: 0;
    overflow: hidden;
    border-right: none;
  }

  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #d0d7de;
    background: #fff;
    font-weight: 600;
    font-size: 14px;
    color: #24292e;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .sidebar-toggle {
    background: none;
    border: 1px solid #d0d7de;
    border-radius: 4px;
    cursor: pointer;
    padding: 4px 8px;
    color: #586069;
    font-size: 12px;
  }

  .sidebar-toggle:hover {
    background: #f6f8fa;
    color: #24292e;
  }

  .sidebar-content {
    padding: 8px;
  }

  .sidebar-tree .tree-file-link {
    color: #586069;
    text-decoration: none;
    padding-left: 16px;
    display: block;
  }

  .sidebar-tree .tree-file-link:hover {
    color: #0969da;
  }

  .sidebar-tree .tree-file.active .tree-file-link {
    color: #0969da;
    font-weight: 600;
  }

  .changed-content {
    flex: 1;
    min-width: 0;
    padding-left: 20px;
  }

  .sidebar-expand-btn {
    display: none;
    position: fixed;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    background: #f6f8fa;
    border: 1px solid #d0d7de;
    border-left: none;
    border-radius: 0 4px 4px 0;
    padding: 8px 4px;
    cursor: pointer;
    color: #586069;
    z-index: 100;
  }

  .sidebar-expand-btn:hover {
    background: #eaeef2;
    color: #24292e;
  }

  .sidebar.collapsed ~ .sidebar-expand-btn {
    display: block;
  }

  /* Selection toolbar styles */
  .hed-selection-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid #d0d7de;
  }

  .hed-selection-mode-btn {
    padding: 8px 16px;
    background: #f6f8fa;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    color: #24292e;
    transition: all 0.2s;
  }

  .hed-selection-mode-btn:hover {
    background: #eaeef2;
  }

  .hed-selection-mode-btn.active {
    background: #0969da;
    border-color: #0969da;
    color: white;
  }

  .hed-selection-count {
    font-size: 14px;
    color: #586069;
    padding: 4px 8px;
  }

  .hed-export-btn,
  .hed-clear-btn {
    padding: 8px 16px;
    background: #f6f8fa;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    color: #24292e;
    transition: all 0.2s;
  }

  .hed-export-btn:hover:not(:disabled),
  .hed-clear-btn:hover:not(:disabled) {
    background: #eaeef2;
  }

  .hed-export-btn:disabled,
  .hed-clear-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Selection mode cursor and highlighting */
  body.hed-selection-mode .d2h-code-line-ctn {
    cursor: pointer;
  }

  /* Highlight deletion lines (left side) on hover in selection mode */
  body.hed-selection-mode .d2h-del .d2h-code-line-ctn:hover,
  body.hed-selection-mode tr.d2h-del .d2h-code-line-ctn:hover,
  body.hed-selection-mode td.d2h-del .d2h-code-line-ctn:hover {
    background: #ffeeba !important;
  }

  .d2h-code-line-ctn.hed-selected {
    background: #fff3cd !important;
    position: relative;
  }

  .d2h-code-line-ctn.hed-selected::after {
    content: "\2713";
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    color: #856404;
    font-weight: bold;
  }

  /* Modal styles */
  .hed-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
  }

  .hed-modal.active {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hed-modal-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
  }

  .hed-modal-content {
    position: relative;
    background: white;
    border-radius: 8px;
    width: 90%;
    max-width: 700px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .hed-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #d0d7de;
  }

  .hed-modal-header h2 {
    margin: 0;
    font-size: 18px;
    color: #24292e;
  }

  .hed-modal-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #586069;
    padding: 0;
    line-height: 1;
  }

  .hed-modal-close:hover {
    color: #24292e;
  }

  .hed-export-tabs {
    display: flex;
    padding: 12px 20px 0;
    gap: 8px;
    border-bottom: 1px solid #d0d7de;
  }

  .hed-export-tab {
    padding: 10px 16px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    color: #586069;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }

  .hed-export-tab:hover {
    color: #24292e;
  }

  .hed-export-tab.active {
    color: #0969da;
    border-bottom-color: #0969da;
    font-weight: 600;
  }

  .hed-export-description {
    padding: 12px 20px;
    font-size: 13px;
    color: #586069;
    background: #f6f8fa;
  }

  .hed-export-description p {
    margin: 0;
  }

  .hed-export-output {
    flex: 1;
    margin: 0 20px;
    padding: 12px;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 13px;
    resize: none;
    min-height: 250px;
    background: #f6f8fa;
  }

  .hed-modal-actions {
    display: flex;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid #d0d7de;
  }

  .hed-copy-btn,
  .hed-download-btn {
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  }

  .hed-copy-btn {
    background: #0969da;
    border: 1px solid #0969da;
    color: white;
  }

  .hed-copy-btn:hover {
    background: #0860ca;
  }

  .hed-download-btn {
    background: #f6f8fa;
    border: 1px solid #d0d7de;
    color: #24292e;
  }

  .hed-download-btn:hover {
    background: #eaeef2;
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
export const TAB_SCRIPT = String.raw`
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

  // Tree folder toggle
  document.querySelectorAll('.tree-folder > .tree-toggle, .tree-folder > .tree-folder-name').forEach(el => {
    el.addEventListener('click', (e) => {
      const folder = e.target.closest('.tree-folder');
      if (folder) {
        folder.classList.toggle('collapsed');
      }
    });
  });

  // Sidebar toggle
  const sidebarToggle = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  const expandBtn = document.querySelector('.sidebar-expand-btn');

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      sidebarToggle.textContent = sidebar.classList.contains('collapsed') ? '\u25B6' : '\u25C0';
    });
  }

  if (expandBtn && sidebar) {
    expandBtn.addEventListener('click', () => {
      sidebar.classList.remove('collapsed');
      if (sidebarToggle) {
        sidebarToggle.textContent = '\u25C0';
      }
    });
  }

  // Sidebar file click - scroll to diff
  document.querySelectorAll('.sidebar-tree .tree-file-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const fileId = link.getAttribute('href').substring(1);
      const target = document.getElementById(fileId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Open the details if closed
        if (target.tagName === 'DETAILS' && !target.open) {
          target.open = true;
        }
        // Highlight active file in sidebar
        document.querySelectorAll('.sidebar-tree .tree-file').forEach(f => f.classList.remove('active'));
        link.closest('.tree-file').classList.add('active');
      }
    });
  });

  // IntersectionObserver to highlight current file on scroll
  const fileSections = document.querySelectorAll('.file-section[id]');
  if (fileSections.length > 0 && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const fileId = entry.target.id;
          document.querySelectorAll('.sidebar-tree .tree-file').forEach(f => {
            const link = f.querySelector('.tree-file-link');
            if (link && link.getAttribute('href') === '#' + fileId) {
              f.classList.add('active');
            } else {
              f.classList.remove('active');
            }
          });
        }
      });
    }, { threshold: 0.3, rootMargin: '-100px 0px -50% 0px' });

    fileSections.forEach(section => observer.observe(section));
  }
`;

/**
 * JavaScript for selection mode functionality.
 *
 * Enables interactive line selection in the diff view:
 * - Toggle selection mode
 * - Click lines to mark as "do not change"
 * - Export selections in various formats
 */
export const SELECTION_SCRIPT = String.raw`
  // Selection state
  const HedSelection = {
    enabled: false,
    selections: new Map(), // fileId -> Map<lineKey, { path, value }>
    currentFormat: 'skipPath'
  };

  // DOM elements
  const selectionModeBtn = document.querySelector('.hed-selection-mode-btn');
  const selectionCount = document.querySelector('.hed-selection-count');
  const exportBtn = document.querySelector('.hed-export-btn');
  const clearBtn = document.querySelector('.hed-clear-btn');
  const modal = document.getElementById('hed-export-modal');
  const modalOverlay = modal?.querySelector('.hed-modal-overlay');
  const modalClose = modal?.querySelector('.hed-modal-close');
  const exportTabs = modal?.querySelectorAll('.hed-export-tab');
  const exportOutput = modal?.querySelector('.hed-export-output');
  const copyBtn = modal?.querySelector('.hed-copy-btn');
  const downloadBtn = modal?.querySelector('.hed-download-btn');
  const descriptions = {
    skipPath: modal?.querySelector('.hed-desc-skipPath'),
    fixedValues: modal?.querySelector('.hed-desc-fixedValues'),
    json: modal?.querySelector('.hed-desc-json')
  };

  // Parse file metadata from embedded JSON
  const getFileMetadata = (fileSection) => {
    const script = fileSection.querySelector('.hed-file-metadata');
    if (!script) return null;
    try {
      return JSON.parse(script.textContent);
    } catch {
      return null;
    }
  };

  // Get line number from diff2html line element
  const getLineInfo = (lineElement, fileSection) => {
    // Find the line number from the parent row
    const row = lineElement.closest('tr');
    if (!row) return null;

    // diff2html uses different class names in different modes:
    // - d2h-code-linenumber (unified mode)
    // - d2h-code-side-linenumber (side-by-side mode)
    let lineNumCell = row.querySelector('.d2h-code-side-linenumber');
    if (!lineNumCell) lineNumCell = row.querySelector('.d2h-code-linenumber');
    if (!lineNumCell) lineNumCell = row.querySelector('[class*="linenumber"]');
    if (!lineNumCell) return null;

    const lineNumText = lineNumCell.textContent?.trim();
    const lineNum = parseInt(lineNumText, 10);
    if (isNaN(lineNum)) return null;

    // Get file metadata
    const metadata = getFileMetadata(fileSection);
    if (!metadata || !metadata.lineToPath) return null;

    // Look up path info for this line
    const pathInfo = metadata.lineToPath[lineNum];
    if (!pathInfo) return null;

    return {
      lineNum,
      filePath: metadata.path,
      jsonPath: pathInfo.path,
      value: pathInfo.value,
      lineKey: lineNum + ':' + pathInfo.path
    };
  };

  // Update selection count display
  const updateSelectionCount = () => {
    let total = 0;
    for (const fileSelections of HedSelection.selections.values()) {
      total += fileSelections.size;
    }

    if (total > 0) {
      selectionCount.textContent = total + ' line' + (total === 1 ? '' : 's') + ' selected';
      exportBtn.disabled = false;
      clearBtn.disabled = false;
    } else {
      selectionCount.textContent = '';
      exportBtn.disabled = true;
      clearBtn.disabled = true;
    }
  };

  // Toggle selection mode
  const toggleSelectionMode = () => {
    HedSelection.enabled = !HedSelection.enabled;
    document.body.classList.toggle('hed-selection-mode', HedSelection.enabled);
    selectionModeBtn.classList.toggle('active', HedSelection.enabled);
    selectionModeBtn.textContent = HedSelection.enabled ? 'Exit Selection Mode' : 'Enable Selection Mode';
  };

  // Handle line click in selection mode
  const handleLineClick = (event) => {
    if (!HedSelection.enabled) return;

    // Find the code line container
    const lineContainer = event.target.closest('.d2h-code-line-ctn');
    if (!lineContainer) return;

    // Check if this is a deletion line (left side / destination content we want to keep)
    // The d2h-del class can be on the parent row, cell, or line element
    const row = lineContainer.closest('tr');
    const isDelLine = row && (
      row.classList.contains('d2h-del') ||
      row.querySelector('td.d2h-del') ||
      lineContainer.closest('.d2h-del')
    );
    if (!isDelLine) return;

    const fileSection = lineContainer.closest('.file-section');
    if (!fileSection) return;

    const fileId = fileSection.getAttribute('data-file-id');
    const lineInfo = getLineInfo(lineContainer, fileSection);

    if (!lineInfo) return;

    // Initialize file selections map if needed
    if (!HedSelection.selections.has(fileId)) {
      HedSelection.selections.set(fileId, new Map());
    }

    const fileSelections = HedSelection.selections.get(fileId);

    // Toggle selection
    if (lineContainer.classList.contains('hed-selected')) {
      lineContainer.classList.remove('hed-selected');
      fileSelections.delete(lineInfo.lineKey);
    } else {
      lineContainer.classList.add('hed-selected');
      fileSelections.set(lineInfo.lineKey, {
        filePath: lineInfo.filePath,
        path: lineInfo.jsonPath,
        value: lineInfo.value
      });
    }

    updateSelectionCount();
    event.preventDefault();
    event.stopPropagation();
  };

  // Clear all selections
  const clearSelections = () => {
    document.querySelectorAll('.hed-selected').forEach(el => el.classList.remove('hed-selected'));
    HedSelection.selections.clear();
    updateSelectionCount();
  };

  // Generate skipPath YAML output
  const generateSkipPathYaml = () => {
    const pathsByFile = new Map();

    for (const fileSelections of HedSelection.selections.values()) {
      for (const sel of fileSelections.values()) {
        if (!pathsByFile.has(sel.filePath)) {
          pathsByFile.set(sel.filePath, new Set());
        }
        pathsByFile.get(sel.filePath).add(sel.path);
      }
    }

    if (pathsByFile.size === 0) return '# No selections';

    let yaml = 'skipPath:\n';
    for (const [filePath, paths] of pathsByFile) {
      yaml += '  ' + JSON.stringify(filePath) + ':\n';
      for (const path of paths) {
        yaml += '    - ' + JSON.stringify(path) + '\n';
      }
    }

    return yaml;
  };

  // Generate fixedValues YAML output
  const generateFixedValuesYaml = () => {
    const valuesByFile = new Map();

    for (const fileSelections of HedSelection.selections.values()) {
      for (const sel of fileSelections.values()) {
        if (!valuesByFile.has(sel.filePath)) {
          valuesByFile.set(sel.filePath, []);
        }
        valuesByFile.get(sel.filePath).push({ path: sel.path, value: sel.value });
      }
    }

    if (valuesByFile.size === 0) return '# No selections';

    let yaml = 'fixedValues:\n';
    for (const [filePath, entries] of valuesByFile) {
      yaml += '  ' + JSON.stringify(filePath) + ':\n';
      for (const entry of entries) {
        yaml += '    - path: ' + JSON.stringify(entry.path) + '\n';
        // Format value appropriately
        const val = entry.value;
        if (typeof val === 'string') {
          yaml += '      value: ' + JSON.stringify(val) + '\n';
        } else if (typeof val === 'number' || typeof val === 'boolean' || val === null) {
          yaml += '      value: ' + String(val) + '\n';
        } else {
          yaml += '      value: ' + JSON.stringify(val) + '\n';
        }
      }
    }

    return yaml;
  };

  // Generate JSON output for --skip-selection
  const generateJson = () => {
    const selections = [];

    for (const fileSelections of HedSelection.selections.values()) {
      for (const sel of fileSelections.values()) {
        selections.push({
          file: sel.filePath,
          path: sel.path,
          value: sel.value
        });
      }
    }

    return JSON.stringify({ selections }, null, 2);
  };

  // Update export output based on current format
  const updateExportOutput = () => {
    if (!exportOutput) return;

    switch (HedSelection.currentFormat) {
      case 'skipPath':
        exportOutput.value = generateSkipPathYaml();
        break;
      case 'fixedValues':
        exportOutput.value = generateFixedValuesYaml();
        break;
      case 'json':
        exportOutput.value = generateJson();
        break;
    }
  };

  // Show modal
  const showModal = () => {
    updateExportOutput();
    modal?.classList.add('active');
  };

  // Hide modal
  const hideModal = () => {
    modal?.classList.remove('active');
  };

  // Switch export tab
  const switchExportTab = (format) => {
    HedSelection.currentFormat = format;

    // Update tab active state
    exportTabs?.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.format === format);
    });

    // Update description visibility
    Object.entries(descriptions).forEach(([key, el]) => {
      if (el) el.style.display = key === format ? 'block' : 'none';
    });

    updateExportOutput();
  };

  // Copy to clipboard
  const copyToClipboard = async () => {
    if (!exportOutput) return;

    try {
      await navigator.clipboard.writeText(exportOutput.value);
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
    } catch {
      // Fallback for older browsers
      exportOutput.select();
      document.execCommand('copy');
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
    }
  };

  // Download file
  const downloadFile = () => {
    if (!exportOutput) return;

    const content = exportOutput.value;
    const format = HedSelection.currentFormat;
    const ext = format === 'json' ? 'json' : 'yaml';
    const filename = 'hed-selections.' + ext;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Event listeners
  selectionModeBtn?.addEventListener('click', toggleSelectionMode);
  clearBtn?.addEventListener('click', clearSelections);
  exportBtn?.addEventListener('click', showModal);
  modalOverlay?.addEventListener('click', hideModal);
  modalClose?.addEventListener('click', hideModal);
  copyBtn?.addEventListener('click', copyToClipboard);
  downloadBtn?.addEventListener('click', downloadFile);

  exportTabs?.forEach(tab => {
    tab.addEventListener('click', () => switchExportTab(tab.dataset.format));
  });

  // Handle clicks on diff content
  document.addEventListener('click', handleLineClick);

  // Close modal on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('active')) {
      hideModal();
    }
  });
`;
