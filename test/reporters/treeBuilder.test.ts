import { describe, expect, it } from 'vitest';

import { buildFileTree } from '../../src/reporters/treeBuilder';

describe('treeBuilder', () => {
  describe('buildFileTree', () => {
    it('should return empty array for empty input', () => {
      const result = buildFileTree([]);
      expect(result).toEqual([]);
    });

    it('should handle single root-level file', () => {
      const result = buildFileTree(['README.md']);
      expect(result).toEqual([
        {
          name: 'README.md',
          path: 'README.md',
          isFolder: false
        }
      ]);
    });

    it('should handle multiple root-level files', () => {
      const result = buildFileTree(['README.md', 'package.json', 'index.ts']);
      expect(result).toHaveLength(3);
      expect(result.every((node) => !node.isFolder)).toBe(true);
      // Should be sorted alphabetically
      expect(result.map((n) => n.name)).toEqual(['index.ts', 'package.json', 'README.md']);
    });

    it('should build nested directory structure', () => {
      const result = buildFileTree(['src/index.ts']);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'src',
        path: 'src',
        isFolder: true
      });
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0]).toMatchObject({
        name: 'index.ts',
        path: 'src/index.ts',
        isFolder: false
      });
    });

    it('should build deeply nested structure', () => {
      const result = buildFileTree(['src/utils/helpers/format.ts']);
      expect(result).toHaveLength(1);

      const source = result[0];
      expect(source.name).toBe('src');
      expect(source.isFolder).toBe(true);

      const utilities = source.children![0];
      expect(utilities.name).toBe('utils');
      expect(utilities.isFolder).toBe(true);

      const helpers = utilities.children![0];
      expect(helpers.name).toBe('helpers');
      expect(helpers.isFolder).toBe(true);

      const file = helpers.children![0];
      expect(file.name).toBe('format.ts');
      expect(file.isFolder).toBe(false);
    });

    it('should merge files into same folder', () => {
      const result = buildFileTree(['src/index.ts', 'src/utils.ts', 'src/config.ts']);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('src');
      expect(result[0].children).toHaveLength(3);
      // Files should be sorted
      expect(result[0].children!.map((c) => c.name)).toEqual(['config.ts', 'index.ts', 'utils.ts']);
    });

    it('should handle mixed files and folders at same level', () => {
      const result = buildFileTree(['README.md', 'src/index.ts', 'package.json']);
      expect(result).toHaveLength(3);
      // Folders first, then files alphabetically
      expect(result[0].name).toBe('src');
      expect(result[0].isFolder).toBe(true);
      expect(result[1].name).toBe('package.json');
      expect(result[1].isFolder).toBe(false);
      expect(result[2].name).toBe('README.md');
      expect(result[2].isFolder).toBe(false);
    });

    it('should sort folders before files at every level', () => {
      const result = buildFileTree(['src/utils/helpers.ts', 'src/index.ts', 'src/components/Button.tsx', 'README.md']);

      expect(result[0].name).toBe('src');
      expect(result[0].isFolder).toBe(true);

      const sourceChildren = result[0].children!;
      // Folders (components, utils) before files (index.ts)
      expect(sourceChildren[0].name).toBe('components');
      expect(sourceChildren[0].isFolder).toBe(true);
      expect(sourceChildren[1].name).toBe('utils');
      expect(sourceChildren[1].isFolder).toBe(true);
      expect(sourceChildren[2].name).toBe('index.ts');
      expect(sourceChildren[2].isFolder).toBe(false);
    });

    it('should handle paths with multiple files in nested directories', () => {
      const result = buildFileTree([
        'envs/prod/values.yaml',
        'envs/prod/secrets.yaml',
        'envs/uat/values.yaml',
        'envs/uat/secrets.yaml'
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('envs');

      const environments = result[0].children!;
      expect(environments).toHaveLength(2);
      expect(environments[0].name).toBe('prod');
      expect(environments[1].name).toBe('uat');

      expect(environments[0].children).toHaveLength(2);
      expect(environments[0].children!.map((c) => c.name)).toEqual(['secrets.yaml', 'values.yaml']);
    });

    it('should preserve full paths in nodes', () => {
      const result = buildFileTree(['a/b/c/file.txt']);
      expect(result[0].path).toBe('a');
      expect(result[0].children![0].path).toBe('a/b');
      expect(result[0].children![0].children![0].path).toBe('a/b/c');
      expect(result[0].children![0].children![0].children![0].path).toBe('a/b/c/file.txt');
    });

    it('should handle files with similar path prefixes', () => {
      const result = buildFileTree(['src/index.ts', 'src-test/index.ts']);
      expect(result).toHaveLength(2);
      expect(result.map((n) => n.name)).toEqual(['src', 'src-test']);
    });

    it('should handle single-character folder and file names', () => {
      const result = buildFileTree(['a/b/c.ts']);
      expect(result[0].name).toBe('a');
      expect(result[0].children![0].name).toBe('b');
      expect(result[0].children![0].children![0].name).toBe('c.ts');
    });

    it('should not have children array for files', () => {
      const result = buildFileTree(['file.txt']);
      expect(result[0].children).toBeUndefined();
    });

    it('should have children array for folders even if empty', () => {
      const result = buildFileTree(['folder/file.txt']);
      expect(result[0].children).toBeDefined();
      expect(Array.isArray(result[0].children)).toBe(true);
    });
  });
});
