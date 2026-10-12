import { expect, type Page, test } from './fixtures';

const VIDEO = 'dQw4w9WgXcQ';
const AUDIO = 'https://audio.example.test/episode.mp3';

/**
 * Demo episodes have no recordings, so this rewrites the demo answer stream to give every cited
 * episode a YouTube video (estimated alignment) and a podcast enclosure. Both third-party hosts
 * are stubbed: the point is what the page requests, and when.
 */
async function answerWithMedia(page: Page): Promise<string[]> {
  const thirdParty: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).hostname !== 'localhost') thirdParty.push(r.url());
  });
  await page.route('https://www.youtube-nocookie.com/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>player stub</title>' }),
  );
  await page.route('https://audio.example.test/**', (r) =>
    r.fulfill({ contentType: 'audio/mpeg', body: '' }),
  );
  await page.route('**/api/ask', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .split('\n')
      .map((line) => {
        if (!line.startsWith('data: ')) return line;
        const event = JSON.parse(line.slice(6));
        addMedia(event);
        return `data: ${JSON.stringify(event)}`;
      })
      .join('\n');
    await route.fulfill({ response, body });
  });

  await page.goto('/');
  const box = page.getByRole('textbox', { name: 'Ask Steven' });
  await box.fill('Why do I keep procrastinating?');
  await box.press('Enter');
  await expect(page.getByText('Answer complete.')).toBeAttached({ timeout: 15_000 });
  return thirdParty;
}

function addMedia(node: unknown): void {
  if (Array.isArray(node)) {
    for (const n of node) addMedia(n);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const o = node as Record<string, unknown>;
  if (typeof o.passageId === 'string' && o.episode && typeof o.startMs === 'number') {
    const seconds = Math.floor(o.startMs / 1000);
    Object.assign(o.episode, { youtubeVideoId: VIDEO, audioUrl: AUDIO });
    o.timestamp = { ms: o.startMs, state: 'estimated' };
    o.youtubeUrl = `https://www.youtube.com/watch?v=${VIDEO}&t=${seconds}s`;
    o.embedUrl = `https://www.youtube-nocookie.com/embed/${VIDEO}?start=${seconds}`;
  }
  for (const v of Object.values(o)) addMedia(v);
}

test.describe('in-drawer player and podcast audio', () => {
  test('nothing loads from YouTube or the audio host until the user presses play', async ({
    page,
  }) => {
    const thirdParty = await answerWithMedia(page);
    await page.locator('[data-citation]').first().click();
    const inspector = page.getByRole('dialog', { name: 'Source inspector' });
    await inspector.getByRole('radio', { name: 'Video' }).click();

    const playVideo = inspector.getByRole('button', { name: /Play the video here from ≈ \d/ });
    await expect(playVideo).toBeVisible();
    await expect(inspector.getByText(/Approximate \(≈\)/)).toBeVisible();
    const playAudio = inspector.getByRole('button', { name: /Play the podcast audio here/ });
    await expect(playAudio).toBeVisible();
    expect(thirdParty).toEqual([]);

    await playVideo.click();
    const player = inspector.locator('iframe[title^="YouTube video"]');
    await expect(player).toBeVisible();
    await expect(player).toHaveAttribute(
      'src',
      /youtube-nocookie\.com\/embed\/.+start=\d+.*autoplay=1/,
    );
    await expect.poll(() => thirdParty.some((u) => u.includes('youtube-nocookie.com'))).toBe(true);
    expect(thirdParty.some((u) => u.includes('audio.example.test'))).toBe(false);

    await playAudio.click();
    await expect.poll(() => thirdParty.some((u) => u.startsWith(AUDIO))).toBe(true);
    // The stub sends no audio, so the player reports it and offers another try.
    await expect(inspector.getByText(/didn’t send the audio/)).toBeVisible();
    await expect(
      inspector.getByRole('button', { name: 'Try the podcast audio again' }),
    ).toBeVisible();
    expect(thirdParty.every((u) => /youtube-nocookie\.com|audio\.example\.test/.test(u))).toBe(
      true,
    );
  });
});
