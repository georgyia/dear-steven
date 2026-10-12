import type { Page } from '@playwright/test';
import { de } from '../src/i18n/de';
import { en, type Messages } from '../src/i18n/en';
import { expect, test } from './fixtures';

/**
 * No "·" separators anywhere a visitor can see or hear them (P7-02): the visible text and every
 * accessible label, across home, an answer, the inspector and each dialog, in both languages.
 */
const seen = async (page: Page) =>
  page.evaluate(() => {
    const labels = [...document.querySelectorAll('[aria-label],[title],[alt]')].map((el) =>
      ['aria-label', 'title', 'alt'].map((a) => el.getAttribute(a) ?? '').join(' '),
    );
    return [document.body.innerText, document.title, ...labels].join('\n');
  });

const dotted = (text: string) =>
  text
    .split('\n')
    .filter((line) => line.includes('·'))
    .map((line) => line.trim());

async function walk(page: Page, m: Messages) {
  const found: string[] = [];
  const check = async () => found.push(...dotted(await seen(page)));

  await page.goto('/');
  await check();
  await page
    .getByRole('region', { name: m.terms.noticeLabel })
    .getByRole('button', { name: m.terms.dismiss })
    .click();
  await check(); // the demo notice
  await page.getByTestId('status-pill').click();
  await check(); // setup
  await page.getByRole('button', { name: m.setup.browse(3) }).click();
  await check(); // explorer
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: new RegExp(`${m.stage.howItWorks}|${m.stage.about}`) })
    .click();
  await check(); // how this works
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: m.stage.voiceSettings }).click();
  await check(); // voice settings
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: m.home.examples[0] }).click();
  await expect(page.getByText(m.turn.complete).last()).toBeAttached({ timeout: 15_000 });
  await check(); // an answer
  // Hover until the preview opens: the answer can still be settling under the pointer.
  await expect(async () => {
    await page.locator('[data-citation]').first().hover();
    await expect(page.getByRole('tooltip')).toBeVisible({ timeout: 1500 });
  }).toPass();
  await check(); // the quote preview
  await page.locator('[data-citation]').first().click();
  for (const tab of [m.inspector.tabs.context, m.inspector.tabs.video, m.inspector.tabs.quote]) {
    await page.getByRole('radio', { name: tab }).click();
    await check(); // each inspector tab
  }
  return [...new Set(found)];
}

test('English: no middle-dot separators anywhere', async ({ page }) => {
  test.slow();
  expect(await walk(page, en)).toEqual([]);
});

test.describe('German', () => {
  test.use({ locale: 'de-DE' });
  test('German: no middle-dot separators anywhere', async ({ page }) => {
    test.slow();
    expect(await walk(page, de)).toEqual([]);
  });
});
