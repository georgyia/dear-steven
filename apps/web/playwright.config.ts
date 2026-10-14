import { dirname } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { E2E_FREE_DB, E2E_FREE_OPERATOR_KEY } from './e2e/free-env';
import { E2E_ACCESS_CODE } from './e2e/gated';
import { E2E_LIVE_LOG, E2E_OPERATOR_CANARY } from './e2e/live-env';
import { E2E_SETUP_DB, E2E_SETUP_ENV_FILE, E2E_SETUP_TOKEN } from './e2e/setup-env';

const PORT = Number(process.env.E2E_PORT ?? 3210);
/** A second server from the same build, with an access code set (P6-08): `access.spec.ts` only. */
const GATED_PORT = PORT + 1;
/**
 * Guided setup (P6-04): a server as `pnpm dev:setup` starts one, on a fresh database and env file,
 * fed by a local fixture feed and a fake OpenAI (`e2e/setup-fixtures.ts`): `setup.spec.ts` only.
 */
const SETUP_PORT = PORT + 2;
const FIXTURE_PORT = PORT + 3;
/** The same build on an operator key (P8-01): `operator-key.spec.ts` only. */
const LIVE_PORT = PORT + 4;
/**
 * The same build on a (fake) operator key with three free questions (P8-02): `free-questions.spec.ts`,
 * and on a visitor's own key, so with server speech, `spoken-reply.spec.ts` (P9-01).
 */
const FREE_PORT = PORT + 5;
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
      testIgnore: /(access|setup|operator-key|free-questions|spoken-reply)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 820 } },
    },
    {
      name: 'mobile',
      testIgnore: /(access|setup|operator-key|free-questions|spoken-reply)\.spec\.ts/,
      use: { ...devices['Pixel 7'], viewport: { width: 375, height: 760 } },
    },
    {
      name: 'gated',
      testMatch: /access\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${GATED_PORT}` },
    },
    {
      name: 'setup',
      testMatch: /setup\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${SETUP_PORT}` },
    },
    {
      name: 'live',
      testMatch: /operator-key\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${LIVE_PORT}` },
    },
    {
      name: 'free',
      testMatch: /(free-questions|spoken-reply)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${FREE_PORT}` },
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
    {
      command: `node e2e/setup-fixtures.ts ${FIXTURE_PORT}`,
      url: `http://127.0.0.1:${FIXTURE_PORT}/feed.xml`,
      reuseExistingServer: false,
      timeout: 10_000,
    },
    {
      command: `pnpm exec next start -H 127.0.0.1 -p ${SETUP_PORT}`,
      url: `http://127.0.0.1:${SETUP_PORT}/api/status`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NEXT_TELEMETRY_DISABLED: '1',
        DEAR_STEVEN_SETUP_TOKEN: E2E_SETUP_TOKEN,
        DEAR_STEVEN_SETUP_HOST: '127.0.0.1',
        DEAR_STEVEN_DB_PATH: E2E_SETUP_DB,
        DEAR_STEVEN_ENV_FILE: E2E_SETUP_ENV_FILE,
        DEAR_STEVEN_FEED_URL: `http://127.0.0.1:${FIXTURE_PORT}/feed.xml`,
        OPENAI_BASE_URL: `http://127.0.0.1:${FIXTURE_PORT}/v1`,
        // Whatever the developer's shell has: this server starts with no keys, and gets fake ones.
        OPENAI_API_KEY: '',
        YOUTUBE_API_KEY: '',
        DEAR_STEVEN_DAILY_BUDGET_USD: '',
      },
    },
    {
      // Its output goes to a file, so the test can search every line it printed.
      command: `mkdir -p '${dirname(E2E_LIVE_LOG)}' && pnpm exec next start -p ${LIVE_PORT} > '${E2E_LIVE_LOG}' 2>&1`,
      url: `http://localhost:${LIVE_PORT}/api/status`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NEXT_TELEMETRY_DISABLED: '1',
        OPENAI_API_KEY: E2E_OPERATOR_CANARY,
        OPENAI_BASE_URL: `http://127.0.0.1:${FIXTURE_PORT}/v1`,
        YOUTUBE_API_KEY: '',
        DEAR_STEVEN_DEMO: '',
        DEAR_STEVEN_DB_PATH: 'data/e2e-does-not-exist.db',
        DEAR_STEVEN_DAILY_BUDGET_USD: '',
        DEAR_STEVEN_ENV_FILE: 'data/e2e-live-does-not-exist.env',
      },
    },
    {
      // A fresh fixture knowledge base (and so an empty free-question ledger) every run.
      command: `node e2e/free-fixtures.ts && pnpm exec next start -p ${FREE_PORT}`,
      url: `http://localhost:${FREE_PORT}/api/status`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NEXT_TELEMETRY_DISABLED: '1',
        OPENAI_API_KEY: E2E_FREE_OPERATOR_KEY,
        OPENAI_BASE_URL: `http://127.0.0.1:${FIXTURE_PORT}/v1`,
        YOUTUBE_API_KEY: '',
        DEAR_STEVEN_DEMO: '',
        DEAR_STEVEN_DB_PATH: E2E_FREE_DB,
        DEAR_STEVEN_FREE_QUESTIONS: '3',
        DEAR_STEVEN_DAILY_BUDGET_USD: '',
        DEAR_STEVEN_ENV_FILE: 'data/e2e-free-does-not-exist.env',
      },
    },
  ],
});
