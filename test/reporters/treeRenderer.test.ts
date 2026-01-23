import { describe, expect, it } from 'vitest';

import { buildFileTree } from '../../src/reporters/treeBuilder';
import { renderSidebarTree, renderTreeview } from '../../src/reporters/treeRenderer';

describe('treeRenderer', () => {
  describe('renderTreeview', () => {
    it('should return empty string for empty nodes', () => {
      const result = renderTreeview([]);
      expect(result).toBe('');
    });

    it('should render single file', () => {
      const tree = buildFileTree(['file.txt']);
      const result = renderTreeview(tree);

      expect(result).toContain('class="tree-root"');
      expect(result).toContain('class="tree-file"');
      expect(result).toContain('data-path="file.txt"');
      expect(result).toContain('class="tree-file-name"');
      expect(result).toContain('file.txt');
    });

    it('should render folder with toggle', () => {
      const tree = buildFileTree(['src/index.ts']);
      const result = renderTreeview(tree);

      expect(result).toContain('class="tree-folder"');
      expect(result).toContain('class="tree-toggle"');
      expect(result).toContain('class="tree-folder-name"');
      expect(result).toContain('src');
      expect(result).toContain('class="tree-children"');
    });

    it('should render nested structure', () => {
      const tree = buildFileTree(['src/utils/helpers.ts']);
      const result = renderTreeview(tree);

      expect(result).toContain('data-path="src"');
      expect(result).toContain('data-path="src/utils"');
      expect(result).toContain('data-path="src/utils/helpers.ts"');
    });

    it('should escape HTML special characters', () => {
      const tree = buildFileTree(['file<script>.txt']);
      const result = renderTreeview(tree);

      expect(result).toContain('file&lt;script&gt;.txt');
      expect(result).not.toContain('<script>');
    });

    it('should escape quotes in data attributes', () => {
      const tree = buildFileTree(['file"name.txt']);
      const result = renderTreeview(tree);

      expect(result).toContain('data-path="file&quot;name.txt"');
    });

    it('should render multiple files at root level', () => {
      const tree = buildFileTree(['a.txt', 'b.txt', 'c.txt']);
      const result = renderTreeview(tree);

      expect(result).toContain('a.txt');
      expect(result).toContain('b.txt');
      expect(result).toContain('c.txt');
      expect((result.match(/tree-file"/g) || []).length).toBe(3);
    });

    it('should render mixed folders and files', () => {
      const tree = buildFileTree(['src/index.ts', 'README.md']);
      const result = renderTreeview(tree);

      expect(result).toContain('tree-folder');
      expect(result).toContain('tree-file');
      expect(result).toContain('src');
      expect(result).toContain('index.ts');
      expect(result).toContain('README.md');
    });

    it('should include toggle arrow entity', () => {
      const tree = buildFileTree(['src/index.ts']);
      const result = renderTreeview(tree);

      // Down arrow for expanded state
      expect(result).toContain('&#9660;');
    });
  });

  describe('renderSidebarTree', () => {
    it('should return empty string for empty nodes', () => {
      const result = renderSidebarTree([], new Map());
      expect(result).toBe('');
    });

    it('should render with sidebar-tree class', () => {
      const tree = buildFileTree(['file.txt']);
      const fileIds = new Map([['file.txt', 'file-0']]);
      const result = renderSidebarTree(tree, fileIds);

      expect(result).toContain('class="tree-root sidebar-tree"');
    });

    it('should render file with link', () => {
      const tree = buildFileTree(['file.txt']);
      const fileIds = new Map([['file.txt', 'file-0']]);
      const result = renderSidebarTree(tree, fileIds);

      expect(result).toContain('class="tree-file-link"');
      expect(result).toContain('href="#file-0"');
      expect(result).toContain('data-file-id="file-0"');
    });

    it('should render folder without link', () => {
      const tree = buildFileTree(['src/index.ts']);
      const fileIds = new Map([['src/index.ts', 'file-0']]);
      const result = renderSidebarTree(tree, fileIds);

      // Folder should have toggle, not link
      expect(result).toContain('class="tree-folder"');
      expect(result).toContain('class="tree-toggle"');
      expect(result).toContain('class="tree-folder-name">src</span>');
    });

    it('should render nested files with correct IDs', () => {
      const tree = buildFileTree(['src/a.ts', 'src/b.ts', 'lib/c.ts']);
      const fileIds = new Map([
        ['src/a.ts', 'file-0'],
        ['src/b.ts', 'file-1'],
        ['lib/c.ts', 'file-2']
      ]);
      const result = renderSidebarTree(tree, fileIds);

      expect(result).toContain('href="#file-0"');
      expect(result).toContain('href="#file-1"');
      expect(result).toContain('href="#file-2"');
    });

    it('should handle missing file IDs gracefully', () => {
      const tree = buildFileTree(['file.txt']);
      const fileIds = new Map<string, string>(); // Empty map
      const result = renderSidebarTree(tree, fileIds);

      expect(result).toContain('data-file-id=""');
      expect(result).toContain('href="#"');
    });

    it('should escape HTML in file IDs', () => {
      const tree = buildFileTree(['file.txt']);
      const fileIds = new Map([['file.txt', 'file-<0>']]);
      const result = renderSidebarTree(tree, fileIds);

      expect(result).toContain('data-file-id="file-&lt;0&gt;"');
      expect(result).toContain('href="#file-&lt;0&gt;"');
    });

    it('should render deeply nested structure with links', () => {
      const tree = buildFileTree(['a/b/c/file.ts']);
      const fileIds = new Map([['a/b/c/file.ts', 'file-99']]);
      const result = renderSidebarTree(tree, fileIds);

      expect(result).toContain('href="#file-99"');
      expect(result).toContain('data-path="a"');
      expect(result).toContain('data-path="a/b"');
      expect(result).toContain('data-path="a/b/c"');
      expect(result).toContain('data-path="a/b/c/file.ts"');
    });
  });
});
