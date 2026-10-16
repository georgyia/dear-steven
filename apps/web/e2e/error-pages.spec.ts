import AxeBuilder from '@axe-core/playwright';
import { de } from '../src/i18n/de';
import { en } from '../src/i18n/en';
import { expect, type Page, test } from './fixtures';

/**
 * An unknown address and a crash land on a calm page in the product's design (P10-09), under the
 * strict CSP (the fixture fails a test on any violation), at 375 px (mobile) and 1280 px (desktop).
 */
const axeClean = async (page: Page) => {
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(audit.violations.map((v) => v.id)).toEqual([]);
};

// Contrast is measured on rendered pixels, so a page still fading in can fail at random under load;
// the settled colours are the same with reduced motion, which keeps these audits deterministic (as in
// a11y.spec.ts).
test.use({ reducedMotion: 'reduce' });

test.describe('an unknown address (P10-09)', () => {
  test('is a 404 in Dear Steven’s design, with the way home', async ({ page }) => {
    const res = await page.goto('/no-such-page');
    expect(res?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { level: 1, name: en.fallback.notFound.title }),
    ).toBeVisible();
    await expect(page).toHaveTitle(`${en.fallback.notFound.eyebrow}: Dear Steven`);
    await expect(page.getByText(en.disclosure)).toBeVisible();
    await axeClean(page);
    // No horizontal scroll at any width.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()?.width ?? 0,
    );

    await page.getByRole('link', { name: en.fallback.notFound.home }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('textbox', { name: en.composer.label })).toBeVisible();
  });

  test('the wordmark leads home too', async ({ page }) => {
    await page.goto('/no/such/page');
    await page.getByRole('link', { name: `Dear Steven${en.stage.newConversationSr}` }).click();
    await expect(page.getByRole('textbox', { name: en.composer.label })).toBeVisible();
  });

  test.describe('in a German browser', () => {
    test.use({ locale: 'de-DE' });

    test('says so in German', async ({ page }) => {
      await page.goto('/gibt-es-nicht');
      await expect(page.locator('html')).toHaveAttribute('lang', 'de');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(de.fallback.notFound.title);
      await expect(page.getByRole('link', { name: de.fallback.notFound.home })).toBeVisible();
    });
  });
});

test.describe('a crash in the stage (P10-09)', () => {
  test('shows the error page, no detail, and Try again recovers', async ({ page }) => {
    // A status the page can't read (say, a proxy answering with something else) breaks the
    // stage while it renders: the stage trusts its own server's status as it comes.
    await page.route('**/api/status', (route) => route.fulfill({ json: {} }));
    await page.goto('/');
    const heading = page.getByRole('heading', { level: 1, name: en.fallback.crash.title });
    await expect(heading).toBeVisible();
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/TypeError|undefined|Cannot read|at \w+ \(/);
    await axeClean(page);

    await page.unroute('**/api/status');
    await page.getByRole('button', { name: en.turn.retry }).click();
    await expect(page.getByRole('textbox', { name: en.composer.label })).toBeVisible();
    await expect(heading).toHaveCount(0);
  });
});
