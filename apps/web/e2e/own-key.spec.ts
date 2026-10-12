import AxeBuilder from '@axe-core/playwright';
import type { KnowledgeStatus } from '@dear-steven/core/schema';
import { en } from '../src/i18n/en';
import { expect, type Page, test } from './fixtures';

/**
 * Bring your own key (P6-03), in the browser. The e2e server runs in forced demo mode with no
 * network, so only the two answers that depend on OpenAI are stood in for: the status (live on
 * the visitor's key) and the key check. Everything else — where the key is kept, which requests
 * carry it, Forget — is the real app. What the server does with the key is proven by the canary
 * route tests (`src/server/visitor-key.test.ts`).
 */
const CANARY = `sk-canary-${'Qx7'.repeat(12)}`;
const HEADER = 'x-openai-key';
const STORAGE = 'dear-steven-openai-key';
const copy = en.setup.ownKey;

const statusFor = (own: boolean): KnowledgeStatus => ({
  mode: own ? 'live' : 'demo',
  demoReason: own ? null : 'no_openai_key',
  episodes: own ? 114 : 3,
  passages: own ? 8394 : 0,
  embeddedPassages: own ? 8394 : 0,
  diarizedEpisodes: 0,
  youtubeLinkedEpisodes: 0,
  lastIndexedAt: null,
  storeError: null,
  spend: { todayUsd: 0, capUsd: null },
  setup: { openaiKey: own, visitorKey: own, youtubeKey: false, database: own },
});

/** Stands in for OpenAI and records which requests carried the key. */
async function standIn(page: Page) {
  const sent: { url: string; key: string | undefined }[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) {
      sent.push({ url: r.url(), key: r.headers()[HEADER] });
    }
  });
  await page.route('**/api/status', (route) =>
    route.fulfill({ json: statusFor(route.request().headers()[HEADER] === CANARY) }),
  );
  await page.route('**/api/key', (route) =>
    route.request().headers()[HEADER] === CANARY
      ? route.fulfill({ json: { ok: true } })
      : route.fulfill({
          status: 400,
          json: { error: { code: 'not_configured', message: en.serverErrors.yourKeyRejected } },
        }),
  );
  return sent;
}

const stored = (page: Page) =>
  page.evaluate(
    (k) => ({ tab: sessionStorage.getItem(k), device: localStorage.getItem(k) }),
    STORAGE,
  );

const openSetup = async (page: Page) => {
  await page.getByTestId('status-pill').click();
  const dialog = page.getByRole('dialog', { name: en.setup.title });
  await expect(dialog).toBeVisible();
  return dialog;
};

const closeSetup = (page: Page) => page.getByRole('button', { name: en.ui.close }).click();

test('paste a key, test it, ask on it, then forget it', async ({ page }) => {
  // Two full demo answers.
  test.slow();
  const sent = await standIn(page);
  await page.goto('/');
  await expect(page.getByTestId('status-pill')).toHaveAttribute('data-state', 'demo');
  const setup = await openSetup(page);

  const field = page.getByLabel(copy.label);
  await field.fill(`sk-wrong-${'0'.repeat(30)}`);
  await page.getByRole('button', { name: copy.use }).click();
  await expect(setup.getByRole('alert')).toHaveText(en.serverErrors.yourKeyRejected);
  expect(await stored(page)).toEqual({ tab: null, device: null });

  await field.fill('not a key');
  await page.getByRole('button', { name: copy.use }).click();
  await expect(setup.getByRole('alert')).toHaveText(en.serverErrors.keyMalformed);

  await field.fill(CANARY);
  await page.getByRole('button', { name: copy.use }).click();
  await expect(page.getByText(copy.using(false))).toBeVisible();
  await expect(page.getByLabel(copy.label)).toHaveCount(0);
  await expect(page.getByTestId('status-pill')).toContainText('on your key');
  expect(await stored(page)).toEqual({ tab: CANARY, device: null });

  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(audit.violations.map((v) => v.id)).toEqual([]);

  await closeSetup(page);
  const composer = page.getByRole('textbox', { name: en.composer.label });
  await composer.fill('How do I stop procrastinating?');
  await composer.press('Enter');
  await expect(page.getByText(en.turn.complete).last()).toBeAttached({ timeout: 15_000 });
  const asked = sent.filter((r) => r.url.endsWith('/api/ask'));
  expect(asked.map((r) => r.key)).toEqual([CANARY]);

  await openSetup(page);
  await page.getByRole('button', { name: copy.forget }).click();
  await expect(page.getByLabel(copy.label)).toBeVisible();
  await expect(page.getByTestId('status-pill')).not.toContainText('on your key');
  expect(await stored(page)).toEqual({ tab: null, device: null });

  await closeSetup(page);
  await composer.fill('And how do I keep going?');
  await composer.press('Enter');
  await expect(page.getByText(en.turn.complete)).toHaveCount(2, { timeout: 15_000 });
  expect(sent.filter((r) => r.url.endsWith('/api/ask')).map((r) => r.key)).toEqual([
    CANARY,
    undefined,
  ]);
  expect(sent.every((r) => !r.url.includes(CANARY))).toBe(true);
  expect(page.url()).not.toContain(CANARY);
});

test('"remember on this device" survives a reload, and Forget clears it', async ({ page }) => {
  await standIn(page);
  await page.goto('/');
  await openSetup(page);
  await page.getByLabel(copy.label).fill(CANARY);
  await page.getByLabel(copy.remember).check();
  await page.getByRole('button', { name: copy.use }).click();
  await expect(page.getByText(copy.using(true))).toBeVisible();
  expect(await stored(page)).toEqual({ tab: null, device: CANARY });

  await page.reload();
  await expect(page.getByTestId('status-pill')).toContainText('on your key');
  await openSetup(page);
  await expect(page.getByText(copy.using(true))).toBeVisible();
  await page.getByRole('button', { name: copy.forget }).click();
  expect(await stored(page)).toEqual({ tab: null, device: null });
});

test('with storage blocked, says the key can’t be kept and never sends it', async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, name, {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    }
  });
  const sent = await standIn(page);
  await page.goto('/');
  const setup = await openSetup(page);
  await page.getByLabel(copy.label).fill(CANARY);
  await page.getByRole('button', { name: copy.use }).click();
  await expect(setup.getByRole('alert')).toHaveText(copy.noStorage);
  await expect(page.getByTestId('status-pill')).not.toContainText('on your key');
  expect(sent.filter((r) => r.key && !r.url.endsWith('/api/key'))).toEqual([]);
});
