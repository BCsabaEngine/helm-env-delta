import { readFileSync } from 'node:fs';

// ============================================================================
// HTML Styles and Scripts
// ============================================================================

/**
 * Inlined diff2html CSS for fully self-contained HTML reports.
 */
// eslint-disable-next-line unicorn/prefer-module
export const DIFF2HTML_STYLES = readFileSync(require.resolve('diff2html/bundles/css/diff2html.min.css'), 'utf8');

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

  .file-section[open] > summary {
    position: sticky;
    top: 0;
    z-index: 10;
    border-bottom: 1px solid #d0d7de;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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

  /* Added content area (same as changed-content) */
  .added-content {
    flex: 1;
    min-width: 0;
    padding-left: 20px;
  }

  /* Content container for added files */
  .content-container {
    padding: 16px;
    background: #f6f8fa;
    border-top: 1px solid #d0d7de;
  }

  .content-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .copy-btn,
  .download-btn {
    padding: 6px 12px;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #24292e;
    transition: all 0.2s;
  }

  .copy-btn:hover,
  .download-btn:hover {
    background: #f3f4f6;
    border-color: #b0b7be;
  }

  .copy-btn.copied {
    background: #d4edda;
    border-color: #28a745;
    color: #155724;
  }

  .file-content {
    margin: 0;
    padding: 16px;
    background: white;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    overflow-x: auto;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre;
  }

  .file-content code {
    font-family: inherit;
  }

  /* Scroll-to-top button */
  .scroll-to-top {
    display: none;
    position: fixed;
    bottom: 30px;
    right: 30px;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: #0969da;
    color: white;
    font-size: 18px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: opacity 0.2s, background 0.2s;
    z-index: 200;
    line-height: 40px;
    text-align: center;
    padding: 0;
  }

  .scroll-to-top:hover {
    background: #0550ae;
  }

  .scroll-to-top.visible {
    display: block;
  }

  /* Content toolbar (collapse/expand buttons) */
  .content-toolbar {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-bottom: 12px;
  }

  .collapse-all-btn,
  .expand-all-btn {
    padding: 4px 12px;
    border: 1px solid #d0d7de;
    border-radius: 4px;
    background: none;
    cursor: pointer;
    font-size: 12px;
    color: #586069;
    transition: all 0.2s;
  }

  .collapse-all-btn:hover,
  .expand-all-btn:hover {
    background: #f6f8fa;
    color: #24292e;
  }

  /* Line change count badges */
  .summary-badges {
    float: right;
    display: inline-flex;
    gap: 6px;
    margin-left: 12px;
  }

  .line-badge {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
    line-height: 18px;
  }

  .line-added {
    background: #d4edda;
    color: #155724;
  }

  .line-removed {
    background: #f8d7da;
    color: #721c24;
  }

  /* Diff toolbar */
  .diff-toolbar {
    display: flex;
    justify-content: flex-end;
    padding: 8px 16px;
    border-bottom: 1px solid #d0d7de;
    background: #f6f8fa;
  }

  .copy-diff-btn {
    padding: 4px 12px;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #24292e;
    transition: all 0.2s;
  }

  .copy-diff-btn:hover {
    background: #f3f4f6;
    border-color: #b0b7be;
  }

  .copy-diff-btn.copied {
    background: #d4edda;
    border-color: #28a745;
    color: #155724;
  }

  /* Sidebar search */
  .sidebar-search {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #d0d7de;
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 12px;
    margin-bottom: 8px;
    box-sizing: border-box;
    position: sticky;
    top: 0;
    z-index: 1;
    background: #fff;
  }

  .sidebar-search:focus {
    outline: none;
    border-color: #0969da;
    box-shadow: 0 0 0 3px rgba(9,105,218,0.15);
  }

  /* Stats toggle button */
  .stats-toggle-btn {
    padding: 4px 12px;
    border: 1px solid #d0d7de;
    border-radius: 4px;
    background: none;
    cursor: pointer;
    font-size: 12px;
    color: #586069;
    transition: all 0.2s;
  }

  .stats-toggle-btn:hover {
    background: #f6f8fa;
    color: #24292e;
  }

  /* Statistics dashboard */
  .stats-dashboard {
    margin: 15px 0 0;
    padding: 12px 0 0;
    border-top: 1px solid #e1e4e8;
  }

  .stats-summary {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-bottom: 10px;
  }

  .stats-summary .total-added {
    font-weight: 700;
    color: #155724;
    font-size: 16px;
  }

  .stats-summary .total-removed {
    font-weight: 700;
    color: #721c24;
    font-size: 16px;
  }

  .stats-bar {
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    background: #e1e4e8;
    margin-bottom: 10px;
  }

  .stats-segment {
    height: 100%;
    min-width: 2px;
  }

  .stats-segment.added-segment {
    background: #28a745;
  }

  .stats-segment.removed-segment {
    background: #d73a49;
  }

  .top-changed-files {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: 13px;
  }

  .top-changed-files li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 3px 0;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
    color: #586069;
  }

  .top-changed-files .file-path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 8px;
  }

  .top-changed-files .file-stats {
    white-space: nowrap;
    flex-shrink: 0;
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

  // Sidebar toggle (supports multiple sidebars)
  document.querySelectorAll('.sidebar-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const container = toggle.closest('.sidebar-container');
      if (!container) return;
      const sidebar = container.querySelector('.sidebar');
      if (sidebar) {
        sidebar.classList.toggle('collapsed');
        toggle.textContent = sidebar.classList.contains('collapsed') ? '\u25B6' : '\u25C0';
      }
    });
  });

  // Sidebar expand button (supports multiple sidebars)
  document.querySelectorAll('.sidebar-expand-btn').forEach(expandBtn => {
    expandBtn.addEventListener('click', () => {
      const container = expandBtn.closest('.sidebar-container');
      if (!container) return;
      const sidebar = container.querySelector('.sidebar');
      const toggle = container.querySelector('.sidebar-toggle');
      if (sidebar) {
        sidebar.classList.remove('collapsed');
        if (toggle) {
          toggle.textContent = '\u25C0';
        }
      }
    });
  });

  // Sidebar file click - scroll to diff/content
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
        // Highlight active file in sidebar (within same container)
        const container = link.closest('.sidebar-container');
        if (container) {
          container.querySelectorAll('.sidebar-tree .tree-file').forEach(f => f.classList.remove('active'));
        }
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
          // Find the corresponding sidebar container
          const tabContent = entry.target.closest('.tab-content');
          if (tabContent) {
            tabContent.querySelectorAll('.sidebar-tree .tree-file').forEach(f => {
              const link = f.querySelector('.tree-file-link');
              if (link && link.getAttribute('href') === '#' + fileId) {
                f.classList.add('active');
              } else {
                f.classList.remove('active');
              }
            });
          }
        }
      });
    }, { threshold: 0.3, rootMargin: '-100px 0px -50% 0px' });

    fileSections.forEach(section => observer.observe(section));
  }

  // Copy button functionality
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const fileId = btn.getAttribute('data-file-id');
      const section = document.getElementById(fileId);
      if (!section) return;

      const codeElement = section.querySelector('.file-content code');
      if (!codeElement) return;

      const content = codeElement.textContent || '';

      try {
        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(content);
        } else {
          // Fallback for older browsers
          const textarea = document.createElement('textarea');
          textarea.value = content;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }

        // Visual feedback
        const originalText = btn.textContent;
        btn.textContent = '\u2713 Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = originalText;
          btn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        btn.textContent = '\u2717 Failed';
        setTimeout(() => {
          btn.textContent = '\ud83d\udccb Copy';
        }, 2000);
      }
    });
  });

  // Download button functionality
  document.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fileId = btn.getAttribute('data-file-id');
      const filename = btn.getAttribute('data-filename') || 'file.yaml';
      const section = document.getElementById(fileId);
      if (!section) return;

      const codeElement = section.querySelector('.file-content code');
      if (!codeElement) return;

      const content = codeElement.textContent || '';

      // Create blob and download
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  });

  // Scroll-to-top button
  const scrollToTopBtn = document.querySelector('.scroll-to-top');
  if (scrollToTopBtn) {
    window.addEventListener('scroll', () => {
      scrollToTopBtn.classList.toggle('visible', window.scrollY > 200);
    });
    scrollToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Collapse All / Expand All buttons
  document.querySelectorAll('.collapse-all-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabContent = btn.closest('.tab-content');
      if (!tabContent) return;
      tabContent.querySelectorAll('.file-section[open]').forEach(d => { d.open = false; });
    });
  });
  document.querySelectorAll('.expand-all-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabContent = btn.closest('.tab-content');
      if (!tabContent) return;
      tabContent.querySelectorAll('.file-section').forEach(d => { d.open = true; });
    });
  });

  // Copy Diff button functionality
  document.querySelectorAll('.copy-diff-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const fileId = btn.getAttribute('data-file-id');
      const section = document.getElementById(fileId);
      if (!section) return;

      const diffSource = section.querySelector('.unified-diff-source');
      if (!diffSource) return;

      const content = diffSource.textContent || '';

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(content);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = content;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }

        const originalText = btn.textContent;
        btn.textContent = '\u2713 Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = originalText;
          btn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy diff:', err);
        btn.textContent = '\u2717 Failed';
        setTimeout(() => {
          btn.textContent = 'Copy Diff';
        }, 2000);
      }
    });
  });

  // Sidebar search/filter functionality
  document.querySelectorAll('.sidebar-search').forEach(input => {
    input.addEventListener('input', () => {
      const searchText = input.value.toLowerCase().trim();
      const sidebar = input.closest('.sidebar-content');
      if (!sidebar) return;

      const files = sidebar.querySelectorAll('.tree-file');
      const folders = sidebar.querySelectorAll('.tree-folder');

      if (!searchText) {
        files.forEach(f => { f.style.display = ''; });
        folders.forEach(f => { f.style.display = ''; f.classList.remove('collapsed'); });
        return;
      }

      // First hide all files that don't match
      files.forEach(f => {
        const path = (f.getAttribute('data-path') || '').toLowerCase();
        f.style.display = path.includes(searchText) ? '' : 'none';
      });

      // Then show/hide folders based on whether they have visible children
      // Process from deepest to shallowest
      const folderArray = Array.from(folders).reverse();
      folderArray.forEach(folder => {
        const childrenContainer = folder.querySelector('.tree-children');
        if (!childrenContainer) return;
        const hasVisibleChild = childrenContainer.querySelector('.tree-file:not([style*="display: none"]), .tree-folder:not([style*="display: none"])');
        if (hasVisibleChild) {
          folder.style.display = '';
          folder.classList.remove('collapsed');
        } else {
          folder.style.display = 'none';
        }
      });
    });
  });

  // Stats dashboard toggle
  const statsToggleBtn = document.getElementById('stats-toggle-btn');
  const statsDashboardContent = document.getElementById('stats-dashboard-content');
  if (statsToggleBtn && statsDashboardContent) {
    statsToggleBtn.addEventListener('click', () => {
      const isHidden = statsDashboardContent.style.display === 'none';
      statsDashboardContent.style.display = isHidden ? 'block' : 'none';
      statsToggleBtn.textContent = isHidden ? 'Hide Details' : 'Show Details';
    });
  }

  // Synchronized vertical scrolling for side-by-side diff panels
  document.querySelectorAll('.d2h-files-diff').forEach(container => {
    const panels = container.querySelectorAll('.d2h-file-side-diff');
    if (panels.length === 2) {
      let isSyncing = false;
      panels.forEach((panel, index) => {
        panel.addEventListener('scroll', () => {
          if (isSyncing) return;
          isSyncing = true;
          const other = panels[1 - index];
          other.scrollTop = panel.scrollTop;
          isSyncing = false;
        });
      });
    }
  });
`;
