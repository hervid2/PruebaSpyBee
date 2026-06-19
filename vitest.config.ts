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
