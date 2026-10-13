import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { canaryIn, E2E_LIVE_LOG } from './live-env';

/**
 * The operator's key never reaches a browser (P8-01). Against the same production build, running
 * on a canary operator key: every page and the payload behind it, every script and stylesheet it
 * loads, every API route a browser can call, the page's own DOM, storage and cookies, and every
 * line the server printed. None of them may contain the key, or the part of it a provider error
 * echoes back.
 */

test('nothing a browser can fetch contains the operator key', async ({ page, request }) => {
  test.slow(); // every asset of two pages, fetched again
  const urls = new Set<string>();
  page.on('request', (r) => {
    if (r.method() === 'GET') urls.add(r.url());
  });

  // It really runs on the operator's key.
  const status = await (await request.get('/api/status')).json();
  expect(status).toMatchObject({ mode: 'live', setup: { openaiKey: true, visitorKey: false } });

  await page.goto('/');
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.waitForLoadState('networkidle');
  const home = await page.content();
  const storage = await page.evaluate(() =>
    [sessionStorage, localStorage]
      .flatMap((s) => Object.keys(s).map((k) => `${k}=${s.getItem(k)}`))
      .join('\n'),
  );
  await page.goto('/terms');
  await page.waitForLoadState('networkidle');
  const terms = await page.content();
  const cookies = JSON.stringify(await page.context().cookies());

  const fetched: string[] = [];
  for (const url of urls) {
    // Blob URLs report the page's origin too; only what the server sent is fetched again.
    if (!url.startsWith(new URL(page.url()).origin)) continue;
    const res = await request.get(url);
    fetched.push(`${url}\n${JSON.stringify(res.headers())}\n${await res.text()}`);
  }
  // The server-component payload behind each page.
  for (const path of ['/', '/terms']) {
    const res = await request.get(path, { headers: { RSC: '1' } });
    fetched.push(`${path} (RSC)\n${await res.text()}`);
  }
  expect(fetched.some((f) => f.includes('/_next/static/'))).toBe(true);

  // Every route that spends: each one calls the fake OpenAI, which rejects the canary with an echo.
  const post = async (path: string, data: unknown) => {
    const res = await request.post(path, { data });
    return `${path}\n${JSON.stringify(res.headers())}\n${await res.text()}`;
  };
  fetched.push(
    await post('/api/ask', { question: 'How do I start before I feel ready?', history: [] }),
    await post('/api/interview', { setup: {}, turns: [], action: 'next' }),
    await post('/api/speech', { text: 'Start before you feel ready.' }),
    await post('/api/key', {}),
    `${(await request.get('/api/episodes?q=start')).url()}\n${await (await request.get('/api/episodes?q=start')).text()}`,
  );
  const transcribe = await request.post('/api/transcribe', {
    multipart: {
      audio: { name: 'a.webm', mimeType: 'audio/webm', buffer: Buffer.alloc(4096) },
    },
  });
  fetched.push(await transcribe.text());

  for (const [where, text] of [
    ['home page', home],
    ['terms page', terms],
    ['storage', storage],
    ['cookies', cookies],
    ...fetched.map((f) => [f.slice(0, f.indexOf('\n')), f] as const),
  ] as const) {
    expect(canaryIn(text), `${where} contains the operator key`).toBe(null);
  }

  // The server tried OpenAI with it, and printed nothing of it.
  const log = readFileSync(E2E_LIVE_LOG, 'utf8');
  expect(log.length).toBeGreaterThan(0);
  expect(canaryIn(log), 'the server log contains the operator key').toBe(null);
  expect(log).not.toContain('Incorrect API key');
});
