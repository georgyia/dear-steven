import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { en } from '../src/i18n/en';
import { expect, type Page, test } from './fixtures';

/**
 * Share an answer (P6-17). A link opens the very answer that was written, with its sources, on a
 * fresh page; a link that was changed opens nothing; the image card downloads. That an edited
 * token can't open is proven byte by byte in `src/server/share.test.ts`.
 */
const QUESTION = 'Why do I keep procrastinating?';
const copy = en.share;

const dismissDemoNotice = async (page: Page) => {
  // The demo notice follows the first-visit notice (P7-04).
  await page
    .getByRole('region', { name: en.terms.noticeLabel })
    .getByRole('button', { name: en.terms.dismiss })
    .click();
  const notices = page.getByRole('region', { name: 'Notifications' });
  await notices.getByRole('button', { name: en.ui.close }).first().click();
  await expect(notices.getByText(en.demoNotice.title)).toHaveCount(0);
};

const ask = async (page: Page, question: string) => {
  await dismissDemoNotice(page);
  const box = page.getByRole('textbox', { name: en.composer.label });
  await box.fill(question);
  await box.press('Enter');
  await expect(page.getByText(en.turn.complete).last()).toBeAttached({ timeout: 15_000 });
};

/** What a reader can check: the answer's words, its quotes and its source chips. */
const answerOf = async (page: Page) => {
  const turn = page.locator('article').last();
  return {
    question: await turn.getByRole('heading', { level: 2 }).innerText(),
    quotes: await turn.locator('blockquote').allInnerTexts(),
    sources: await turn
      .locator('[data-citation]')
      .evaluateAll((chips) => chips.map((c) => c.getAttribute('data-citation'))),
  };
};

const copiedLink = async (page: Page) => {
  await page.getByRole('button', { name: copy.copyLink }).click();
  await expect(page.getByText(copy.copied)).toBeVisible();
  return page.evaluate(() => navigator.clipboard.readText());
};

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test('a copied link opens the same answer, sources and all, on a fresh page', async ({ page }) => {
  test.slow(); // a full answer, then a second load
  await page.goto('/');
  await ask(page, QUESTION);
  const written = await answerOf(page);
  expect(written.quotes.length).toBeGreaterThan(0);
  expect(written.sources.length).toBeGreaterThan(0);
  const link = await copiedLink(page);
  expect(link).toMatch(/\/#share=v1\.[\w-]+\.[\w-]{43}$/);

  await page.goto('about:blank');
  await page.goto(link);
  await expect(page.getByText(copy.openedTitle)).toBeVisible();
  await expect(page.getByText(copy.tag, { exact: true })).toBeVisible();
  await expect(page.getByText(en.turn.demoTag)).toBeVisible();
  expect(await answerOf(page)).toEqual(written);
  await expect(page.getByText(en.disclosure).first()).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');

  await page.locator('article [data-citation]').first().click();
  await expect(page.getByRole('dialog', { name: en.inspector.label })).toBeVisible();
  await page.keyboard.press('Escape');

  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(audit.violations.map((v) => v.id)).toEqual([]);

  await page.screenshot({
    path: `e2e/screenshots/p6-17-shared-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('a link that was changed opens nothing, and says so', async ({ page }) => {
  await page.goto('/');
  await ask(page, QUESTION);
  const link = await copiedLink(page);
  const [base, mac] = [link.slice(0, -43), link.slice(-43)];
  const forged = `${base}${mac[0] === 'A' ? 'B' : 'A'}${mac.slice(1)}`;

  await page.goto('about:blank');
  await page.goto(forged);
  await expect(page.getByText(copy.failedTitle)).toBeVisible();
  await expect(page.getByText(en.serverErrors.shareBroken)).toBeVisible();
  await expect(page.locator('article')).toHaveCount(0);
});

test('the image card downloads as a PNG', async ({ page }) => {
  await page.goto('/');
  await ask(page, QUESTION);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: copy.saveImage }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(copy.fileName);
  const path = `e2e/screenshots/p6-17-card-${test.info().project.name}.png`;
  await download.saveAs(path);
  const png = readFileSync(path);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(1080);
});
