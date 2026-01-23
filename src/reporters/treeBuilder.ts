// ============================================================================
// Tree Builder - Converts flat file paths to hierarchical tree structure
// ============================================================================

/**
 * Represents a node in the file tree structure.
 */
export interface TreeNode {
  /** File or folder name */
  name: string;
  /** Full path from root */
  path: string;
  /** Whether this node is a folder */
  isFolder: boolean;
  /** Child nodes (only for folders) */
  children?: TreeNode[];
}

/**
 * Builds a hierarchical tree structure from a flat list of file paths.
 *
 * @param files - Array of file paths (e.g., ['src/index.ts', 'src/utils/helpers.ts'])
 * @returns Array of root-level TreeNode objects
 *
 * @example
 * ```typescript
 * const files = ['src/index.ts', 'src/utils/helpers.ts', 'README.md'];
 * const tree = buildFileTree(files);
 * // Returns:
 * // [
 * //   { name: 'src', path: 'src', isFolder: true, children: [
 * //     { name: 'index.ts', path: 'src/index.ts', isFolder: false },
 * //     { name: 'utils', path: 'src/utils', isFolder: true, children: [
 * //       { name: 'helpers.ts', path: 'src/utils/helpers.ts', isFolder: false }
 * //     ]}
 * //   ]},
 * //   { name: 'README.md', path: 'README.md', isFolder: false }
 * // ]
 * ```
 */
export const buildFileTree = (files: string[]): TreeNode[] => {
  if (files.length === 0) return [];

  // Use a nested map structure for building
  interface NodeWithChildMap {
    node: TreeNode;
    childMap: Map<string, NodeWithChildMap>;
  }

  const root = new Map<string, NodeWithChildMap>();

  for (const filePath of files) {
    const parts = filePath.split('/');
    let currentLevel = root;
    let currentPath = '';

    for (let index = 0; index < parts.length; index++) {
      const part = parts[index]!;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLastPart = index === parts.length - 1;

      if (!currentLevel.has(part)) {
        const node: TreeNode = {
          name: part,
          path: currentPath,
          isFolder: !isLastPart
        };

        if (!isLastPart) node.children = [];

        currentLevel.set(part, {
          node,
          childMap: new Map()
        });
      }

      const entry = currentLevel.get(part)!;

      // If we encounter a path that was previously a file but now has children,
      // convert it to a folder
      if (!isLastPart && !entry.node.isFolder) {
        entry.node.isFolder = true;
        entry.node.children = [];
      }

      if (!isLastPart) currentLevel = entry.childMap;
    }
  }

  // Convert map structure to tree nodes
  const convertMapToNodes = (map: Map<string, NodeWithChildMap>): TreeNode[] => {
    const nodes: TreeNode[] = [];
    for (const entry of map.values()) {
      if (entry.childMap.size > 0) entry.node.children = convertMapToNodes(entry.childMap);

      nodes.push(entry.node);
    }
    return nodes;
  };

  return sortTreeNodes(convertMapToNodes(root));
};

/**
 * Sorts tree nodes: folders first (alphabetically), then files (alphabetically).
 * Recursively sorts children.
 *
 * @param nodes - Array of TreeNode to sort
 * @returns Sorted array of TreeNode
 */
const sortTreeNodes = (nodes: TreeNode[]): TreeNode[] => {
  const sorted = nodes.toSorted((a, b) => {
    // Folders first
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    // Then alphabetically
    return a.name.localeCompare(b.name);
  });

  // Recursively sort children
  for (const node of sorted)
    if (node.children && node.children.length > 0) node.children = sortTreeNodes(node.children);

  return sorted;
};
