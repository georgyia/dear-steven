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

/**
 * Where the key is kept, as the browser holds it (P8-01): what each storage contains, whether the
 * key appears as plain text anywhere a program reading the browser's files could find it, and
 * whether the key that sealed it can be exported.
 */
const stored = (page: Page) =>
  page.evaluate(async (k) => {
    const everything = [sessionStorage, localStorage].flatMap((store) =>
      Object.keys(store).map((name) => `${name}=${store.getItem(name)}`),
    );
    // Opened only if it exists: opening a database that doesn't creates it.
    const exists = (await indexedDB.databases()).some((d) => d.name === 'dear-steven-key-vault');
    const vault = !exists
      ? null
      : await new Promise<CryptoKey | null>((resolve) => {
          const req = indexedDB.open('dear-steven-key-vault');
          req.onsuccess = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('keys')) {
              db.close();
              return resolve(null);
            }
            const get = db.transaction('keys').objectStore('keys').get('seal');
            get.onsuccess = () => {
              db.close();
              resolve((get.result as CryptoKey | undefined) ?? null);
            };
          };
          req.onerror = () => resolve(null);
        });
    return {
      tab: sessionStorage.getItem(k),
      device: localStorage.getItem(k),
      plain: everything.some((entry) => entry.includes('sk-')),
      sealingKey: vault && { extractable: vault.extractable, type: vault.algorithm.name },
    };
  }, STORAGE);

const SEALED_IN_TAB = /^v1\.tab\.0\.[\w-]+\.[\w-]+$/;
const SEALED_ON_DEVICE = /^v1\.device\.\d{13}\.[\w-]+\.[\w-]+$/;
const NON_EXPORTABLE = { extractable: false, type: 'AES-GCM' };
const NOTHING = { tab: null, device: null, plain: false, sealingKey: null };

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
  expect(await stored(page)).toEqual(NOTHING);

  await field.fill('not a key');
  await page.getByRole('button', { name: copy.use }).click();
  await expect(setup.getByRole('alert')).toHaveText(en.serverErrors.keyMalformed);

  await field.fill(CANARY);
  await page.getByRole('button', { name: copy.use }).click();
  await expect(page.getByText(copy.using(false))).toBeVisible();
  await expect(page.getByLabel(copy.label)).toHaveCount(0);
  await expect(page.getByTestId('status-pill')).toContainText('on your key');
  expect(await stored(page)).toEqual({
    tab: expect.stringMatching(SEALED_IN_TAB),
    device: null,
    plain: false,
    sealingKey: NON_EXPORTABLE,
  });

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
  expect(await stored(page)).toEqual(NOTHING);

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
  const remembered = await stored(page);
  expect(remembered).toEqual({
    tab: null,
    device: expect.stringMatching(SEALED_ON_DEVICE),
    plain: false,
    sealingKey: NON_EXPORTABLE,
  });
  // Remembered for 30 days from now.
  const expires = Number(remembered.device?.split('.')[2]);
  expect(Math.round((expires - Date.now()) / 86_400_000)).toBe(30);

  await page.reload();
  await expect(page.getByTestId('status-pill')).toContainText('on your key');
  await openSetup(page);
  await expect(page.getByText(copy.using(true))).toBeVisible();
  await page.getByRole('button', { name: copy.forget }).click();
  await expect(page.getByLabel(copy.label)).toBeVisible();
  expect(await stored(page)).toEqual(NOTHING);
});

test('a sealed key that was altered, or kept as plain text before, is never sent as it was', async ({
  page,
}) => {
  const sent = await standIn(page);
  await page.goto('/');
  await openSetup(page);
  await page.getByLabel(copy.label).fill(CANARY);
  await page.getByLabel(copy.remember).check();
  await page.getByRole('button', { name: copy.use }).click();
  await expect(page.getByText(copy.using(true))).toBeVisible();

  // Given a longer life by hand: the expiry is sealed with the key, so it no longer opens.
  await page.evaluate((k) => {
    const [v, where, , iv, data] = (localStorage.getItem(k) ?? '').split('.');
    localStorage.setItem(k, [v, where, String(Date.now() + 20 * 86_400_000), iv, data].join('.'));
  }, STORAGE);
  sent.length = 0;
  await page.reload();
  await expect(page.getByTestId('status-pill')).not.toContainText('on your key');
  expect((await stored(page)).device).toBe(null);
  expect(sent.filter((r) => r.key)).toEqual([]);

  // A key kept as plain text by an earlier version is sealed on first use, and still works.
  await page.evaluate(([k, key]) => sessionStorage.setItem(k, key), [STORAGE, CANARY]);
  await page.reload();
  await expect(page.getByTestId('status-pill')).toContainText('on your key');
  expect(await stored(page)).toMatchObject({
    tab: expect.stringMatching(SEALED_IN_TAB),
    plain: false,
  });
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
