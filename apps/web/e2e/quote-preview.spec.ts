import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** A demo answer, with the first-visit and demo notices read and closed. */
async function answer(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Got it' }).click();
  await page
    .getByRole('region', { name: 'Notifications' })
    .getByRole('button', { name: 'Close' })
    .first()
    .click();
  const box = page.getByRole('textbox', { name: 'Ask Steven' });
  await box.fill('Why do I keep procrastinating?');
  await box.press('Enter');
  await expect(page.getByText('Answer complete.').last()).toBeAttached({ timeout: 15_000 });
}

const preview = (page: Page) => page.getByRole('tooltip');

test.describe('the quote preview on a source (P7-03)', () => {
  test('hovering a source shows the quote, who said it, when, and where a click goes', async ({
    page,
  }) => {
    await answer(page);
    const chip = page.locator('[data-citation]').first();
    await chip.scrollIntoViewIfNeeded();
    // Move onto it again until it opens: the answer can still be settling under the pointer.
    await expect(async () => {
      await chip.hover();
      await expect(preview(page)).toBeVisible({ timeout: 1500 });
    }).toPass();
    await expect(preview(page)).toContainText('Click to open the source');
    await expect(preview(page)).toContainText(/\d+:\d\d/);
    await expect(preview(page)).toContainText(/verified speaker|speaker not verified/i);
    // The words are the stored English transcript, set as a quotation.
    await expect(preview(page).locator('[lang="en"]').first()).toBeVisible();
    // Readable width: at least 18rem, or the screen minus a margin on a phone.
    const width = (await preview(page).boundingBox())?.width ?? 0;
    const viewport = page.viewportSize()?.width ?? 0;
    expect(width).toBeGreaterThanOrEqual(Math.min(288, viewport - 48));
    expect(width).toBeLessThanOrEqual(viewport);
  });

  test('it opens on keyboard focus too, and passes an accessibility audit', async ({ page }) => {
    await answer(page);
    const chip = page.locator('[data-citation]').first();
    await chip.focus();
    await expect(preview(page)).toBeVisible();
    await page.waitForTimeout(400);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
