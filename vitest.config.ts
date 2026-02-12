import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts', 'test/perf/**/*.perf.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'test/perf/**/*.perf.test.ts' // Skip perf tests in regular test runs
    ],

    // Benchmark configuration for performance tests
    benchmark: {
      include: ['test/perf/**/*.perf.test.ts'],
      exclude: ['test/perf/fixtures/**'],
      reporters: ['verbose'],
      outputFile: './benchmark-results.json'
    },

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'dist/**',
        'node_modules/**',
        'src/utils/index.ts', // Barrel exports only
        'src/config/index.ts', // Barrel exports only
        'src/pipeline/index.ts', // Barrel exports only
        'src/reporters/index.ts', // Barrel exports only
        'src/index.ts' // Entry point, needs refactoring for testability
      ],
      thresholds: {
        lines: 80,
        functions: 95,
        branches: 75,
        statements: 80
      }
    }
  }
});
