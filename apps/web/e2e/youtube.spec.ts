import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from './fixtures';
import { answerWithMedia, VIDEO } from './media-stub';

const CHANNEL = 'https://www.youtube.com/channel/UCGq-a57w-aPwyi3pW7XLiHw';

const cards = (page: Page) => page.getByRole('region', { name: 'Conversations cited' });

test.describe('sending people to the originals', () => {
  test('every cited conversation links to its video at the first moment cited, loading nothing', async ({
    page,
  }) => {
    const thirdParty = await answerWithMedia(page);
    const links = cards(page).getByRole('link', { name: /^Watch on YouTube · ≈\s\d+:\d\d/ });
    await expect(links.first()).toBeVisible();
    const count = await cards(page).getByRole('listitem').count();
    await expect(links).toHaveCount(count);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute(
        'href',
        new RegExp(`^https://www\\.youtube\\.com/watch\\?v=${VIDEO}&t=\\d+s$`),
      );
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    // Links are plain anchors: nothing is fetched from YouTube until someone follows one.
    expect(thirdParty).toEqual([]);
  });

  test('every answer ends with an invitation to watch the show', async ({ page }) => {
    await answerWithMedia(page);
    await expect(cards(page).getByText(/worth watching in full/)).toBeVisible();
    await expect(
      cards(page).getByRole('link', { name: /The Diary Of A CEO on YouTube/ }),
    ).toHaveAttribute('href', CHANNEL);
  });

  test('a conversation without a video says so instead of linking nowhere', async ({ page }) => {
    await page.goto('/');
    const box = page.getByRole('textbox', { name: 'Ask Steven' });
    await box.fill('How do I build discipline?');
    await box.press('Enter');
    await expect(page.getByText('Answer complete.')).toBeAttached({ timeout: 15_000 });
    // Demo fixtures have no recordings, and are labelled as fixtures.
    const notes = cards(page).getByText('Fixture · no video');
    await expect(notes.first()).toBeVisible();
    await expect(notes).toHaveCount(await cards(page).getByRole('listitem').count());
    await expect(cards(page).getByRole('link', { name: /^Watch on YouTube/ })).toHaveCount(0);
  });

  test('the episode explorer links matched episodes and names the rest', async ({ page }) => {
    await page.route('**/api/episodes**', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.episodes[0].youtubeUrl = `https://www.youtube.com/watch?v=${VIDEO}`;
      body.episodes[0].video = 'estimated';
      await route.fulfill({ response, json: body });
    });
    await page.goto('/');
    await page.getByTestId('status-pill').click();
    await page.getByRole('button', { name: /Browse the 3 conversations/ }).click();
    const explorer = page.getByRole('dialog', { name: 'The conversations I know' });
    await expect(explorer).toBeVisible();
    await expect(explorer.getByRole('link', { name: /^Watch on YouTube/ })).toHaveCount(1);
    await expect(explorer.getByRole('link', { name: /^Watch on YouTube/ })).toHaveAttribute(
      'href',
      `https://www.youtube.com/watch?v=${VIDEO}`,
    );
    await expect(explorer.getByText('Fixture · no video').first()).toBeVisible();
  });

  test('"How this works" says why, and links to the channel', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /How this works|About/ }).click();
    const about = page.getByRole('dialog', { name: /An AI persona with receipts/ });
    await expect(about.getByRole('heading', { name: 'Watch the originals' })).toBeVisible();
    await expect(about.getByText(/best way to support the people who made them/)).toBeVisible();
    await expect(
      about.getByRole('link', { name: /The Diary Of A CEO on YouTube/ }),
    ).toHaveAttribute('href', CHANNEL);
  });

  test('the answer with its video links passes an accessibility audit', async ({ page }) => {
    await answerWithMedia(page);
    await page.waitForTimeout(900);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
