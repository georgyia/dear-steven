import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3210);

/**
 * End-to-end tests run against a production build in forced demo mode, so they never need keys,
 * never touch the network and never depend on a local knowledge base.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 820 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 760 } } },
  ],
  webServer: {
    command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/status`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      DEAR_STEVEN_DEMO: '1',
      DEAR_STEVEN_DB_PATH: 'data/e2e-does-not-exist.db',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
