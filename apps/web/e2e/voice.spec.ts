import { expect, type Page, test } from './fixtures';

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
  opts: {
    say?: string;
    deny?: boolean;
    noRecognition?: boolean;
    /** Chrome's on-device recognition API, as `SpeechRecognition.available` reports it. */
    onDevice?: 'available' | 'downloadable';
  } = {},
) {
  await page.addInitScript(
    ({ say, deny, noRecognition, onDevice }) => {
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
      let localModel = onDevice;
      // On-device recognition is only probed in Google Chrome; the test browser is Chromium.
      if (onDevice)
        Object.defineProperty(navigator, 'userAgentData', {
          get: () => ({ brands: [{ brand: 'Google Chrome', version: '156' }], mobile: false }),
        });
      w.__processLocally = [] as unknown[];
      class FakeRecognition {
        static available = onDevice ? async () => localModel : undefined;
        static install = onDevice
          ? async () => {
              localModel = 'available';
              return true;
            }
          : undefined;
        processLocally: boolean | undefined = undefined;
        lang = '';
        interimResults = false;
        continuous = false;
        maxAlternatives = 1;
        onaudiostart: (() => void) | null = null;
        onresult: ((e: unknown) => void) | null = null;
        onerror: ((e: { error: string }) => void) | null = null;
        onend: (() => void) | null = null;
        start() {
          (w.__processLocally as unknown[]).push(this.processLocally);
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
      onDevice: opts.onDevice,
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
  // Count recorded audio chunks, so the test stops only once there is something to upload.
  await page.addInitScript(() => {
    const w = window as unknown as { __chunks: number };
    w.__chunks = 0;
    const Original = window.MediaRecorder;
    window.MediaRecorder = class extends Original {
      constructor(...args: ConstructorParameters<typeof MediaRecorder>) {
        super(...args);
        this.addEventListener('dataavailable', (e) => {
          if (e.data.size > 0) w.__chunks += 1;
        });
      }
    };
  });
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
  // The mic switches to server transcription once the (mocked) live status has rendered.
  await expect(page.getByRole('button', { name: /Talk to Steven/ })).toBeVisible();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('m');
  await page.waitForFunction(() => (window as unknown as { __chunks: number }).__chunks > 0);
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

test.describe('voice settings', () => {
  const openSettings = async (page: Page) => {
    await page.getByRole('button', { name: 'Voice settings' }).click();
    const dialog = page.getByRole('dialog', { name: 'Voice' });
    await expect(dialog).toBeVisible();
    return dialog;
  };
  const askTyped = async (page: Page, question: string) => {
    const box = page.getByRole('textbox', { name: 'Ask Steven' });
    await box.fill(question);
    await box.press('Enter');
    await answered(page);
  };

  test('"always speak" survives a reload and then reads typed answers aloud', async ({ page }) => {
    test.slow(); // two page loads and a full answer
    await stubSpeech(page);
    await page.goto('/');
    let dialog = await openSettings(page);
    const always = () => dialog.getByRole('switch', { name: 'Always speak replies' });
    await expect(always()).toHaveAttribute('aria-checked', 'false');
    await always().click();
    await expect(always()).toHaveAttribute('aria-checked', 'true');

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Dear Steven' })).toBeVisible();
    await page.waitForTimeout(300);
    expect(await spoken(page)).toEqual([]); // a stored "always speak" plays nothing on its own
    dialog = await openSettings(page);
    await expect(always()).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');

    await askTyped(page, 'How do I build discipline?');
    await expect.poll(() => spoken(page)).toHaveLength(1);
  });

  test('the voice picker previews the chosen voice; on-device is off where unsupported', async ({
    page,
  }) => {
    await stubSpeech(page);
    await page.goto('/');
    const dialog = await openSettings(page);
    await expect(dialog.getByRole('combobox', { name: 'Voice' })).toHaveValue('');
    await dialog.getByRole('button', { name: 'Hear it' }).click();
    await expect.poll(() => spoken(page)).toEqual(['This is how I’ll sound when I answer you.']);
    await expect(
      dialog.getByRole('switch', { name: 'On-device speech recognition' }),
    ).toHaveAttribute('aria-disabled', 'true');
    await expect(dialog.getByText(/Not available in this browser/)).toBeVisible();
  });

  test('on-device recognition downloads once, then recognises with processLocally', async ({
    page,
  }) => {
    test.slow(); // settings, a voice round trip and a full answer
    await stubSpeech(page, { onDevice: 'downloadable' });
    await page.goto('/');
    const dialog = await openSettings(page);
    const local = dialog.getByRole('switch', { name: 'On-device speech recognition' });
    await expect(dialog.getByText(/downloads a speech model once/)).toBeVisible();
    await local.click();
    await expect(local).toHaveAttribute('aria-checked', 'true');
    await expect(dialog.getByText(/audio never leaves it/)).toBeVisible();
    await page.keyboard.press('Escape');

    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('m');
    await expect(page.getByRole('button', { name: /Talk to Steven/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.keyboard.press('m');
    await answered(page);
    expect(
      await page.evaluate(
        () => (window as unknown as { __processLocally: unknown[] }).__processLocally,
      ),
    ).toEqual([true]);
  });

  test('with storage blocked, settings still work for the visit and say so', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    await stubSpeech(page);
    await page.goto('/');
    const dialog = await openSettings(page);
    await dialog.getByRole('switch', { name: 'Always speak replies' }).click();
    await expect(dialog.getByText(/isn’t letting me save settings/)).toBeVisible();
    await page.keyboard.press('Escape');
    await askTyped(page, 'Should I start a business?');
    await expect.poll(() => spoken(page)).toHaveLength(1);
  });
});
