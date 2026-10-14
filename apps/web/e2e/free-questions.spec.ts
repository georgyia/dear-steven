import AxeBuilder from '@axe-core/playwright';
import { de } from '../src/i18n/de';
import { en } from '../src/i18n/en';
import { expect, type Page, test } from './fixtures';
import { E2E_FREE_VISITOR_KEY } from './free-env';

/**
 * Three free questions on the operator's key, then your own (P8-02), against a production server
 * with `DEAR_STEVEN_FREE_QUESTIONS=3`, a fixture knowledge base and a fake OpenAI (the fixture
 * server): real answers, a real ledger, a real cookie. Each test asks from its own address (with no
 * proxy in front, the server takes `X-Forwarded-For` as it comes, docs/DEPLOY.md), so each is its
 * own visitor and network, with its own rate limit.
 */
const from = (address: string) => ({ extraHTTPHeaders: { 'x-forwarded-for': address } });
type Copy = typeof en;

async function ask(page: Page, copy: Copy, question: string) {
  const box = page.getByRole('textbox', { name: copy.composer.label });
  await box.fill(question);
  await box.press('Enter');
}

async function askAndWait(page: Page, copy: Copy, question: string, nth: number) {
  await ask(page, copy, question);
  await expect(page.getByText(copy.turn.complete)).toHaveCount(nth, { timeout: 15_000 });
}

async function start(page: Page, copy: Copy) {
  await page.goto('/');
  await page.getByRole('button', { name: copy.terms.dismiss }).click();
}

test.describe('a visitor', () => {
  test.use(from('198.51.100.11'));

  test('three free questions, then your own key, kept in the browser', async ({ page }) => {
    test.slow(); // four answers and a key check
    await start(page, en);

    await askAndWait(page, en, 'How do I start before I feel ready?', 1);
    await expect(page.getByTestId('free-left')).toHaveText(en.free.left(2));
    await askAndWait(page, en, 'And how do I keep going?', 2);
    await expect(page.getByTestId('free-left')).toHaveText(en.free.left(1));
    await askAndWait(page, en, 'What if I fail?', 3);
    await expect(page.getByTestId('free-left')).toHaveCount(0);

    // The fourth asks for a key: no answer, a plain notice, and the way to add one.
    await ask(page, en, 'One more?');
    const alert = page.getByRole('alert').filter({ hasText: en.errors.needsKey });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(en.serverErrors.needsKey(3));
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(audit.violations.map((v) => v.id)).toEqual([]);

    await alert.getByRole('button', { name: en.free.useOwnKey }).click();
    const field = page.getByLabel(en.setup.ownKey.label);
    await expect(field).toBeFocused();
    await field.fill(E2E_FREE_VISITOR_KEY);
    await page.getByRole('button', { name: en.setup.ownKey.use }).click();
    await expect(page.getByText(en.setup.ownKey.using(false))).toBeVisible();
    await page.getByRole('button', { name: en.ui.close }).click();

    // Asked again, on their own key: answered, and nothing is counted any more.
    const sent = page.waitForRequest((r) => r.url().endsWith('/api/ask'));
    await alert.getByRole('button', { name: en.turn.retry }).click();
    expect((await sent).headers()['x-openai-key']).toBe(E2E_FREE_VISITOR_KEY);
    await expect(page.getByText(en.turn.complete)).toHaveCount(4, { timeout: 15_000 });
    const status = await (
      await page.request.get('/api/status', { headers: { 'x-openai-key': E2E_FREE_VISITOR_KEY } })
    ).json();
    expect(status).toMatchObject({ free: null, setup: { visitorKey: true } });
  });
});

test.describe('an interviewee', () => {
  test.use(from('198.51.100.12'));

  test('a whole interview counts as one free question', async ({ page }) => {
    await start(page, en);
    await page
      .getByRole('radiogroup', { name: en.modes.label })
      .getByRole('radio', { name: en.modes.interview })
      .click();
    await page.getByRole('button', { name: en.interview.start }).click();
    const answer = page.getByRole('textbox', { name: en.interview.answerLabel });
    for (const text of [
      'I run a small design studio in Leeds.',
      'It started at my kitchen table.',
    ]) {
      await expect(page.getByRole('button', { name: en.composer.send })).toBeVisible();
      await answer.fill(text);
      await expect(page.getByRole('button', { name: en.composer.send })).toBeEnabled();
      await answer.press('Enter');
    }
    await expect(page.getByRole('button', { name: en.composer.send })).toBeVisible();
    const status = await (await page.request.get('/api/status')).json();
    expect(status.free).toEqual({ limit: 3, used: 1, remaining: 2 });
  });
});

test.describe('in a German browser', () => {
  test.use({ locale: 'de-DE', ...from('198.51.100.13') });

  test('the notice and the way on are German', async ({ page }) => {
    test.slow();
    await start(page, de);
    for (let i = 1; i <= 3; i++) await askAndWait(page, de, `Frage ${i}: wie fange ich an?`, i);
    await ask(page, de, 'Und noch eine?');
    const alert = page.getByRole('alert').filter({ hasText: de.errors.needsKey });
    await expect(alert).toContainText(de.serverErrors.needsKey(3));
    await expect(alert.getByRole('button', { name: de.free.useOwnKey })).toBeVisible();
  });
});
