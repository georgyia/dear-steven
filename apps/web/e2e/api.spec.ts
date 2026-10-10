import { expect, test } from '@playwright/test';

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
