import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { en } from '../src/i18n/en';
import { expect, test } from './fixtures';
import {
  E2E_FAKE_OPENAI_KEY,
  E2E_SETUP_DB,
  E2E_SETUP_ENV_FILE,
  E2E_SETUP_TOKEN,
} from './setup-env';

/**
 * Guided local setup (P6-04), against a server started the way `pnpm dev:setup` starts one, a
 * fixture feed and a fake OpenAI. One journey, in order: nothing is set up when it begins.
 */
const copy = en.setup.guided;
const root = new URL('../../../', import.meta.url);
const envFile = new URL(E2E_SETUP_ENV_FILE, root);
const MAIN_SERVER = `http://localhost:${Number(process.env.E2E_PORT ?? 3210)}`;

test.describe.configure({ mode: 'serial' });

test('the setup routes are hidden without the token, and on a server not started for setup', async ({
  request,
}) => {
  expect((await request.get('/api/setup')).status()).toBe(404);
  expect(
    (await request.get('/api/setup', { headers: { 'x-setup-token': 'x'.repeat(42) } })).status(),
  ).toBe(404);
  const asked = { headers: { 'x-setup-token': E2E_SETUP_TOKEN } };
  expect((await request.get('/api/setup', asked)).status()).toBe(200);
  expect((await request.get(`${MAIN_SERVER}/api/setup`, asked)).status()).toBe(404);
  const fromElsewhere = { headers: { ...asked.headers, origin: 'http://attacker.example' } };
  expect(
    (await request.post('/api/setup/run', { ...fromElsewhere, data: { stage: 'chunk' } })).status(),
    'a request from another site is refused',
  ).toBe(404);
});

test('keys, transcripts and embeddings from the setup panel', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/#setup=${E2E_SETUP_TOKEN}`);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: copy.title })).toBeVisible();
  expect(new URL(page.url()).hash, 'the token leaves the address bar').toBe('');

  // Keys: written to the env file, never shown again.
  await dialog.getByLabel(copy.openai).fill(E2E_FAKE_OPENAI_KEY);
  await dialog.getByLabel(copy.budget).fill('2');
  await dialog.getByRole('button', { name: copy.save(E2E_SETUP_ENV_FILE) }).click();
  await expect(dialog.getByText(copy.savedNote(E2E_SETUP_ENV_FILE))).toBeVisible();
  await expect(dialog.getByLabel(copy.openai)).toHaveValue('');
  await expect(dialog.getByLabel(copy.openai)).toHaveAttribute('placeholder', copy.saved);
  const saved = readFileSync(envFile, 'utf8');
  expect(saved).toContain(`OPENAI_API_KEY=${E2E_FAKE_OPENAI_KEY}`);
  expect(saved).toContain('DEAR_STEVEN_DAILY_BUDGET_USD=2');
  expect(statSync(envFile).mode & 0o777).toBe(0o600);

  // YouTube needs its own key.
  await expect(dialog.getByRole('button', { name: copy.link })).toBeDisabled();
  await expect(dialog.getByText(copy.needsYouTube)).toBeVisible();

  // Transcripts: the free stages, one after another, with their output as they run.
  await dialog.getByLabel(copy.newest).fill('2');
  await dialog.getByRole('button', { name: copy.build }).click();
  await expect(dialog.getByRole('status').filter({ hasText: copy.finished })).toBeVisible({
    timeout: 60_000,
  });
  await expect(dialog.getByRole('log')).toContainText('E2E fixture episode');
  await expect(dialog.getByText(/^2 episodes and \d+ passages indexed/)).toBeVisible();

  // Embeddings: the estimate first, then a run capped by it.
  const estimate = dialog.getByText(/passages? waiting, about \$/);
  await expect(estimate).toBeVisible();
  await dialog.getByRole('button', { name: /^Embed for about \$/ }).click();
  await expect(dialog.getByText(copy.nothingToEmbed)).toBeVisible({ timeout: 60_000 });
  await expect(dialog.getByRole('status').filter({ hasText: copy.finished })).toBeVisible();
  await expect(dialog.getByText(en.setup.embeddings.done)).toBeVisible();

  // The CLI, reading the same database, agrees with the panel.
  const kb = await dialog.getByText(/^2 episodes and \d+ passages indexed/).textContent();
  const passages = kb?.match(/(\d+) passages/)?.[1];
  const { FORCE_COLOR: _, ...env } = process.env;
  const status = execFileSync(process.execPath, ['packages/ingest/src/cli.ts', 'status'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...env,
      NO_COLOR: '1',
      DEAR_STEVEN_DB_PATH: E2E_SETUP_DB,
      DEAR_STEVEN_ENV_FILE: E2E_SETUP_ENV_FILE,
    },
  });
  expect(status).toMatch(
    /episodes\s+2 discovered · 2 with an RSS transcript · 2 transcribed · 2 indexed/,
  );
  expect(status).toContain(`passages   ${passages} · ${passages} embedded (100%)`);

  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(audit.violations.map((v) => v.id)).toEqual([]);
  await page.screenshot({ path: 'e2e/screenshots/p6-04-guided-setup.png', fullPage: true });
});
