import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'dist/**',
        'node_modules/**',
        'src/utils/index.ts', // Barrel exports only
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
