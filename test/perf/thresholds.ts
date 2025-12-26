/**
 * Performance thresholds for benchmarks
 * Thresholds are set at 10x local baseline to account for GitHub Actions variability
 */

export interface PerfThreshold {
  name: string; // Benchmark identifier
  maxMean: number; // Maximum average time (ms) - 10x local baseline
  localBaseline?: number; // Expected local performance (for documentation)
}

/**
 * Performance thresholds for all benchmarks
 * These will be calibrated after running benchmarks locally
 *
 * Strategy:
 * 1. Run: npm run test:perf:json
 * 2. Extract mean times from benchmark-results.json
 * 3. Multiply by 10 for GitHub Actions compatibility
 * 4. Update this file with actual values
 */
export const PERF_THRESHOLDS: PerfThreshold[] = [
  // fileDiff.ts - EXTREME criticality
  {
    name: 'yaml-parse-compare-100-files-50kb',
    maxMean: 5000, // Placeholder: will calibrate
    localBaseline: 500
  },
  {
    name: 'yaml-parse-compare-1000-files-1kb',
    maxMean: 15_000,
    localBaseline: 1500
  },
  {
    name: 'yaml-parse-compare-50-files-with-transforms',
    maxMean: 3000,
    localBaseline: 300
  },
  {
    name: 'yaml-parse-compare-20-files-realistic',
    maxMean: 5000,
    localBaseline: 500
  },

  // deepEqual.ts - VERY HIGH criticality
  {
    name: 'deepEqual-flat-100-items',
    maxMean: 50,
    localBaseline: 5
  },
  {
    name: 'deepEqual-flat-1000-items',
    maxMean: 500,
    localBaseline: 50
  },
  {
    name: 'deepEqual-100-complex-objects',
    maxMean: 200,
    localBaseline: 20
  },
  {
    name: 'deepEqual-flat-object-100-keys',
    maxMean: 50,
    localBaseline: 5
  },
  {
    name: 'deepEqual-nested-10-levels',
    maxMean: 100,
    localBaseline: 10
  },
  {
    name: 'deepEqual-nested-5-levels-20-keys',
    maxMean: 150,
    localBaseline: 15
  },

  // fileLoader.ts - VERY HIGH criticality
  {
    name: 'glob-1000-files',
    maxMean: 3000,
    localBaseline: 300
  },
  {
    name: 'parallel-read-100-files-50kb',
    maxMean: 2000,
    localBaseline: 200
  },
  {
    name: 'parallel-read-1000-files-1kb',
    maxMean: 5000,
    localBaseline: 500
  },
  {
    name: 'filename-transforms-1000-files',
    maxMean: 1000,
    localBaseline: 100
  },

  // yamlFormatter.ts - HIGH criticality
  {
    name: 'format-50kb-key-ordering',
    maxMean: 500,
    localBaseline: 50
  },
  {
    name: 'format-5mb-key-ordering',
    maxMean: 10_000,
    localBaseline: 1000
  },
  {
    name: 'format-array-sort-100-elements',
    maxMean: 300,
    localBaseline: 30
  },
  {
    name: 'format-array-sort-1000-elements',
    maxMean: 2000,
    localBaseline: 200
  },
  {
    name: 'format-value-quote-50kb',
    maxMean: 400,
    localBaseline: 40
  },
  {
    name: 'format-combined-50kb',
    maxMean: 800,
    localBaseline: 80
  },

  // transformer.ts - HIGH criticality
  {
    name: 'transform-5-rules-100-values',
    maxMean: 200,
    localBaseline: 20
  },
  {
    name: 'transform-10-complex-regex',
    maxMean: 500,
    localBaseline: 50
  },
  {
    name: 'transform-deep-10-levels-500-values',
    maxMean: 500,
    localBaseline: 50
  },
  {
    name: 'transform-wide-3-levels-1000-values',
    maxMean: 600,
    localBaseline: 60
  },

  // serialization.ts + arrayDiffer.ts - HIGH criticality
  {
    name: 'normalize-100-primitive-array',
    maxMean: 100,
    localBaseline: 10
  },
  {
    name: 'normalize-1000-primitive-array',
    maxMean: 800,
    localBaseline: 80
  },
  {
    name: 'normalize-100-object-array',
    maxMean: 300,
    localBaseline: 30
  },
  {
    name: 'normalize-1000-complex-array',
    maxMean: 3000,
    localBaseline: 300
  },
  {
    name: 'arrayDiff-100-items-50pct-changed',
    maxMean: 200,
    localBaseline: 20
  },
  {
    name: 'arrayDiff-1000-items-10pct-changed',
    maxMean: 1500,
    localBaseline: 150
  },

  // stopRulesValidator.ts - MEDIUM-HIGH criticality
  {
    name: 'validate-100-files-5-rules',
    maxMean: 1500,
    localBaseline: 150
  },
  {
    name: 'validate-1000-files-10-rules',
    maxMean: 15_000,
    localBaseline: 1500
  },

  // fileUpdater.ts - MEDIUM-HIGH criticality
  {
    name: 'deep-merge-100-files-50kb',
    maxMean: 3000,
    localBaseline: 300
  },
  {
    name: 'deep-merge-preserve-skipped-100-files',
    maxMean: 3500,
    localBaseline: 350
  },
  {
    name: 'write-1000-unchanged-files',
    maxMean: 5000,
    localBaseline: 500
  }
];

/**
 * Get threshold for a specific benchmark
 */
export const getThreshold = (benchmarkName: string): PerfThreshold | undefined => {
  return PERF_THRESHOLDS.find((threshold) => threshold.name === benchmarkName);
};

/**
 * Validate a benchmark result against its threshold
 * @throws Error if benchmark exceeds threshold
 */
export const validateBenchmark = (benchmarkName: string, meanTime: number): void => {
  const threshold = getThreshold(benchmarkName);

  if (!threshold) {
    console.warn(`No threshold defined for benchmark: ${benchmarkName}`);
    return;
  }

  if (meanTime > threshold.maxMean) {
    const regression = ((meanTime / threshold.maxMean - 1) * 100).toFixed(1);
    throw new Error(
      `Performance regression detected: ${benchmarkName}\n` +
        `  Expected: ≤ ${threshold.maxMean}ms (mean)\n` +
        `  Actual: ${meanTime}ms\n` +
        `  Regression: ${regression}%`
    );
  }
};
