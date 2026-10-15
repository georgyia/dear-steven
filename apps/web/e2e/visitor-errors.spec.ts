import AxeBuilder from '@axe-core/playwright';
import { en } from '../src/i18n/en';
import { expect, type Page, test } from './fixtures';

/**
 * Visitors see errors in their own words (P10-08). The demo server can't fail these ways, so the
 * server's refusals are stood in for, exactly as `src/proxy.ts` and the routes send them; the rest
 * is the real page. Where asking again can't help, there is no "Try again".
 */
const refuse = (page: Page, path: string, status: number, code: string, message: string) =>
  page.route(`**${path}`, (route) => route.fulfill({ status, json: { error: { code, message } } }));

async function ask(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: en.terms.dismiss }).click();
  const box = page.getByRole('textbox', { name: en.composer.label });
  await box.fill('How do I start before I feel ready?');
  await box.press('Enter');
}

async function interview(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: en.terms.dismiss }).click();
  await page
    .getByRole('radiogroup', { name: en.modes.label })
    .getByRole('radio', { name: en.modes.interview })
    .click();
  await page.getByRole('button', { name: en.interview.start }).click();
}

const axeClean = async (page: Page) => {
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(audit.violations.map((v) => v.id)).toEqual([]);
};

test.describe('errors in the visitor’s own words (P10-08)', () => {
  test('a refusal from another site says so, and offers no retry', async ({ page }) => {
    await refuse(page, '/api/ask', 403, 'cross_site', 'Requests from other sites are refused.');
    await ask(page);
    const alert = page.getByRole('alert').filter({ hasText: en.errors.crossSite });
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText(en.errors.upstream);
    await expect(alert.getByRole('button', { name: en.turn.retry })).toHaveCount(0);
    await axeClean(page);
  });

  test('no free questions left: its own message, the way on, and no retry', async ({ page }) => {
    await refuse(page, '/api/ask', 402, 'needs_key', en.serverErrors.needsKey(3));
    await ask(page);
    const alert = page.getByRole('alert').filter({ hasText: en.errors.needsKey });
    await expect(alert).toContainText(en.serverErrors.needsKey(3));
    await expect(alert.getByRole('button', { name: en.free.useOwnKey })).toBeVisible();
    await expect(alert.getByRole('button', { name: en.turn.retry })).toHaveCount(0);
  });

  test('a rejected operator key reads as the visitor’s news, and can be retried', async ({
    page,
  }) => {
    await refuse(page, '/api/ask', 503, 'not_configured', en.serverErrors.keyRejected);
    await ask(page);
    const alert = page.getByRole('alert').filter({ hasText: en.errors.notConfigured });
    await expect(alert).toContainText(en.serverErrors.keyRejected);
    await expect(alert.getByRole('button', { name: en.turn.retry })).toBeVisible();
  });

  test('the interview says the same, and offers no retry either', async ({ page }) => {
    await refuse(page, '/api/interview', 402, 'needs_key', en.serverErrors.needsKey(3));
    await interview(page);
    const alert = page.getByRole('alert').filter({ hasText: en.errors.needsKey });
    await expect(alert).toContainText(en.serverErrors.needsKey(3));
    await expect(alert.getByRole('button', { name: en.interview.retry })).toHaveCount(0);
  });

  test('an interview step from another site says so, with no retry', async ({ page }) => {
    await refuse(
      page,
      '/api/interview',
      403,
      'cross_site',
      'Requests from other sites are refused.',
    );
    await interview(page);
    const alert = page.getByRole('alert').filter({ hasText: en.errors.crossSite });
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText('Requests from other sites are refused.');
    await expect(alert.getByRole('button', { name: en.interview.retry })).toHaveCount(0);
  });
});
