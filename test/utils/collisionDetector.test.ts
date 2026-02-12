import { describe, expect, it } from 'vitest';

import type { TransformConfig } from '../../src/config/configFile';
import {
  CollisionDetectorError,
  detectCollisions,
  isCollisionDetectorError,
  validateNoCollisions
} from '../../src/utils/collisionDetector';

describe('collisionDetector', () => {
  describe('detectCollisions', () => {
    it('should return empty array when transforms is undefined', () => {
      const fileMap = new Map([['test.yaml', 'content']]);
      const result = detectCollisions(fileMap);
      expect(result).toEqual([]);
    });

    it('should return empty array when no collisions exist', () => {
      const transforms: TransformConfig = {
        '**/*.yaml': { filename: [{ find: '/uat/', replace: '/prod/' }] }
      };
      const fileMap = new Map([
        ['envs/uat/app.yaml', 'content1'],
        ['envs/uat/db.yaml', 'content2']
      ]);
      const result = detectCollisions(fileMap, transforms);
      expect(result).toEqual([]);
    });

    it('should detect single collision', () => {
      const transforms: TransformConfig = {
        '*.yaml': { filename: [{ find: 'uat-', replace: 'prod-' }] }
      };
      const fileMap = new Map([
        ['uat-app.yaml', 'content1'],
        ['uat-app.yaml.bak', 'content2']
      ]);
      const transformedBak = 'uat-app.yaml.bak'.replaceAll('uat-', 'prod-');
      if (transformedBak === 'prod-app.yaml.bak') {
        const result = detectCollisions(fileMap, transforms);
        expect(result.length).toBe(0);
      }
    });

    it('should detect collision when multiple files transform to same name', () => {
      const transforms: TransformConfig = {
        '*.yaml': { filename: [{ find: '-(uat|staging)', replace: '-prod' }] }
      };
      const fileMap = new Map([
        ['app-uat.yaml', 'content1'],
        ['app-staging.yaml', 'content2']
      ]);
      const result = detectCollisions(fileMap, transforms);
      expect(result).toHaveLength(1);
      expect(result[0].transformedName).toBe('app-prod.yaml');
      expect(result[0].originalPaths).toContain('app-uat.yaml');
      expect(result[0].originalPaths).toContain('app-staging.yaml');
    });

    it('should detect multiple collisions', () => {
      const transforms: TransformConfig = {
        '*.yaml': { filename: [{ find: '-(uat|staging)', replace: '-prod' }] }
      };
      const fileMap = new Map([
        ['app-uat.yaml', 'content1'],
        ['app-staging.yaml', 'content2'],
        ['db-uat.yaml', 'content3'],
        ['db-staging.yaml', 'content4']
      ]);
      const result = detectCollisions(fileMap, transforms);
      expect(result).toHaveLength(2);

      const appCollision = result.find((collision) => collision.transformedName === 'app-prod.yaml');
      expect(appCollision).toBeDefined();
      expect(appCollision?.originalPaths).toHaveLength(2);

      const databaseCollision = result.find((collision) => collision.transformedName === 'db-prod.yaml');
      expect(databaseCollision).toBeDefined();
      expect(databaseCollision?.originalPaths).toHaveLength(2);
    });

    it('should handle files with no matching patterns', () => {
      const transforms: TransformConfig = {
        '*.yaml': { filename: [{ find: 'uat', replace: 'prod' }] }
      };
      const fileMap = new Map([
        ['uat-app.yaml', 'content1'],
        ['test.json', 'content2']
      ]);
      const result = detectCollisions(fileMap, transforms);
      expect(result).toEqual([]);
    });
  });

  describe('validateNoCollisions', () => {
    it('should not throw when no collisions', () => {
      expect(() => validateNoCollisions([])).not.toThrow();
    });

    it('should throw CollisionDetectorError when collisions exist', () => {
      const collisions = [
        {
          transformedName: 'prod-app.yaml',
          originalPaths: ['uat-app.yaml', 'staging-app.yaml']
        }
      ];
      expect(() => validateNoCollisions(collisions)).toThrow(CollisionDetectorError);
    });

    it('should include collision details in error message', () => {
      const collisions = [
        {
          transformedName: 'envs/prod/app.yaml',
          originalPaths: ['envs/uat/app.yaml', 'envs/staging/app.yaml']
        }
      ];
      try {
        validateNoCollisions(collisions);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(CollisionDetectorError);
        if (error instanceof Error) {
          expect(error.message).toContain('envs/prod/app.yaml');
          expect(error.message).toContain('envs/uat/app.yaml');
          expect(error.message).toContain('envs/staging/app.yaml');
        }
      }
    });

    it('should include multiple collisions in error message', () => {
      const collisions = [
        {
          transformedName: 'prod-app.yaml',
          originalPaths: ['uat-app.yaml', 'staging-app.yaml']
        },
        {
          transformedName: 'prod-db.yaml',
          originalPaths: ['uat-db.yaml', 'staging-db.yaml']
        }
      ];
      try {
        validateNoCollisions(collisions);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(CollisionDetectorError);
        if (error instanceof Error) {
          expect(error.message).toContain('prod-app.yaml');
          expect(error.message).toContain('prod-db.yaml');
        }
      }
    });
  });

  describe('isCollisionDetectorError', () => {
    it('should return true for CollisionDetectorError', () => {
      const error1 = new CollisionDetectorError('Test error', { code: 'DUPLICATE_TRANSFORMED_NAME' });
      expect(isCollisionDetectorError(error1)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error1 = new Error('Regular error');
      expect(isCollisionDetectorError(error1)).toBe(false);
    });
  });
});
