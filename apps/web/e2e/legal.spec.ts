import AxeBuilder from '@axe-core/playwright';
import { CONTACT, CONTACT_PENDING, OPERATOR, OPERATOR_PENDING } from '../src/content/policies';
import { en } from '../src/i18n/en';
import { expect, type Page, test } from './fixtures';

const legalLink = (scope: Pick<Page, 'getByRole'>) =>
  scope.getByRole('link', { name: 'Legal notice' });

test.describe('the legal notice (#116)', () => {
  test('says who runs this copy, or that it is still to come, and links to the terms', async ({
    page,
  }) => {
    await page.goto('/legal');
    await expect(page).toHaveTitle(/legal notice/);
    await expect(page.getByRole('heading', { level: 1, name: 'Legal notice' })).toBeVisible();
    await expect(page.getByText(en.disclosure)).toBeVisible();
    const operator = page.getByRole('heading', { level: 2, name: 'Who runs this copy' });
    await expect(operator).toBeVisible();
    if (OPERATOR) {
      await expect(page.getByText(OPERATOR.name)).toBeVisible();
      await expect(page.getByRole('link', { name: OPERATOR.email })).toHaveAttribute(
        'href',
        `mailto:${OPERATOR.email}`,
      );
    } else {
      // Pending until the owner fills in the details: marked, never invented.
      await expect(page.getByText(OPERATOR_PENDING)).toBeVisible();
      await expect(page.locator('address')).toHaveCount(0);
    }
    await expect(page.getByText(CONTACT ?? CONTACT_PENDING)).toBeVisible();
    await page.getByRole('link', { name: 'Terms, disclaimer and privacy' }).click();
    await expect(page).toHaveURL(/\/terms$/);
  });

  test('sits beside the terms in the first-visit notice and in “How this works”', async ({
    page,
  }) => {
    await page.goto('/');
    const notice = page.getByRole('region', { name: 'Before you start' });
    await expect(legalLink(notice)).toHaveAttribute('href', '/legal');
    await notice.getByRole('button', { name: 'Got it' }).click();
    await page.getByRole('button', { name: /How this works|About/ }).click();
    const about = page.getByRole('dialog', { name: /An AI persona with receipts/ });
    await expect(legalLink(about)).toHaveAttribute('href', '/legal');
  });

  test('is two clicks from a conversation: the terms under the composer, then the legal notice', async ({
    page,
  }) => {
    await page.goto('/');
    const box = page.getByRole('textbox', { name: 'Ask Steven' });
    await box.fill('How do I build discipline?');
    await box.press('Enter');
    await expect(page.getByText('Answer complete.')).toBeAttached({ timeout: 15_000 });
    // The line under the composer keeps to the terms, so it stays two lines on a phone (P10-11).
    await page.getByRole('link', { name: en.terms.link }).last().click();
    await expect(page).toHaveURL(/\/terms$/);
    await legalLink(page.getByRole('navigation', { name: en.termsPage.onThisPage })).click();
    await expect(page).toHaveURL(/\/legal$/);
  });

  test('is linked from the top of the terms page', async ({ page }) => {
    await page.goto('/terms');
    await legalLink(page.getByRole('navigation', { name: en.termsPage.onThisPage })).click();
    await expect(page).toHaveURL(/\/legal$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Legal notice' })).toBeVisible();
  });

  test('the privacy notice names its controller in the same words', async ({ page }) => {
    await page.goto('/terms#privacy');
    const privacy = page.locator('section#privacy');
    await expect(
      privacy.getByRole('heading', { level: 3, name: 'Who is responsible' }),
    ).toBeVisible();
    await expect(privacy.getByText(OPERATOR ? OPERATOR.name : OPERATOR_PENDING)).toBeVisible();
  });

  test('passes an accessibility audit', async ({ page }) => {
    await page.goto('/legal');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
