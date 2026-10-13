import AxeBuilder from '@axe-core/playwright';
import { de } from '../src/i18n/de';
import { en } from '../src/i18n/en';
import { expect, type Page, test } from './fixtures';

/**
 * Reading a conversation's summary in the explorer (P8-04), in demo mode: the fixture summaries
 * (labelled demo), each moment opening the evidence drawer at its passage, and back again.
 */
type Copy = typeof en;
const COACH = 'Demo Episode: Habits That Survive Bad Days (fixture)';

async function openSummary(page: Page, copy: Copy, title: string) {
  await page.goto('/');
  await page.getByRole('button', { name: copy.terms.dismiss }).click();
  await page.getByTestId('status-pill').click();
  await page.getByRole('button', { name: copy.setup.browse(3) }).click();
  const explorer = page.getByRole('dialog', { name: copy.explorer.title });
  await explorer.getByRole('button', { name: copy.explorer.summary.openLabel(title) }).click();
  await expect(explorer.getByRole('heading', { name: title })).toBeFocused();
  return explorer;
}

test('a summary to read in a minute, and every moment opens where it was said', async ({
  page,
}) => {
  const explorer = await openSummary(page, en, COACH);
  const copy = en.explorer.summary;
  for (const heading of [copy.about, copy.topics, copy.moments, copy.exchanges]) {
    await expect(explorer.getByRole('heading', { name: new RegExp(`^${heading}`) })).toBeVisible();
  }
  await expect(explorer.getByText(copy.machine).first()).toBeVisible();
  await expect(explorer.getByText(copy.unverified).first()).toBeVisible();
  await expect(explorer.getByText(/^Demo summary \(fixture\):/)).toBeVisible();
  // Quotes are the original English, whatever the interface language.
  await expect(explorer.locator('blockquote [lang="en"]').first()).toBeVisible();

  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(audit.violations.map((v) => v.id)).toEqual([]);

  // A moment opens the drawer at its passage, among the summary's other items (two topics, this
  // moment, a question and its answer), without naming a speaker.
  const moment = 'make the minimum so small that you never miss it twice';
  await explorer.getByRole('button', { name: new RegExp(moment) }).click();
  const drawer = page.getByRole('dialog', { name: en.inspector.label });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(/never miss it twice/).first()).toBeVisible();
  await expect(drawer.getByText(en.inspector.position(3, 5))).toBeVisible();
  await expect(drawer.getByText(/Said by/)).toHaveCount(0);

  // Closing it brings the summary back.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: en.explorer.title })).toBeVisible();
  await expect(explorer.getByRole('heading', { name: COACH })).toBeVisible();
  await explorer.getByRole('button', { name: copy.back }).click();
  await expect(explorer.getByRole('listitem')).toHaveCount(3);
});

test.describe('in a German browser', () => {
  test.use({ locale: 'de-DE' });

  test('the summary speaks German around the original English', async ({ page }) => {
    const explorer = await openSummary(page, de, COACH);
    const copy = de.explorer.summary;
    for (const heading of [copy.about, copy.topics, copy.moments, copy.exchanges]) {
      await expect(
        explorer.getByRole('heading', { name: new RegExp(`^${heading}`) }),
      ).toBeVisible();
    }
    await expect(explorer.getByText(copy.original)).toBeVisible();
    await expect(explorer.getByRole('button', { name: copy.back })).toBeVisible();
  });
});
