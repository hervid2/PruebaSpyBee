import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Pre-warms the real-login cache once for the whole run — see its own
  // header comment for why this can't just be per-worker.
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report' }]],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Software WebGL so Mapbox GL renders in headless Chromium
    launchOptions: {
      args: ['--use-gl=swiftshader'],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: [
    /**
     * The API (F9.5), started only for a local run. CI starts its own backend
     * as a workflow step before Playwright is invoked at all, so adding this
     * unconditionally would try to bind :3001 twice; `E2E_LOCAL=1` is set by
     * scripts/e2e-local.mjs, which is also what provisions and seeds the
     * database this connects to.
     *
     * Web servers start before `globalSetup`, which is what makes this work at
     * all — global-setup.ts pre-warms real access tokens against a live
     * `/auth/login` and has nothing to talk to otherwise.
     *
     * The env below mirrors ci.yml's "Start backend" step; keep the two in
     * step, since the point of running locally is to reproduce CI.
     */
    ...(process.env.E2E_LOCAL
      ? [
          {
            command: 'node dist/main.js',
            cwd: 'backend',
            url: 'http://localhost:3001/health',
            reuseExistingServer: !process.env.CI,
            timeout: 60_000,
            env: {
              DATABASE_URL: process.env.DATABASE_URL ?? '',
              PORT: '3001',
              JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? '',
              JWT_ACCESS_EXPIRES_IN_SECONDS: '900',
              JWT_REFRESH_EXPIRES_IN_DAYS: '7',
              // Never exercised — no spec attaches media — but
              // S3StorageProvider's constructor requires both at boot
              // (`getOrThrow`), so the app will not start without them.
              AWS_REGION: 'us-east-1',
              S3_BUCKET_NAME: 'local-e2e-placeholder-bucket',
              FRONTEND_ORIGIN: 'http://localhost:3000',
            },
          },
        ]
      : []),
    {
      // CI builds first with `npm run build`, then this starts the prod server.
      // Locally, set PLAYWRIGHT_DEV=1 to use the dev server instead.
      command: process.env.PLAYWRIGHT_DEV ? 'npm run dev' : 'npm run start',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '',
      },
    },
  ],
});
