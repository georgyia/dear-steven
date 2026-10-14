import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from './fixtures';

/**
 * Talk mode (P7-05), in demo mode: the switch by the composer, the reply set as a transcript with
 * its chips only, read aloud by default (the line itself, P9-01), and a mode that holds for the
 * visit without ever costing the conversation. speechSynthesis is recorded instead of played.
 */
async function recordSpeech(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __spoken: string[] };
    w.__spoken = [];
    window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
      w.__spoken.push(u.text);
      setTimeout(() => u.onend?.(new Event('end') as SpeechSynthesisEvent), 10);
    };
  });
}

/** The demo's talk reply about procrastination, its segments joined: what is said aloud. */
const PROCRASTINATION_REPLY =
  'Honestly? It’s almost never about not knowing what to do. In one of my conversations, the point came up that we delay what makes us feel something unpleasant far more than what’s simply hard. So what does this one make you feel?';

const spoken = (page: Page) =>
  page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
const modes = (page: Page) => page.getByRole('radiogroup', { name: 'How Dear Steven replies' });
const box = (page: Page) => page.getByRole('textbox', { name: 'Ask Steven' });

async function say(page: Page, text: string) {
  await box(page).fill(text);
  await box(page).press('Enter');
  await expect(page.getByText('Answer complete.').last()).toBeAttached({ timeout: 15_000 });
}

async function start(page: Page) {
  await recordSpeech(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Got it' }).click();
}

test.describe('talk mode (P7-05)', () => {
  test('a short reply set as a transcript, with its chips only, read aloud', async ({ page }) => {
    await start(page);
    await modes(page).getByRole('radio', { name: 'Talk' }).click();
    await expect(modes(page).getByRole('radio', { name: 'Talk' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(box(page)).toHaveAttribute('placeholder', 'Say something…');
    await say(page, 'Why do I keep procrastinating?');

    const thread = page.getByRole('region', { name: 'Talking with Dear Steven' });
    const turn = thread.getByRole('article', { name: 'Why do I keep procrastinating?' });
    await expect(turn.getByText('You', { exact: true })).toBeVisible();
    await expect(turn.getByText('Dear Steven', { exact: true })).toBeVisible();
    await expect(turn.getByText('So what does this one make you feel?')).toBeVisible();
    await expect(turn.locator('[data-citation]')).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'Conversations cited' })).toHaveCount(0);
    await expect(turn.getByText('If I were you', { exact: true })).toHaveCount(0);

    // What is read aloud is the line on screen, word for word (P9-01).
    await expect.poll(() => spoken(page)).toHaveLength(1);
    expect((await spoken(page))[0]).toBe(PROCRASTINATION_REPLY);
    await expect(
      turn.getByText('Honestly? It’s almost never about not knowing what to do.'),
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('switching never loses the conversation, and the mode holds for the visit', async ({
    page,
  }) => {
    test.slow(); // three answers and a reload
    await start(page);
    await modes(page).getByRole('radio', { name: 'Talk' }).click();
    await say(page, 'Why do I keep procrastinating?');
    const talked = page.getByRole('article', { name: 'Why do I keep procrastinating?' });

    await modes(page).getByRole('radio', { name: 'Ask' }).click();
    await expect(box(page)).toHaveAttribute('placeholder', 'Ask a follow-up…');
    await say(page, 'How do I build discipline?');
    await expect(page.getByRole('region', { name: 'Conversations cited' })).toBeVisible();
    await expect(talked).toBeVisible();

    await modes(page).getByRole('radio', { name: 'Talk' }).click();
    await say(page, 'Should I start a business?');
    await expect(page.getByRole('region', { name: 'Talking with Dear Steven' })).toHaveCount(2);
    await expect(page.getByRole('article')).toHaveCount(3);

    await page.reload();
    await expect(modes(page).getByRole('radio', { name: 'Talk' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('in a conversation, no notice covers the mode switch or the composer', async ({ page }) => {
    await start(page);
    await say(page, 'Why do I keep procrastinating?');
    await page.waitForTimeout(800); // let the demo notice arrive
    const overlaps = (
      a: { x: number; y: number; width: number; height: number },
      b: { x: number; y: number; width: number; height: number },
    ) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    const controls = [await modes(page).boundingBox(), await box(page).boundingBox()];
    const toasts = await page
      .getByRole('region', { name: 'Notifications' })
      .getByRole('status')
      .all();
    expect(toasts.length).toBeGreaterThan(0);
    for (const toast of toasts) {
      const t = await toast.boundingBox();
      for (const c of controls) if (t && c) expect(overlaps(t, c)).toBe(false);
    }
    await modes(page).getByRole('radio', { name: 'Talk' }).click();
  });

  test('replies stay quiet when "read talk replies aloud" is off', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: 'Voice settings' }).click();
    const dialog = page.getByRole('dialog', { name: 'Voice' });
    const aloud = dialog.getByRole('switch', { name: 'Read talk replies aloud' });
    await expect(aloud).toHaveAttribute('aria-checked', 'true');
    await aloud.click();
    await expect(aloud).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');

    await modes(page).getByRole('radio', { name: 'Talk' }).click();
    await say(page, 'Why do I keep procrastinating?');
    await page.waitForTimeout(300);
    expect(await spoken(page)).toEqual([]);
    await page.getByRole('button', { name: 'Listen' }).click();
    await expect.poll(() => spoken(page)).toHaveLength(1);
  });

  test('talks back in German when spoken to in German', async ({ page }) => {
    await start(page);
    await modes(page).getByRole('radio', { name: 'Talk' }).click();
    await say(page, 'Ich schiebe mein Projekt seit Wochen vor mir her.');
    await expect(
      page.getByText('Also: Welches Gefühl löst diese Aufgabe in dir aus?'),
    ).toBeVisible();
  });
});
