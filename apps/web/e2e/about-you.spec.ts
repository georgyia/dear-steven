import { expect, type Page, test } from './fixtures';

/**
 * What Dear Steven keeps about you (P7-08), in demo mode: nothing stored until you choose to keep
 * it, exactly what is shown is what is sent, and Forget deletes it at once.
 */
const DB = 'dear-steven-about-you';
const modes = (page: Page) => page.getByRole('radiogroup', { name: 'How Dear Steven replies' });

const hasDatabase = (page: Page) =>
  page.evaluate(async (name) => (await indexedDB.databases()).some((d) => d.name === name), DB);

/** Every `about` sent with a question, in order (undefined when none was sent). */
async function recordAsks(page: Page) {
  const sent: (string | undefined)[] = [];
  await page.route('**/api/ask', async (route) => {
    sent.push((route.request().postDataJSON() as { about?: string }).about);
    await route.continue();
  });
  return sent;
}

async function ask(page: Page, question: string) {
  const box = page.getByRole('textbox', { name: 'Ask Steven' });
  await box.fill(question);
  await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
  await box.press('Enter');
  await expect(page.getByText('Answer complete.').last()).toBeAttached({ timeout: 15_000 });
}

async function interviewAndKeep(page: Page) {
  await modes(page).getByRole('radio', { name: 'Interview me' }).click();
  await page.getByRole('button', { name: 'Start the interview' }).click();
  const answer = page.getByRole('textbox', { name: 'Your answer' });
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
  await answer.fill('I run a small design studio in Leeds, mostly brands for food start-ups.');
  await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
  await answer.press('Enter');
  await page.getByRole('button', { name: 'End the interview' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you.' })).toBeVisible();
  expect(await hasDatabase(page)).toBe(false); // nothing kept until asked
  await page.getByRole('button', { name: 'Keep this on this device' }).click();
  await expect(
    page.getByText('Kept on this device. My answers will take it into account.'),
  ).toBeVisible();
  expect(await hasDatabase(page)).toBe(true);
}

test.describe('what Dear Steven keeps about you (P7-08)', () => {
  test('kept only on request, sent exactly as shown, and forgotten at once', async ({ page }) => {
    test.slow(); // an interview, three answers and a reload
    const sent = await recordAsks(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Got it' }).click();

    await ask(page, 'How do I build discipline?');
    expect(sent).toEqual([undefined]);
    expect(await hasDatabase(page)).toBe(false);

    await interviewAndKeep(page);
    await modes(page).getByRole('radio', { name: 'Ask' }).click();
    const kept = page.getByRole('region', { name: 'About you' }).getByRole('textbox');
    await expect(kept).toBeVisible();
    const shown = await kept.inputValue();
    expect(shown.length).toBeGreaterThan(0);

    await ask(page, 'Should I start a business?');
    expect(sent.at(-1)).toBe(shown);

    // Edited: what is sent follows what is shown.
    await kept.fill('I run a small design studio in Leeds.');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
    await ask(page, 'Why do I keep procrastinating?');
    expect(sent.at(-1)).toBe('I run a small design studio in Leeds.');

    // Kept across a reload, on this device.
    await page.reload();
    await ask(page, 'How do I build discipline?');
    await expect(page.getByRole('region', { name: 'About you' }).getByRole('textbox')).toHaveValue(
      'I run a small design studio in Leeds.',
    );
    expect(sent.at(-1)).toBe('I run a small design studio in Leeds.');

    // Forget: gone at once, and nothing is sent after.
    await page
      .getByRole('region', { name: 'About you' })
      .getByRole('button', { name: 'Forget it' })
      .click();
    await expect(page.getByText('Forgotten. Nothing about you is kept now.')).toBeVisible();
    expect(await hasDatabase(page)).toBe(false);
    await ask(page, 'Should I start a business?');
    expect(sent.at(-1)).toBeUndefined();
  });
});
