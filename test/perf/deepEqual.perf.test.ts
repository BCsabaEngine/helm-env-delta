import { bench, describe } from 'vitest';

import { deepEqual } from '../../src/utils/deepEqual';
import { generateNestedObject } from './fixtures/dataGenerator';

describe('deepEqual performance', () => {
  describe('Array comparisons', () => {
    bench('deepEqual-flat-100-items', () => {
      const array1 = Array.from({ length: 100 }).map((_, index) => index);
      const array2 = Array.from({ length: 100 }).map((_, index) => index);

      deepEqual(array1, array2);
    });

    bench('deepEqual-flat-1000-items', () => {
      const array1 = Array.from({ length: 500 }).map((_, index) => index);
      const array2 = Array.from({ length: 500 }).map((_, index) => index);

      deepEqual(array1, array2);
    });

    bench('deepEqual-100-complex-objects', () => {
      const array1 = Array.from({ length: 50 }).map(() => generateNestedObject(3, 5));
      const array2 = [...array1];

      deepEqual(array1, array2);
    });
  });

  describe('Object comparisons', () => {
    bench('deepEqual-flat-object-100-keys', () => {
      const object1 = Object.fromEntries(Array.from({ length: 100 }).map((_, index) => [`key${index}`, index]));
      const object2 = { ...object1 };

      deepEqual(object1, object2);
    });

    bench('deepEqual-nested-10-levels', () => {
      const object1 = generateNestedObject(8, 4);
      const object2 = structuredClone(object1);

      deepEqual(object1, object2);
    });

    bench('deepEqual-nested-5-levels-20-keys', () => {
      const object1 = generateNestedObject(5, 10);
      const object2 = structuredClone(object1);

      deepEqual(object1, object2);
    });
  });

  describe('Worst-case scenarios', () => {
    bench('worst-case-differ-at-last-key', () => {
      const object1 = generateNestedObject(8, 5);
      const object2 = structuredClone(object1);

      let current: Record<string, unknown> = object2;
      for (let index = 0; index < 7; index++) current = current[Object.keys(current)[0]] as Record<string, unknown>;

      current.lastKey = 'DIFFERENT';

      deepEqual(object1, object2);
    });

    bench('worst-case-toSorted-overhead-500-keys', () => {
      const object1 = Object.fromEntries(Array.from({ length: 200 }).map((_, index) => [`key${index}`, index]));
      const object2 = { ...object1 };

      deepEqual(object1, object2);
    });
  });
});
