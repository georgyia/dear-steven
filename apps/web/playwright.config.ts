import { defineConfig, devices } from '@playwright/test';
import { E2E_ACCESS_CODE } from './e2e/gated';

const PORT = Number(process.env.E2E_PORT ?? 3210);
/** A second server from the same build, with an access code set (P6-08): `access.spec.ts` only. */
const GATED_PORT = PORT + 1;
const SERVER_ENV = {
  DEAR_STEVEN_DEMO: '1',
  DEAR_STEVEN_DB_PATH: 'data/e2e-does-not-exist.db',
  NEXT_TELEMETRY_DISABLED: '1',
};

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
      testIgnore: /access\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 820 } },
    },
    {
      name: 'mobile',
      testIgnore: /access\.spec\.ts/,
      use: { ...devices['Pixel 7'], viewport: { width: 375, height: 760 } },
    },
    {
      name: 'gated',
      testMatch: /access\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${GATED_PORT}` },
    },
  ],
  // Started in order: the first builds, the second reuses that build.
  webServer: [
    {
      command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
      url: `http://localhost:${PORT}/api/status`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: SERVER_ENV,
    },
    {
      command: `pnpm exec next start -p ${GATED_PORT}`,
      // 401 counts as up: behind the gate, that is the right answer.
      url: `http://localhost:${GATED_PORT}/api/status`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { ...SERVER_ENV, DEAR_STEVEN_ACCESS_CODE: E2E_ACCESS_CODE },
    },
  ],
});
