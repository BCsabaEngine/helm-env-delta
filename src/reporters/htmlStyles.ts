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
