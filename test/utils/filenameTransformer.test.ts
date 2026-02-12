import { describe, expect, it } from 'vitest';

import type { TransformConfig } from '../../src/config/configFile';
import {
  FilenameTransformerError,
  getFilenameTransformsForFile,
  isFilenameTransformerError,
  transformFilename,
  transformFilenameMap
} from '../../src/utils/filenameTransformer';

describe('filenameTransformer', () => {
  describe('getFilenameTransformsForFile', () => {
    it('should return empty array when transforms is undefined', () => {
      const result = getFilenameTransformsForFile('test.yaml');
      expect(result).toEqual([]);
    });

    it('should return empty array when no patterns match', () => {
      const transforms: TransformConfig = {
        '*.json': { filename: [{ find: 'test', replace: 'prod' }] }
      };
      const result = getFilenameTransformsForFile('test.yaml', transforms);
      expect(result).toEqual([]);
    });

    it('should return filename rules for matching pattern', () => {
      const transforms: TransformConfig = {
        '*.yaml': {
          content: [{ find: 'content', replace: 'replaced' }],
          filename: [{ find: 'uat', replace: 'prod' }]
        }
      };
      const result = getFilenameTransformsForFile('test.yaml', transforms);
      expect(result).toEqual([{ find: 'uat', replace: 'prod' }]);
    });

    it('should return empty array when filename rules are undefined', () => {
      const transforms: TransformConfig = {
        '*.yaml': { content: [{ find: 'test', replace: 'prod' }] }
      };
      const result = getFilenameTransformsForFile('test.yaml', transforms);
      expect(result).toEqual([]);
    });

    it('should concatenate rules from multiple matching patterns', () => {
      const transforms: TransformConfig = {
        '**/*.yaml': { filename: [{ find: 'uat', replace: 'prod' }] },
        'envs/*.yaml': { filename: [{ find: 'staging', replace: 'production' }] }
      };
      const result = getFilenameTransformsForFile('envs/test.yaml', transforms);
      expect(result).toEqual([
        { find: 'uat', replace: 'prod' },
        { find: 'staging', replace: 'production' }
      ]);
    });
  });

  describe('transformFilename', () => {
    it('should return unchanged path when transforms is undefined', () => {
      const result = transformFilename('envs/uat/app.yaml');
      expect(result).toBe('envs/uat/app.yaml');
    });

    it('should return unchanged path when no patterns match', () => {
      const transforms: TransformConfig = {
        '*.json': { filename: [{ find: 'uat', replace: 'prod' }] }
      };
      const result = transformFilename('envs/uat/app.yaml', transforms);
      expect(result).toBe('envs/uat/app.yaml');
    });

    it('should return unchanged path when no filename rules', () => {
      const transforms: TransformConfig = {
        '*.yaml': { content: [{ find: 'test', replace: 'prod' }] }
      };
      const result = transformFilename('envs/uat/app.yaml', transforms);
      expect(result).toBe('envs/uat/app.yaml');
    });

    it('should transform folder names in path', () => {
      const transforms: TransformConfig = {
        '**/*.yaml': { filename: [{ find: '/uat/', replace: '/prod/' }] }
      };
      const result = transformFilename('envs/uat/app.yaml', transforms);
      expect(result).toBe('envs/prod/app.yaml');
    });

    it('should transform filename only', () => {
      const transforms: TransformConfig = {
        '**/*.yaml': { filename: [{ find: String.raw`-uat\.`, replace: '-prod.' }] }
      };
      const result = transformFilename('envs/config/app-uat.yaml', transforms);
      expect(result).toBe('envs/config/app-prod.yaml');
    });

    it('should transform both folder and filename', () => {
      const transforms: TransformConfig = {
        '**/*.yaml': {
          filename: [
            { find: '/uat/', replace: '/prod/' },
            { find: String.raw`-uat\.`, replace: '-prod.' }
          ]
        }
      };
      const result = transformFilename('envs/uat/app-uat.yaml', transforms);
      expect(result).toBe('envs/prod/app-prod.yaml');
    });

    it('should support capture groups', () => {
      const transforms: TransformConfig = {
        '**/*.yaml': { filename: [{ find: String.raw`(\w+)-uat\.(\w+)`, replace: '$1-prod.$2' }] }
      };
      const result = transformFilename('envs/app-uat.yaml', transforms);
      expect(result).toBe('envs/app-prod.yaml');
    });

    it('should apply transforms sequentially', () => {
      const transforms: TransformConfig = {
        '*.yaml': {
          filename: [
            { find: 'uat', replace: 'staging' },
            { find: 'staging', replace: 'prod' }
          ]
        }
      };
      const result = transformFilename('uat-app.yaml', transforms);
      expect(result).toBe('prod-app.yaml');
    });

    it('should normalize path after transformation', () => {
      const transforms: TransformConfig = {
        '**/*.yaml': { filename: [{ find: 'uat', replace: 'prod//subdir' }] }
      };
      const result = transformFilename('uat/app.yaml', transforms);
      expect(result).toBe('prod/subdir/app.yaml');
    });

    it('should throw error for empty transformed path', () => {
      const transforms: TransformConfig = {
        '*.yaml': { filename: [{ find: '.*', replace: '' }] }
      };
      expect(() => transformFilename('test.yaml', transforms)).toThrow(FilenameTransformerError);
      expect(() => transformFilename('test.yaml', transforms)).toThrow('Transformed path is empty');
    });

    it('should throw error for path traversal with ../', () => {
      const transforms: TransformConfig = {
        '*.yaml': { filename: [{ find: 'test', replace: '../test' }] }
      };
      expect(() => transformFilename('test.yaml', transforms)).toThrow(FilenameTransformerError);
      expect(() => transformFilename('test.yaml', transforms)).toThrow(
        'Path transform attempted traversal outside source/destination'
      );
    });

    it('should throw error for absolute path (leading /)', () => {
      const transforms: TransformConfig = {
        '*.yaml': { filename: [{ find: 'test', replace: '/test' }] }
      };
      expect(() => transformFilename('test.yaml', transforms)).toThrow(FilenameTransformerError);
      expect(() => transformFilename('test.yaml', transforms)).toThrow(
        'Path transform attempted traversal outside source/destination'
      );
    });

    it('should throw error for invalid characters', () => {
      const transforms: TransformConfig = {
        '*.yaml': { filename: [{ find: 'test', replace: 'test<file>' }] }
      };
      expect(() => transformFilename('test.yaml', transforms)).toThrow(FilenameTransformerError);
      expect(() => transformFilename('test.yaml', transforms)).toThrow('invalid characters');
    });
  });

  describe('transformFilenameMap', () => {
    it('should return unchanged map when transforms is undefined', () => {
      const fileMap = new Map([['test.yaml', 'content']]);
      const result = transformFilenameMap(fileMap);
      expect(result.fileMap).toBe(fileMap);
      expect(result.originalPaths.size).toBe(0);
    });

    it('should transform all keys in the map', () => {
      const transforms: TransformConfig = {
        '**/*.yaml': { filename: [{ find: '/uat/', replace: '/prod/' }] }
      };
      const fileMap = new Map([
        ['envs/uat/app.yaml', 'content1'],
        ['envs/uat/db.yaml', 'content2'],
        ['other/file.yaml', 'content3']
      ]);
      const result = transformFilenameMap(fileMap, transforms);
      expect(result.fileMap.get('envs/prod/app.yaml')).toBe('content1');
      expect(result.fileMap.get('envs/prod/db.yaml')).toBe('content2');
      expect(result.fileMap.get('other/file.yaml')).toBe('content3');
      expect(result.fileMap.size).toBe(3);
    });

    it('should preserve content values', () => {
      const transforms: TransformConfig = {
        '*.yaml': { filename: [{ find: 'uat', replace: 'prod' }] }
      };
      const fileMap = new Map([['uat-app.yaml', 'original content']]);
      const result = transformFilenameMap(fileMap, transforms);
      expect(result.fileMap.get('prod-app.yaml')).toBe('original content');
    });

    it('should track original paths for transformed files', () => {
      const transforms: TransformConfig = {
        '**/*.yaml': { filename: [{ find: '/uat/', replace: '/prod/' }] }
      };
      const fileMap = new Map([
        ['envs/uat/app.yaml', 'content1'],
        ['other/file.yaml', 'content2']
      ]);
      const result = transformFilenameMap(fileMap, transforms);
      // Only transformed files should have originalPaths entries
      expect(result.originalPaths.get('envs/prod/app.yaml')).toBe('envs/uat/app.yaml');
      expect(result.originalPaths.has('other/file.yaml')).toBe(false); // Not transformed
      expect(result.originalPaths.size).toBe(1);
    });
  });

  describe('isFilenameTransformerError', () => {
    it('should return true for FilenameTransformerError', () => {
      const error1 = new FilenameTransformerError('Test error', { code: 'EMPTY_FILENAME' });
      expect(isFilenameTransformerError(error1)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error1 = new Error('Regular error');
      expect(isFilenameTransformerError(error1)).toBe(false);
    });
  });
});
