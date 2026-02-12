import { bench, describe } from 'vitest';

import { findArrayDifferences } from '../../src/reporters/arrayDiffer';
import { normalizeForComparison } from '../../src/utils/serialization';
import { generateObjectArray } from './fixtures/dataGenerator';

describe('serialization performance', () => {
  describe('Array normalization', () => {
    bench('normalize-100-primitive-array', () => {
      const array = Array.from({ length: 100 }).map((_, index) => index);
      normalizeForComparison(array);
    });

    bench('normalize-1000-primitive-array', () => {
      const array = Array.from({ length: 200 }).map((_, index) => index);
      normalizeForComparison(array);
    });

    bench('normalize-100-object-array', () => {
      const array = generateObjectArray(50, 'simple');
      normalizeForComparison(array);
    });

    bench('normalize-1000-complex-array', () => {
      const array = generateObjectArray(50, 'complex');
      normalizeForComparison(array);
    });
  });

  describe('Array diff performance', () => {
    bench('arrayDiff-100-items-50pct-changed', () => {
      const source = generateObjectArray(50, 'simple');
      const destination = (source as Array<{ id: number; name: string; value: number }>).map((item, index) =>
        index % 2 === 0 ? { ...item, value: item.value + 1 } : item
      );

      findArrayDifferences(source, destination);
    });

    bench('arrayDiff-1000-items-10pct-changed', () => {
      const source = generateObjectArray(200, 'simple');
      const destination = (source as Array<{ id: number; name: string; value: number }>).map((item, index) =>
        index % 10 === 0 ? { ...item, value: item.value + 1 } : item
      );

      findArrayDifferences(source, destination);
    });
  });
});
