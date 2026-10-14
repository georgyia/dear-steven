import AxeBuilder from '@axe-core/playwright';
import { de } from '../src/i18n/de';
import { en } from '../src/i18n/en';
import { expect, type Page, test } from './fixtures';

/**
 * Talking out loud (P9-02), and the interview spoken (P9-03), in demo mode: one tap, then turns
 * taken with no tap in between. A scripted SpeechRecognition says each line of `script` in turn,
 * word by word, then goes quiet (an empty line is someone saying nothing; " | " is a pause in the
 * middle). speechSynthesis is recorded, and takes `sayMs` to say
 * anything. Every start, stop and abort of the recognition, and every line said, is logged in order,
 * so a test can prove the mic was never open while Dear Steven spoke.
 */
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

async function stubVoice(page: Page, script: string[], sayMs = 300) {
  await page.addInitScript(
    ({ script, sayMs }) => {
      const w = window as unknown as Record<string, unknown> & { __log: string[] };
      w.__log = [];
      const log = (entry: string) => w.__log.push(entry);
      window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
        log(`say ${u.text}`);
        setTimeout(() => {
          log('said');
          u.onend?.(new Event('end') as SpeechSynthesisEvent);
        }, sayMs);
      };
      window.speechSynthesis.cancel = () => undefined;
      let line = 0;
      class FakeRecognition {
        lang = '';
        interimResults = false;
        continuous = false;
        maxAlternatives = 1;
        onaudiostart: (() => void) | null = null;
        onresult: ((e: unknown) => void) | null = null;
        onerror: ((e: { error: string }) => void) | null = null;
        onend: (() => void) | null = null;
        private pending = '';
        private timers: ReturnType<typeof setTimeout>[] = [];
        private result(text: string, isFinal: boolean) {
          const r = Object.assign([{ transcript: text }], { isFinal });
          this.onresult?.({ resultIndex: 0, results: [r] });
        }
        start() {
          log('listen');
          const said = script[line++] ?? '';
          this.timers.push(setTimeout(() => this.onaudiostart?.(), 20));
          if (!said) return;
          // " | " is a pause of 1.2 s in the middle of what is said.
          const words = said.split(' ');
          const spoken = words.filter((w) => w !== '|');
          this.pending = spoken.join(' ');
          let at = 100;
          let n = 0;
          for (const word of words) {
            if (word === '|') {
              at += 1_200;
              continue;
            }
            n += 1;
            const text = spoken.slice(0, n).join(' ');
            this.timers.push(setTimeout(() => this.result(text, false), at));
            at += 80;
          }
        }
        stop() {
          log('stop');
          setTimeout(() => {
            if (this.pending) this.result(this.pending, true);
            this.pending = '';
            this.onend?.();
          }, 30);
        }
        abort() {
          log('abort');
          for (const t of this.timers) clearTimeout(t);
          this.pending = '';
          setTimeout(() => this.onend?.(), 10);
        }
      }
      w.SpeechRecognition = FakeRecognition;
      w.webkitSpeechRecognition = FakeRecognition;
    },
    { script, sayMs },
  );
}

/** WCAG 2.1 A/AA, once notices and reveals have settled (as `a11y.spec.ts` measures them). */
async function audit(page: Page, state: string) {
  await page.waitForTimeout(900);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id}: ${v.nodes
        .map((node) => node.target.join(' '))
        .slice(0, 3)
        .join(' | ')}`,
  );
  expect(summary, `${state} has accessibility violations`).toEqual([]);
}

const events = (page: Page) =>
  page.evaluate(() => (window as unknown as { __log: string[] }).__log);
const modes = (page: Page) => page.getByRole('radiogroup', { name: en.modes.label });
const bar = (page: Page) => page.getByRole('region', { name: en.conversation.label });

async function startTalking(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: en.terms.dismiss }).click();
  await modes(page).getByRole('radio', { name: en.modes.talk }).click();
  await page.getByRole('button', { name: en.conversation.start }).click();
  await expect(bar(page)).toBeVisible();
}

/** No line was said while the recognition was listening: every `say` comes after a stop or abort. */
function neverListeningWhileSpeaking(log: string[]) {
  let listening = false;
  for (const entry of log) {
    if (entry === 'listen') listening = true;
    else if (entry === 'stop' || entry === 'abort') listening = false;
    else if (entry.startsWith('say ')) expect(listening, `listening during "${entry}"`).toBe(false);
  }
}

test.describe('talking out loud (P9-02)', () => {
  test('one tap, then two exchanges with no tap in between', async ({ page }) => {
    test.slow(); // two demo answers, read aloud
    await stubVoice(page, ['Why do I keep procrastinating?', 'How do I build discipline?']);
    await startTalking(page);
    await expect(page.getByRole('button', { name: en.conversation.send })).toBeFocused();

    const first = page.getByRole('article', { name: 'Why do I keep procrastinating?' });
    const second = page.getByRole('article', { name: 'How do I build discipline?' });
    await expect(first).toBeVisible({ timeout: 15_000 });
    await expect(second).toBeVisible({ timeout: 20_000 });
    // After the second reply, it's listening again: a third turn has begun.
    await expect
      .poll(async () => (await events(page)).filter((e) => e === 'listen').length, {
        timeout: 15_000,
      })
      .toBe(3);
    await expect(bar(page)).toHaveAttribute('data-turn', 'yours');

    const log = await events(page);
    expect(log.filter((e) => e.startsWith('say ')).length).toBe(2);
    // Each question went once the speaker paused, and each reply was read before listening again.
    expect(log.slice(0, 6)).toEqual([
      'listen',
      'stop',
      expect.stringMatching(/^say Honestly\? It’s almost never/),
      'said',
      'listen',
      'stop',
    ]);
    neverListeningWhileSpeaking(log);
    await expect(
      first.getByText('Honestly? It’s almost never about not knowing what to do.'),
    ).toBeVisible();

    // End: the mic closes and the composer comes back, with focus on the way back in.
    await bar(page).getByRole('button', { name: en.conversation.end, exact: true }).click();
    await expect(bar(page)).toHaveCount(0);
    expect((await events(page)).at(-1)).toBe('abort');
    await expect(page.getByRole('button', { name: en.conversation.start })).toBeFocused();
  });

  test('Interrupt stops his voice at once and it’s your turn', async ({ page }) => {
    test.slow();
    await stubVoice(page, ['Why do I keep procrastinating?'], 20_000);
    await startTalking(page);
    await expect
      .poll(async () => (await events(page)).some((e) => e.startsWith('say ')))
      .toBe(true);
    await expect(bar(page)).toHaveAttribute('data-turn', 'speaking');
    await expect(bar(page).getByText(en.conversation.speakingHint)).toBeVisible();
    await audit(page, 'speaking');
    const before = (await events(page)).filter((e) => e === 'listen').length;
    await page.keyboard.press('Space');
    await expect
      .poll(async () => (await events(page)).filter((e) => e === 'listen').length)
      .toBe(before + 1);
    await expect(bar(page)).toHaveAttribute('data-turn', 'yours');
  });

  test('silence sends nothing; a hidden tab closes the mic and pauses', async ({ page }) => {
    await stubVoice(page, ['', '']);
    await startTalking(page);
    await page.waitForTimeout(2_000);
    expect(await events(page)).toEqual(['listen']);
    await expect(page.getByRole('article')).toHaveCount(0);

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(bar(page)).toHaveAttribute('data-turn', 'paused');
    await expect(bar(page).getByText(en.conversation.pausedHidden)).toBeVisible();
    expect(await events(page)).toEqual(['listen', 'abort']);

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await bar(page).getByRole('button', { name: en.conversation.resume }).click();
    await expect(bar(page)).toHaveAttribute('data-turn', 'yours');
    expect(await events(page)).toEqual(['listen', 'abort', 'listen']);

    await audit(page, 'paused');
  });

  test('after 30 seconds of quiet the mic closes and the conversation pauses', async ({ page }) => {
    await stubVoice(page, ['']);
    await page.clock.install();
    await startTalking(page);
    await expect.poll(() => events(page)).toEqual(['listen']);
    await page.clock.fastForward(31_000);
    await expect(bar(page)).toHaveAttribute('data-turn', 'paused');
    await expect(bar(page).getByText(en.conversation.pausedIdle(30))).toBeVisible();
    expect(await events(page)).toEqual(['listen', 'abort']);

    await audit(page, 'paused');
    await page.keyboard.press('Escape');
    await expect(bar(page)).toHaveCount(0);
  });

  test('Escape ends it, and leaving Talk ends it too', async ({ page }) => {
    await stubVoice(page, ['', '']);
    await startTalking(page);
    await page.keyboard.press('Escape');
    await expect(bar(page)).toHaveCount(0);
    expect(await events(page)).toEqual(['listen', 'abort']);

    await page.getByRole('button', { name: en.conversation.start }).click();
    await expect(bar(page)).toBeVisible();
    await modes(page).getByRole('radio', { name: en.modes.ask }).click();
    await expect(bar(page)).toHaveCount(0);
    expect(await events(page)).toEqual(['listen', 'abort', 'listen', 'abort']);
    // Ask keeps push-to-talk.
    await expect(page.getByRole('button', { name: /Talk to Steven/ })).toBeVisible();
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('nothing pulses while he speaks', async ({ page }) => {
      await stubVoice(page, ['Why do I keep procrastinating?'], 20_000);
      await startTalking(page);
      await expect(bar(page)).toHaveAttribute('data-turn', 'speaking', { timeout: 15_000 });
      const animated = await bar(page).evaluate(
        (el) =>
          [...el.querySelectorAll('*')].filter((n) => getComputedStyle(n).animationName !== 'none')
            .length,
      );
      expect(animated).toBe(0);
    });
  });

  test.describe('in German', () => {
    test.use({ locale: 'de-DE', reducedMotion: 'reduce' });
    test('the conversation speaks German', async ({ page }) => {
      await stubVoice(page, ['']);
      await page.goto('/');
      await page.getByRole('button', { name: de.terms.dismiss }).click();
      await page
        .getByRole('radiogroup', { name: de.modes.label })
        .getByRole('radio', { name: de.modes.talk })
        .click();
      await page.getByRole('button', { name: de.conversation.start }).click();
      const german = page.getByRole('region', { name: de.conversation.label });
      await expect(german.getByText(de.conversation.listeningHint)).toBeVisible();
      await expect(
        german.getByRole('button', { name: de.conversation.end, exact: true }),
      ).toBeVisible();
      await audit(page, 'listening, in German');
      // German runs long: the bar still fits a phone, with no sideways scroll.
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    });
  });
});

test.describe('the interview, spoken (P9-03)', () => {
  const progress = (page: Page) => page.getByRole('progressbar');
  const question = (page: Page) => page.getByRole('heading', { level: 2 });

  async function startInterview(page: Page) {
    await page.goto('/');
    await page.getByRole('button', { name: en.terms.dismiss }).click();
    await modes(page).getByRole('radio', { name: en.modes.interview }).click();
    await page.getByLabel(/What should I call you\?/).fill('Sam');
    await page.getByRole('button', { name: en.interview.start }).click();
    await expect(progress(page)).toHaveAccessibleName('Question 1 of 7');
    await page.getByRole('button', { name: en.conversation.start }).click();
    await expect(bar(page)).toBeVisible();
  }

  test('each question is read and its answer heard, with no tap in between', async ({ page }) => {
    test.slow(); // two answers, each ended by a two-second pause
    await stubVoice(page, [
      'I run a small design studio in Leeds.',
      'It started at my kitchen table | with one client who paid us in pizza.',
    ]);
    await startInterview(page);
    const first = await question(page).innerText();
    await expect(progress(page)).toHaveAccessibleName('Question 2 of 7', { timeout: 15_000 });
    const second = await question(page).innerText();
    await expect(progress(page)).toHaveAccessibleName('Question 3 of 7', { timeout: 15_000 });
    // The 1.2 s pause in the middle didn't end the answer: it was kept whole.
    await expect(
      page.getByText('“It started at my kitchen table with one client who paid us in pizza.”'),
    ).toBeVisible();
    await expect
      .poll(async () => (await events(page)).filter((e) => e === 'listen').length)
      .toBe(3);

    const log = await events(page);
    expect(log.filter((e) => e.startsWith('say '))).toEqual([
      `say ${first}`,
      `say ${second}`,
      expect.stringMatching(/^say /),
    ]);
    expect(log.slice(0, 4)).toEqual([`say ${first}`, 'said', 'listen', 'stop']);
    neverListeningWhileSpeaking(log);

    await bar(page).getByRole('button', { name: en.conversation.end, exact: true }).click();
    await expect(bar(page)).toHaveCount(0);
    expect((await events(page)).at(-1)).toBe('abort');
    await expect(page.getByRole('button', { name: en.conversation.start })).toBeFocused();
  });

  test('Skip closes the mic and the next question is read', async ({ page }) => {
    await stubVoice(page, ['', '']);
    await startInterview(page);
    await expect.poll(async () => (await events(page)).at(-1)).toBe('listen');
    await page.getByRole('button', { name: en.interview.skip }).click();
    await expect(progress(page)).toHaveAccessibleName('Question 2 of 7');
    const second = await question(page).innerText();
    await expect
      .poll(async () => (await events(page)).filter((e) => e === 'listen').length)
      .toBe(2);
    const log = await events(page);
    expect(log.slice(2)).toEqual(['listen', 'abort', `say ${second}`, 'said', 'listen']);
    await audit(page, 'a spoken interview, listening');
  });

  test.describe('in German', () => {
    test.use({ locale: 'de-DE', reducedMotion: 'reduce' });
    test('a spoken interview in German', async ({ page }) => {
      await stubVoice(page, ['']);
      await page.goto('/');
      await page.getByRole('button', { name: de.terms.dismiss }).click();
      await page
        .getByRole('radiogroup', { name: de.modes.label })
        .getByRole('radio', { name: de.modes.interview })
        .click();
      await page.getByRole('button', { name: de.interview.start }).click();
      await page.getByRole('button', { name: de.conversation.start }).click();
      const german = page.getByRole('region', { name: de.conversation.label });
      await expect(german.getByText(de.conversation.listeningHint)).toBeVisible();
      await audit(page, 'a spoken interview, in German');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    });
  });

  test('ending the interview ends the conversation, and the mic with it', async ({ page }) => {
    await stubVoice(page, ['']);
    await startInterview(page);
    await expect.poll(async () => (await events(page)).at(-1)).toBe('listen');
    await page.getByRole('button', { name: en.interview.end }).click();
    await expect(page.getByRole('heading', { name: 'Thank you, Sam.' })).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
    expect((await events(page)).slice(-1)).toEqual(['abort']);
    expect((await events(page)).filter((e) => e === 'listen').length).toBe(1);
  });
});
