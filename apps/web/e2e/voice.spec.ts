import { expect, type Page, test } from '@playwright/test';

/**
 * Voice runs against Chromium's fake microphone. The Web Speech API needs Google's servers, so a
 * scripted SpeechRecognition stands in for it; speechSynthesis is recorded instead of played.
 */
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

const answered = (page: Page) =>
  expect(page.getByText('Answer complete.').last()).toBeAttached({ timeout: 15_000 });

async function stubSpeech(
  page: Page,
  opts: { say?: string; deny?: boolean; noRecognition?: boolean } = {},
) {
  await page.addInitScript(
    ({ say, deny, noRecognition }) => {
      const w = window as unknown as Record<string, unknown>;
      w.__spoken = [] as string[];
      window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
        (w.__spoken as string[]).push(u.text);
        setTimeout(() => u.onend?.(new Event('end') as SpeechSynthesisEvent), 10);
      };
      if (noRecognition) {
        delete w.SpeechRecognition;
        delete w.webkitSpeechRecognition;
        return;
      }
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
          setTimeout(
            () => (deny ? this.onerror?.({ error: 'not-allowed' }) : this.onaudiostart?.()),
            20,
          );
        }
        stop() {
          setTimeout(() => {
            const result = Object.assign([{ transcript: say }], { isFinal: true });
            this.onresult?.({ resultIndex: 0, results: [result] });
            this.onend?.();
          }, 20);
        }
        abort() {
          this.onend?.();
        }
      }
      w.SpeechRecognition = FakeRecognition;
      w.webkitSpeechRecognition = FakeRecognition;
    },
    {
      say: opts.say ?? 'Why do I keep procrastinating?',
      deny: opts.deny ?? false,
      noRecognition: opts.noRecognition ?? false,
    },
  );
}

const spoken = (page: Page) =>
  page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);

test('asking by voice: M to talk, M to send, then the reply is spoken', async ({ page }) => {
  await stubSpeech(page);
  await page.goto('/');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('m');
  await expect(page.getByRole('button', { name: /Talk to Steven/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.waitForTimeout(150);
  await page.keyboard.press('m');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Why do I keep procrastinating?' }),
  ).toBeVisible();
  await answered(page);
  await expect.poll(() => spoken(page)).toHaveLength(1);
  expect((await spoken(page))[0]).toMatch(/procrastinat/i);
});

test('typed questions are never read aloud by themselves', async ({ page }) => {
  await stubSpeech(page);
  const speechRequests: string[] = [];
  page.on('request', (r) => r.url().includes('/api/speech') && speechRequests.push(r.url()));
  await page.goto('/');
  const box = page.getByRole('textbox', { name: 'Ask Steven' });
  await box.fill('How do I build discipline?');
  await box.press('Enter');
  await answered(page);
  await page.waitForTimeout(300);
  expect(await spoken(page)).toEqual([]);
  expect(speechRequests).toEqual([]);

  // …but the Listen button reads the spoken version on request.
  await page.getByRole('button', { name: 'Listen' }).click();
  await expect.poll(() => spoken(page)).toHaveLength(1);
  await page.getByRole('radio', { name: 'Spoken' }).click();
  await expect(page.getByText('What I’d say out loud')).toBeVisible();
});

test('Firefox path: no Web Speech, so it records and transcribes on the server', async ({
  page,
}) => {
  await stubSpeech(page, { noRecognition: true });
  // Pretend the server is live so /api/transcribe is offered, and answer it locally.
  await page.route('**/api/status', async (route) => {
    const res = await route.fetch();
    await route.fulfill({
      response: res,
      json: { ...(await res.json()), mode: 'live', demoReason: null },
    });
  });
  let uploaded = 0;
  await page.route('**/api/transcribe', async (route) => {
    uploaded = route.request().postDataBuffer()?.length ?? 0;
    await route.fulfill({ json: { text: 'Should I start a business?' } });
  });
  await page.goto('/');
  await page.waitForResponse('**/api/status');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('m');
  await page.waitForTimeout(800);
  await page.keyboard.press('m');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Should I start a business?' }),
  ).toBeVisible();
  expect(uploaded).toBeGreaterThan(0);
});

test('a blocked microphone is explained, and typing still works', async ({ page }) => {
  await stubSpeech(page, { deny: true });
  await page.goto('/');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('m');
  await expect(page.getByText(/microphone access is blocked/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Talk to Steven/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  const box = page.getByRole('textbox', { name: 'Ask Steven' });
  await box.fill('How do I build discipline?');
  await box.press('Enter');
  await answered(page);
});
