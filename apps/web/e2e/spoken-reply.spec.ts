import { SPEECH_CONTENT_TYPE } from '@dear-steven/core/speech';
import { en } from '../src/i18n/en';
import { FAKE_ANSWER } from './fake-openai';
import { expect, test } from './fixtures';
import { E2E_FREE_VISITOR_KEY } from './free-env';

/**
 * Talk read aloud as it is checked (P9-01), against the free-questions server on a visitor's own
 * key, so its server voice is on. The fake OpenAI holds back what follows an answer's blocks for a
 * second, as a real model is still writing its evidence then, and streams speech back as PCM.
 * speechSynthesis is recorded, to prove the server's voice did the reading.
 */
test.use({ extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.40' } });

const REPLY = FAKE_ANSWER.blocks[0]?.segments.map((s) => s.text).join(' ') ?? '';

test('a talk reply starts playing before the answer is finished, and says what is written', async ({
  page,
}) => {
  test.slow(); // a key check, then an answer read aloud
  await page.addInitScript(() => {
    const w = window as unknown as { __spoken: string[] };
    w.__spoken = [];
    window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
      w.__spoken.push(u.text);
      setTimeout(() => u.onend?.(new Event('end') as SpeechSynthesisEvent), 10);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: en.terms.dismiss }).click();

  // On a key of their own, server speech is theirs to use.
  await page.getByRole('button', { name: new RegExp(en.status.open) }).click();
  await page.getByLabel(en.setup.ownKey.label).fill(E2E_FREE_VISITOR_KEY);
  await page.getByRole('button', { name: en.setup.ownKey.use }).click();
  await expect(page.getByText(en.setup.ownKey.using(false))).toBeVisible();
  await page.getByRole('button', { name: en.ui.close }).click();

  await page
    .getByRole('radiogroup', { name: en.modes.label })
    .getByRole('radio', { name: en.modes.talk })
    .click();
  const box = page.getByRole('textbox', { name: en.composer.label });
  await box.fill('How do I start before I feel ready?');
  const spoken = page.waitForRequest((r) => r.url().endsWith('/api/speech'));
  await box.press('Enter');

  // The reply is being read while the answer is still being written.
  const request = await spoken;
  await expect(page.getByText(en.turn.complete)).toHaveCount(0);
  expect(request.postDataJSON()).toMatchObject({ text: REPLY, language: 'en' });
  expect(request.headers()['x-openai-key']).toBe(E2E_FREE_VISITOR_KEY);
  const response = await request.response();
  expect(response?.headers()['content-type']).toBe(SPEECH_CONTENT_TYPE);

  const turn = page.getByRole('article', { name: 'How do I start before I feel ready?' });
  await expect(turn.getByText(REPLY)).toBeVisible();
  await expect(page.getByText(en.turn.complete)).toHaveCount(1, { timeout: 15_000 });
  // One request for the one block, read by the server's voice: the browser's said nothing.
  expect(await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toEqual(
    [],
  );
});

test.describe('out of free questions', () => {
  test.use({ extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.41' } });

  test('a spoken conversation ends, and offers a key of your own (P9-02)', async ({ page }) => {
    test.slow(); // three free answers first
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown> & { __listening: number };
      w.__listening = 0;
      window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
        setTimeout(() => u.onend?.(new Event('end') as SpeechSynthesisEvent), 10);
      };
      class FakeRecognition {
        lang = '';
        interimResults = false;
        continuous = false;
        maxAlternatives = 1;
        onaudiostart: (() => void) | null = null;
        onresult: ((e: unknown) => void) | null = null;
        onerror: ((e: { error: string }) => void) | null = null;
        onend: (() => void) | null = null;
        start() {
          w.__listening += 1;
          setTimeout(() => this.onaudiostart?.(), 20);
          const r = Object.assign([{ transcript: 'One more question?' }], { isFinal: false });
          setTimeout(() => this.onresult?.({ resultIndex: 0, results: [r] }), 100);
        }
        stop() {
          setTimeout(() => {
            const r = Object.assign([{ transcript: 'One more question?' }], { isFinal: true });
            this.onresult?.({ resultIndex: 0, results: [r] });
            this.onend?.();
          }, 30);
        }
        abort() {
          setTimeout(() => this.onend?.(), 10);
        }
      }
      w.SpeechRecognition = FakeRecognition;
      w.webkitSpeechRecognition = FakeRecognition;
    });
    await page.goto('/');
    await page.getByRole('button', { name: en.terms.dismiss }).click();
    // This browser's three free questions, used up.
    for (const question of ['First?', 'Second?', 'Third?']) {
      const res = await page.request.post('/api/ask', { data: { question, history: [] } });
      expect(res.ok()).toBe(true);
      await res.text();
    }

    await page
      .getByRole('radiogroup', { name: en.modes.label })
      .getByRole('radio', { name: en.modes.talk })
      .click();
    await page.getByRole('button', { name: en.conversation.start }).click();
    const alert = page.getByRole('alert').filter({ hasText: en.errors.needsKey });
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await expect(alert.getByRole('button', { name: en.free.useOwnKey })).toBeVisible();
    await expect(page.getByRole('region', { name: en.conversation.label })).toHaveCount(0);
    expect(
      await page.evaluate(() => (window as unknown as { __listening: number }).__listening),
    ).toBe(1);
  });
});
