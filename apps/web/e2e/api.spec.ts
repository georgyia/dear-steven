import { expect, expectCspViolations, test } from './fixtures';

// Route contracts, checked over HTTP against the production build. Viewport-independent: desktop only.
test.skip(({ isMobile }) => isMobile, 'API checks run once');

test.describe('GET /api/episodes', () => {
  test('lists the labelled fixture episodes in demo mode, metadata only', async ({ request }) => {
    const res = await request.get('/api/episodes');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.offset).toBe(0);
    expect(body.episodes).toHaveLength(3);
    for (const e of body.episodes) {
      expect(e.demo).toBe(true);
      expect(e.title).toContain('(fixture)');
      expect(e.youtubeUrl).toBeNull();
      expect(Object.keys(e).sort()).toEqual(
        [
          'demo',
          'guestNames',
          'id',
          'passages',
          'publishedAt',
          'speakers',
          'title',
          'video',
          'youtubeUrl',
        ].sort(),
      );
    }
  });

  test('filters by guest or title', async ({ request }) => {
    const body = await (await request.get('/api/episodes?q=coach')).json();
    expect(body.total).toBe(1);
    expect(body.episodes).toHaveLength(1);
    const none = await (await request.get('/api/episodes?q=zzz')).json();
    expect(none).toEqual({ total: 0, offset: 0, episodes: [] });
  });

  test('rejects a query it cannot read', async ({ request }) => {
    expect((await request.get('/api/episodes?offset=-1')).status()).toBe(400);
    expect((await request.get('/api/episodes?offset=abc')).status()).toBe(400);
    expect((await request.get(`/api/episodes?q=${'a'.repeat(101)}`)).status()).toBe(400);
  });
});

test.describe('GET /api/passages/:id/related', () => {
  test('returns fixture passages from other episodes only', async ({ request }) => {
    const res = await request.get('/api/passages/demo_ps_mood/related');
    expect(res.status()).toBe(200);
    const { passages } = await res.json();
    expect(passages.map((p: { passageId: string }) => p.passageId)).toEqual([
      'demo_ps_first_step',
      'demo_ps_identity',
    ]);
    expect(passages.every((p: { episode: { id: string } }) => p.episode.id !== 'demo_ep_1')).toBe(
      true,
    );
  });

  test('rejects malformed ids and unknown passages', async ({ request }) => {
    expect((await request.get('/api/passages/bad%20id/related')).status()).toBe(400);
    expect((await request.get('/api/passages/ps_real_1/related')).status()).toBe(404);
  });
});

test.describe('response headers', () => {
  const nonceOf = (csp: string) => /'nonce-([A-Za-z0-9+/=]+)'/.exec(csp)?.[1];

  test('frames and media are fenced to what the inspector needs', async ({ request }) => {
    const csp = (await request.get('/')).headers()['content-security-policy'] ?? '';
    expect(csp).toContain('frame-src https://www.youtube-nocookie.com');
    expect(csp).toContain("media-src 'self' https:");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("connect-src 'self'");
  });

  test('scripts need a fresh nonce on every page, and every script carries it', async ({
    request,
  }) => {
    const [a, b] = await Promise.all([request.get('/'), request.get('/')]);
    const csp = a.headers()['content-security-policy'] ?? '';
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src ')) ?? '';
    expect(scriptSrc).toMatch(/^script-src 'self' 'nonce-[^']+' 'strict-dynamic'$/);
    const nonce = nonceOf(csp);
    expect(nonce).toBeTruthy();
    expect(nonceOf(b.headers()['content-security-policy'] ?? '')).not.toBe(nonce);
    const scripts = [...(await a.text()).matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) expect(tag).toContain(`nonce="${nonce}"`);
  });

  test('HSTS is only sent over HTTPS', async ({ request }) => {
    expect((await request.get('/')).headers()['strict-transport-security']).toBeUndefined();
    const viaTls = await request.get('/', { headers: { 'x-forwarded-proto': 'https' } });
    expect(viaTls.headers()['strict-transport-security']).toBe('max-age=31536000');
    expect(viaTls.headers()['content-security-policy']).toContain('upgrade-insecure-requests');
  });

  test('the violation report endpoint does not exist in production', async ({ request }) => {
    expect((await request.post('/api/csp-report', { data: {} })).status()).toBe(404);
  });
});

test.describe('content security policy in the browser', () => {
  // Markup injected into the page as if an attacker had smuggled it into the HTML. (Scripts added
  // through page.evaluate would prove nothing: Chrome exempts what DevTools inserts from the CSP.)
  const INJECTED = [
    '<script>window.__injected = "inline script"</script>',
    '<img src="data:," onerror="window.__injected = \'event handler\'" alt="">',
    '<script src="https://attacker.invalid/x.js"></script>',
  ].join('');

  test('injected scripts, handlers and foreign script tags without the nonce do not run', async ({
    page,
    cspViolations,
  }) => {
    expectCspViolations();
    await page.route('/', async (route) => {
      const response = await route.fetch();
      const html = (await response.text()).replace('</body>', `${INJECTED}</body>`);
      await route.fulfill({ response, body: html }); // same headers, same policy
    });
    await page.goto('/');
    // The page's own nonced scripts still run: it hydrates and answers the keyboard.
    await expect(page.getByRole('heading', { level: 1, name: 'Dear Steven' })).toBeVisible();
    // The heading is server-rendered; the keyboard answers once hydration is done, so press until it does.
    await expect(async () => {
      await page.keyboard.press('/');
      await expect(page.getByRole('textbox', { name: 'Ask Steven' })).toBeFocused({
        timeout: 1000,
      });
    }).toPass();

    await expect.poll(() => cspViolations.length).toBeGreaterThanOrEqual(3);
    expect(cspViolations.every((v) => /script-src/.test(v))).toBe(true);
    expect(
      await page.evaluate(() => (window as { __injected?: string }).__injected),
    ).toBeUndefined();
  });
});
