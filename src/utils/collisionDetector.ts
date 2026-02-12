import type { TransformConfig } from '../config';
import { createErrorClass, createErrorTypeGuard } from './errors';
import { transformFilename } from './filenameTransformer';

// ============================================================================
// Error Handling
// ============================================================================

const CollisionDetectorErrorClass = createErrorClass('Filename Collision Error', {
  DUPLICATE_TRANSFORMED_NAME: 'Multiple files transform to the same filename'
});

export class CollisionDetectorError extends CollisionDetectorErrorClass {}
export const isCollisionDetectorError = createErrorTypeGuard(CollisionDetectorError);

// ============================================================================
// Collision Detection
// ============================================================================

export interface CollisionInfo {
  transformedName: string;
  originalPaths: string[];
}

export const detectCollisions = (fileMap: Map<string, string>, transforms?: TransformConfig): CollisionInfo[] => {
  if (!transforms) return [];

  const reverseMap = new Map<string, string[]>();

  for (const [originalPath] of fileMap.entries()) {
    const transformedPath = transformFilename(originalPath, transforms);

    const existing = reverseMap.get(transformedPath) ?? [];
    existing.push(originalPath);
    reverseMap.set(transformedPath, existing);
  }

  const collisions: CollisionInfo[] = [];

  for (const [transformedName, originalPaths] of reverseMap.entries())
    if (originalPaths.length > 1) collisions.push({ transformedName, originalPaths });

  return collisions;
};

export const validateNoCollisions = (collisions: CollisionInfo[]): void => {
  if (collisions.length === 0) return;

  const collisionDetails = collisions
    .map((collision) => `  ${collision.transformedName}: [${collision.originalPaths.join(', ')}]`)
    .join('\n');

  const collisionError = new CollisionDetectorError(`Multiple files transform to the same path:\n${collisionDetails}`, {
    code: 'DUPLICATE_TRANSFORMED_NAME',
    details: JSON.stringify(collisions)
  });

  collisionError.message += '\n\n  Hint: Make your filename transforms more specific:';
  collisionError.message += "\n    - Use more specific patterns: { find: 'app-uat\\.', replace: 'app-prod.' }";
  collisionError.message += "\n    - Or match on path: { find: 'services/uat/', replace: 'services/prod/' }";
  collisionError.message += '\n    - Check the collision details above for conflicting files';

  throw collisionError;
};
