import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { proxy } from './proxy';
import { ACCESS_COOKIE, issueAccessToken } from './server/access';

/** Every API route on disk, so a new one is covered the day it is added. */
function apiRoutes(): string[] {
  const root = fileURLToPath(new URL('./app/api', import.meta.url));
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? walk(join(dir, d.name)) : d.name === 'route.ts' ? [dir] : [],
    );
  return walk(root).map(
    (dir) =>
      `/api/${relative(root, dir)
        .replace(/\[[^\]]+\]/g, 'ps_x')
        .replaceAll('\\', '/')}`,
  );
}

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost${path}`, {
    method: path === '/api/access' ? 'POST' : 'GET',
    headers: cookie ? { cookie: `${ACCESS_COOKIE}=${cookie}` } : {},
  });
const passedOn = (res: Response) => res.headers.get('x-middleware-next') === '1';

describe('proxy — access gate (P6-08)', () => {
  afterEach(() => vi.unstubAllEnvs());
  const routes = apiRoutes();

  it('finds the API routes', () => {
    expect(routes).toEqual(
      expect.arrayContaining([
        '/api/ask',
        '/api/status',
        '/api/speech',
        '/api/transcribe',
        '/api/access',
      ]),
    );
  });

  it('refuses every API route without the cookie when a code is set', async () => {
    vi.stubEnv('DEAR_STEVEN_ACCESS_CODE', 'open sesame');
    for (const path of routes.filter((p) => p !== '/api/access')) {
      const res = await proxy(request(path));
      expect(res.status, path).toBe(401);
      expect(await res.json()).toMatchObject({ error: { code: 'locked' } });
    }
    expect(passedOn(await proxy(request('/api/access')))).toBe(true);
  });

  it('lets a valid cookie through, and refuses a stale or forged one', async () => {
    vi.stubEnv('DEAR_STEVEN_ACCESS_CODE', 'open sesame');
    const good = await issueAccessToken('open sesame');
    expect(passedOn(await proxy(request('/api/ask', good)))).toBe(true);
    const old = await issueAccessToken('open sesame', Date.now() - 31 * 86_400_000);
    expect((await proxy(request('/api/ask', old))).status).toBe(401);
    const otherCode = await issueAccessToken('another code');
    expect((await proxy(request('/api/ask', otherCode))).status).toBe(401);
  });

  it('is open when no code is set, and pages always get their CSP', async () => {
    vi.stubEnv('DEAR_STEVEN_ACCESS_CODE', '');
    for (const path of routes) expect(passedOn(await proxy(request(path))), path).toBe(true);
    vi.stubEnv('DEAR_STEVEN_ACCESS_CODE', 'open sesame');
    const page = await proxy(request('/'));
    expect(page.headers.get('content-security-policy')).toMatch(/script-src 'self' 'nonce-/);
  });
});
