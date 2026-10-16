import type { Locator, Page } from '@playwright/test';
import { de } from '../src/i18n/de';
import { en } from '../src/i18n/en';
import { expect, test } from './fixtures';

/**
 * Wherever you talk to Dear Steven, the disclosure is in view (P10-11): Ask, Talk and the
 * interview, written or spoken. It says unofficial, AI persona and not advice, and stays short:
 * two lines at most on a phone, terms link included.
 */
const modes = (page: Page) => page.getByRole('radiogroup', { name: 'How Dear Steven replies' });

/** How many lines a block of text takes, from its height and its line height. */
const lines = (el: Locator) =>
  el.evaluate((node) => {
    const style = getComputedStyle(node);
    return Math.round(node.getBoundingClientRect().height / Number.parseFloat(style.lineHeight));
  });

const start = async (page: Page) => {
  await page.goto('/');
  const notice = page.getByRole('region', { name: 'Before you start' });
  await notice.getByRole('button', { name: 'Got it' }).click();
};

test.describe('the disclosure (P10-11)', () => {
  for (const mode of ['Ask', 'Talk', 'Interview me']) {
    test(`is in view in ${mode}, on two lines at most`, async ({ page }, info) => {
      await start(page);
      await modes(page).getByRole('radio', { name: mode }).click();
      const disclosure = page.getByText(en.disclosure).last();
      await expect(disclosure).toBeVisible();
      await expect(disclosure.getByRole('link', { name: en.terms.link })).toHaveAttribute(
        'href',
        '/terms',
      );
      if (info.project.name === 'mobile') expect(await lines(disclosure)).toBeLessThanOrEqual(2);
    });
  }

  test.describe('in a German browser', () => {
    test.use({ locale: 'de-DE' });

    test('is in view in the interview, in German, on two lines at most', async ({ page }, info) => {
      await page.goto('/');
      await page.getByRole('region', { name: de.terms.noticeLabel }).getByRole('button').click();
      await page
        .getByRole('radiogroup', { name: de.modes.label })
        .getByRole('radio', { name: de.modes.interview })
        .click();
      const disclosure = page.getByText(de.disclosure).last();
      await expect(disclosure).toBeVisible();
      if (info.project.name === 'mobile') expect(await lines(disclosure)).toBeLessThanOrEqual(2);
    });
  });
});
