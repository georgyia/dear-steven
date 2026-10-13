import { expect, test } from './fixtures';

test.describe('new episodes (P6-16)', () => {
  test('the explorer marks an episode published this week, and only that one', async ({ page }) => {
    await page.route('**/api/episodes**', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.episodes[0].publishedAt = new Date(Date.now() - 86_400_000).toISOString();
      await route.fulfill({ response, json: body });
    });
    await page.goto('/');
    await page.getByTestId('status-pill').click();
    await page.getByRole('button', { name: /Browse the 3 conversations/ }).click();
    const explorer = page.getByRole('dialog', { name: 'The conversations I know' });
    await expect(explorer).toBeVisible();

    const rows = explorer.getByRole('listitem');
    await expect(rows.first().getByText('New', { exact: true })).toBeVisible();
    await expect(explorer.getByText('New', { exact: true })).toHaveCount(1);
  });
});
