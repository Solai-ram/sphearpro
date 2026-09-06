import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true, legacyDecorator: true },
        target: 'es2022',
      },
      module: { type: 'es6' },
    }),
  ],
  test: {
    globals: false,
    environment: 'node',
    setupFiles: ['./src/test/vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    maxConcurrency: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/test/**',
        'src/main.ts',
        'src/**/*.module.ts',
      ],
      thresholds: {
        lines: 18,
        functions: 18,
        branches: 12,
        statements: 18,
      },
    },
  },
});
