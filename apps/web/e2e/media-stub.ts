import { expect, type Page } from './fixtures';

export const VIDEO = 'dQw4w9WgXcQ';
export const AUDIO = 'https://audio.example.test/episode.mp3';

/**
 * Demo episodes have no recordings, so this rewrites the demo answer stream to give every cited
 * episode a YouTube video (estimated alignment) and a podcast enclosure. Both third-party hosts
 * are stubbed: the point is what the page requests, and when.
 */
export async function answerWithMedia(
  page: Page,
  question = 'Why do I keep procrastinating?',
): Promise<string[]> {
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
  await box.fill(question);
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
