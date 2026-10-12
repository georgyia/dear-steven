import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const notice = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'Before you start' });

test.describe('terms, disclaimer and the first-visit notice (P6-12)', () => {
  test('the first visit says what this is, once per browser, and the keyboard can dismiss it', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toContainText('not Steven Bartlett');
    await expect(notice(page)).toContainText('nothing I say is medical, legal or financial advice');
    await notice(page).getByRole('button', { name: 'Got it' }).focus();
    await page.keyboard.press('Enter');
    await expect(notice(page)).toHaveCount(0);
    // The plain disclosure, with the terms one click away, takes its place.
    await expect(page.getByText(/is an AI persona — not Steven Bartlett/)).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Dear Steven' })).toBeVisible();
    await page.waitForTimeout(300);
    await expect(notice(page)).toHaveCount(0);
  });

  test('every screen links to the terms', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Terms & disclaimer' }).first()).toHaveAttribute(
      'href',
      '/terms',
    );
    const box = page.getByRole('textbox', { name: 'Ask Steven' });
    await box.fill('How do I build discipline?');
    await box.press('Enter');
    await expect(page.getByText('Answer complete.')).toBeAttached({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Terms & disclaimer' }).last()).toHaveAttribute(
      'href',
      '/terms',
    );
    await page.getByRole('button', { name: /How this works|About/ }).click();
    const about = page.getByRole('dialog', { name: /An AI persona with receipts/ });
    await expect(about.getByRole('link', { name: 'Terms & disclaimer' })).toHaveAttribute(
      'href',
      '/terms',
    );
  });

  test('the terms page: disclaimer, terms and privacy, with the takedown contact marked as to come', async ({
    page,
  }) => {
    await page.goto('/');
    await notice(page).getByRole('link', { name: 'Terms & disclaimer' }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Terms, disclaimer and privacy' }),
    ).toBeVisible();
    for (const name of ['Disclaimer', 'Terms of use', 'Privacy']) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    await expect(page.getByText(/not affiliated with, endorsed by or speaking for/)).toBeVisible();
    await expect(page.getByText(/provided as is, without any warranty/)).toBeVisible();
    await expect(page.getByText(/TODO \(owner\): a contact address/).first()).toBeVisible();
    await expect(
      page.getByRole('link', { name: /PolyForm Noncommercial License/ }),
    ).toHaveAttribute('href', 'https://polyformproject.org/licenses/noncommercial/1.0.0');
    await page.getByRole('link', { name: '← Dear Steven' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Dear Steven' })).toBeVisible();
  });

  test('the terms page passes an accessibility audit', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
