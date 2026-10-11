import { expect, test } from './fixtures';

const TRANSLATION = 'Du schiebst nicht die Arbeit auf, sondern das Gefühl, das sie dir gibt.';

/**
 * Demo answers are English; this rewrites the stream as a German answer would arrive: the same
 * verbatim English quote from storage, with a model translation beside it (P6-01).
 */
test('a quote in a non-English answer stays the English words said, with the translation labelled apart', async ({
  page,
}) => {
  let stored = '';
  await page.route('**/api/ask', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .split('\n')
      .map((line) => {
        if (!line.startsWith('data: ')) return line;
        const event = JSON.parse(line.slice(6));
        const blocks = [event.block, ...(event.answer?.blocks ?? [])].filter(Boolean);
        for (const b of blocks) {
          if (b.kind !== 'quote') continue;
          b.translation = TRANSLATION;
          stored ||= b.text;
        }
        if (event.answer) event.answer.language = 'de';
        return `data: ${JSON.stringify(event)}`;
      })
      .join('\n');
    await route.fulfill({ response, body });
  });
  await page.goto('/');
  const box = page.getByRole('textbox', { name: 'Ask Steven' });
  // Any fixture with a quote; the stub above turns its answer into a German one.
  await box.fill('Why do I keep procrastinating?');
  await box.press('Enter');
  await expect(page.getByText('Answer complete.')).toBeAttached({ timeout: 15_000 });

  expect(stored).not.toBe(''); // the fixture answer has a quote
  const quote = page.locator('figure blockquote').first();
  await expect(quote).toContainText(stored);
  await expect(quote).not.toContainText(TRANSLATION);
  const translation = page.locator('figure').first().getByText(TRANSLATION);
  await expect(translation).toBeVisible();
  await expect(
    page.locator('figure').first().getByText('Translation', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('figure').first()).toContainText('verbatim from the transcript');
});
