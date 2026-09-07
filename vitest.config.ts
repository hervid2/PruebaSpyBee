/**
 * Vitest configuration for unit tests. Runs in jsdom, scopes coverage to the
 * pure logic layers (domain + store) with a 70% threshold, and excludes the
 * Playwright `e2e/` suite which runs under its own runner.
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    include: ['__tests__/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    css: false,
    pool: 'threads',
    // Raised from vitest's 5000ms default (F9.5). Rendering the heavier
    // component tests — the create-incident modal, the full calendar — costs a
    // few seconds each under React 19, and with the whole suite running in
    // parallel the slowest of them crossed the default and failed on time
    // rather than on behaviour. They pass in isolation, and the failure moved
    // between files from run to run, which is what a contention limit looks
    // like rather than a broken test. This bounds a genuine hang just as well;
    // it only stops a busy machine from being reported as a regression.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/domain/**', 'src/store/**'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
