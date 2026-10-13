import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from './fixtures';

/**
 * Interview mode (P7-06), in demo mode: setup, one question at a time, skip and end, what I
 * learned (only the visitor's own words), the safety rails, and switching modes without losing
 * anything.
 */
const modes = (page: Page) => page.getByRole('radiogroup', { name: 'How Dear Steven replies' });
const answerBox = (page: Page) => page.getByRole('textbox', { name: 'Your answer' });
const progress = (page: Page) => page.getByRole('progressbar');

async function start(page: Page, name = 'Sam') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Got it' }).click();
  await modes(page).getByRole('radio', { name: 'Interview me' }).click();
  await expect(page.getByRole('heading', { name: 'Let me interview you.' })).toBeVisible();
  if (name) await page.getByLabel(/What should I call you\?/).fill(name);
  await page.getByRole('button', { name: 'Start the interview' }).click();
}

async function answer(page: Page, text: string) {
  // Wait until the question is open: while the next one is coming, the composer shows Stop.
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
  await expect(answerBox(page)).toBeEditable();
  await answerBox(page).fill(text);
  // Send lights up once the text has reached the composer: only then does Enter send it.
  await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
  await answerBox(page).press('Enter');
}

const ANSWERS = [
  'I run a small design studio in Leeds, mostly brands for food start-ups.',
  'It started at my kitchen table with one client who paid us in pizza.',
  'Everything changed when our biggest client left and we had to rebuild.',
  'It cost me most of my twenties, and a lot of sleep.',
  'I thought we had to say yes to everything, and we did not.',
  'Start smaller than feels respectable, and charge from day one.',
];

test.describe('interview mode (P7-06)', () => {
  test('one question at a time, then what I learned, quoting only my words', async ({ page }) => {
    test.slow(); // seven steps and a summary
    await start(page);
    await expect(progress(page)).toHaveAccessibleName('Question 1 of 7');
    await expect(page.getByText('Demo fixture: not AI-generated or source-verified')).toBeVisible();

    for (const [i, text] of ANSWERS.entries()) {
      await expect(progress(page)).toHaveAccessibleName(`Question ${i + 1} of 7`);
      await answer(page, text);
    }
    await expect(progress(page)).toHaveAccessibleName('Question 7 of 7');
    await page.getByRole('button', { name: 'Skip' }).click();

    await expect(page.getByRole('heading', { name: 'Thank you, Sam.' })).toBeVisible();
    const quotes = await page.locator('blockquote').allInnerTexts();
    expect(quotes.length).toBeGreaterThan(0);
    for (const q of quotes) {
      const said = q.replace(/^“|”$/g, '');
      expect(ANSWERS.some((a) => a.includes(said))).toBe(true);
    }
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);

    await page.getByRole('button', { name: 'Interview me again' }).click();
    await expect(page.getByRole('heading', { name: 'Let me interview you.' })).toBeVisible();
    await modes(page).getByRole('radio', { name: 'Ask' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Dear Steven' })).toBeVisible();
  });

  test('can end early, and a crisis answer ends the interview with help', async ({ page }) => {
    await start(page, '');
    await answer(page, ANSWERS[0] as string);
    await page.getByRole('button', { name: 'End the interview' }).click();
    await expect(page.getByRole('heading', { name: 'Thank you.' })).toBeVisible();

    await page.getByRole('button', { name: 'Interview me again' }).click();
    await page.getByRole('button', { name: 'Start the interview' }).click();
    await answer(page, 'Honestly I want to kill myself most days.');
    await expect(page.getByText(/talk to someone who can help right now/)).toBeVisible();
    await expect(answerBox(page)).toHaveCount(0);
  });

  test('switching modes keeps both the conversation and the interview', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Got it' }).click();
    const ask = page.getByRole('textbox', { name: 'Ask Steven' });
    await ask.fill('How do I build discipline?');
    await ask.press('Enter');
    await expect(page.getByText('Answer complete.').last()).toBeAttached({ timeout: 15_000 });

    await modes(page).getByRole('radio', { name: 'Interview me' }).click();
    await page.getByRole('button', { name: 'Start the interview' }).click();
    await answer(page, ANSWERS[0] as string);
    await expect(progress(page)).toHaveAccessibleName('Question 2 of 7');

    await modes(page).getByRole('radio', { name: 'Ask' }).click();
    await expect(page.getByRole('article', { name: 'How do I build discipline?' })).toBeVisible();
    await modes(page).getByRole('radio', { name: 'Interview me' }).click();
    await expect(progress(page)).toHaveAccessibleName('Question 2 of 7');
  });

  test('practice: a debrief on my own words, then another go at the weakest answer (P7-07)', async ({
    page,
  }) => {
    test.slow(); // six answers, two debriefs
    await page.goto('/');
    await page.getByRole('button', { name: 'Got it' }).click();
    await modes(page).getByRole('radio', { name: 'Interview me' }).click();
    await page.getByText('Practise presenting my expertise').click();
    await expect(
      page.getByRole('heading', { name: 'Practise presenting your expertise.' }),
    ).toBeVisible();
    await page.getByLabel('What are you expert in?').fill('Pricing for small agencies');
    await page.getByRole('button', { name: 'Start the practice' }).click();

    const said = [
      'I help small agencies stop undercharging, usually by about 30 percent in a quarter.',
      'My own agency went broke in 2019 because we billed by the hour and never said no.',
      'It depends.',
      'One client doubled revenue in a year after we moved them to fixed fees per project.',
      'I once priced a rebrand at a tenth of its value and resented every hour of it.',
      'Charge for the outcome, not the hours.',
    ];
    for (const [i, text] of said.entries()) {
      await expect(progress(page)).toHaveAccessibleName(`Question ${i + 1} of 6`);
      await answer(page, text);
    }

    await expect(page.getByText('Debrief', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'How it came across' })).toBeVisible();
    for (const q of await page.locator('blockquote').allInnerTexts()) {
      expect(said.some((a) => a.includes(q.replace(/^“|”$/g, '')))).toBe(true);
    }
    await expect(
      page.getByText('only a live model could write one', { exact: false }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);

    // The vaguest answer is the thing to work on, quoted whole.
    await expect(page.getByText('“It depends.”')).toBeVisible();
    await page.getByRole('button', { name: 'Practise the weakest answer again' }).click();
    await expect(progress(page)).toHaveAccessibleName('Question 3 of 6');
    await answer(
      page,
      'Fixed fees beat hourly rates once a project is scoped: margins rose 20 percent.',
    );
    await expect(page.getByText('Debrief', { exact: true })).toBeVisible();
    // The weakest answer is now the new one-liner, not "It depends.".
    await expect(page.getByText('“Charge for the outcome, not the hours.”')).toBeVisible();
    await expect(page.getByText('“It depends.”')).toHaveCount(0);
  });

  test.describe('in German', () => {
    test.use({ locale: 'de-DE' });

    test('interviews in German when the interface is German', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Verstanden' }).click();
      await page
        .getByRole('radiogroup', { name: 'Wie Dear Steven antwortet' })
        .getByRole('radio', { name: 'Frag mich aus' })
        .click();
      await page.getByRole('button', { name: 'Interview beginnen' }).click();
      await expect(
        page.getByRole('heading', { name: /Erzähl mir in deinen eigenen Worten/ }),
      ).toBeVisible();
    });
  });
});
