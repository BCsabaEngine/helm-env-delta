// ============================================================================
// Tree Renderer - HTML rendering functions for file tree structures
// ============================================================================

import { TreeNode } from './treeBuilder';

/**
 * Renders a tree structure as HTML with expand/collapse functionality.
 *
 * @param nodes - Array of TreeNode to render
 * @returns HTML string representing the tree
 *
 * @example
 * ```typescript
 * const tree = buildFileTree(['src/index.ts', 'src/utils/helpers.ts']);
 * const html = renderTreeview(tree);
 * // Returns HTML with nested ul/li structure
 * ```
 */
export const renderTreeview = (nodes: TreeNode[]): string => {
  if (nodes.length === 0) return '';

  return `<ul class="tree-root">${nodes.map((node) => renderTreeNode(node)).join('')}</ul>`;
};

/**
 * Renders a single tree node and its children recursively.
 *
 * @param node - TreeNode to render
 * @returns HTML string for the node
 */
const renderTreeNode = (node: TreeNode): string => {
  if (node.isFolder) {
    const children = node.children ? node.children.map((child) => renderTreeNode(child)).join('') : '';
    return `
      <li class="tree-folder" data-path="${escapeHtml(node.path)}">
        <span class="tree-toggle">&#9660;</span>
        <span class="tree-folder-name">${escapeHtml(node.name)}</span>
        <ul class="tree-children">${children}</ul>
      </li>`;
  }

  return `
    <li class="tree-file" data-path="${escapeHtml(node.path)}">
      <span class="tree-file-name">${escapeHtml(node.name)}</span>
    </li>`;
};

/**
 * Renders a sidebar tree with clickable file links for navigation.
 *
 * @param nodes - Array of TreeNode to render
 * @param fileIds - Map of file paths to their DOM element IDs
 * @returns HTML string for the sidebar tree
 *
 * @example
 * ```typescript
 * const tree = buildFileTree(['src/index.ts', 'src/utils/helpers.ts']);
 * const fileIds = new Map([
 *   ['src/index.ts', 'file-0'],
 *   ['src/utils/helpers.ts', 'file-1']
 * ]);
 * const html = renderSidebarTree(tree, fileIds);
 * ```
 */
export const renderSidebarTree = (
  nodes: TreeNode[],
  fileIds: Map<string, string>,
  fileStats?: Map<string, { added: number; removed: number }>
): string => {
  if (nodes.length === 0) return '';

  return `<ul class="tree-root sidebar-tree">${nodes.map((node) => renderSidebarNode(node, fileIds, fileStats)).join('')}</ul>`;
};

/**
 * Renders a single sidebar tree node with navigation links.
 *
 * @param node - TreeNode to render
 * @param fileIds - Map of file paths to their DOM element IDs
 * @returns HTML string for the node
 */
const renderSidebarNode = (
  node: TreeNode,
  fileIds: Map<string, string>,
  fileStats?: Map<string, { added: number; removed: number }>
): string => {
  if (node.isFolder) {
    const children = node.children
      ? node.children.map((child) => renderSidebarNode(child, fileIds, fileStats)).join('')
      : '';
    return `
      <li class="tree-folder" data-path="${escapeHtml(node.path)}">
        <span class="tree-toggle">&#9660;</span>
        <span class="tree-folder-name">${escapeHtml(node.name)}</span>
        <ul class="tree-children">${children}</ul>
      </li>`;
  }

  const fileId = fileIds.get(node.path) || '';
  const stats = fileStats?.get(node.path);
  const badges = stats
    ? ` <span class="line-badge line-added">+${stats.added}</span><span class="line-badge line-removed">-${stats.removed}</span>`
    : '';
  return `
    <li class="tree-file" data-path="${escapeHtml(node.path)}" data-file-id="${escapeHtml(fileId)}">
      <a href="#${escapeHtml(fileId)}" class="tree-file-link">${escapeHtml(node.name)}</a>${badges}
    </li>`;
};

/**
 * Escapes HTML special characters to prevent XSS.
 *
 * @param text - Text to escape
 * @returns Escaped text safe for HTML insertion
 */
export const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
