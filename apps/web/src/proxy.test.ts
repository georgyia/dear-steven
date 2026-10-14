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

/** A POST as a browser sends it from a page on another site, or from this one. */
const fromElsewhere = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://steven.example${path}`, {
    method: 'POST',
    headers: {
      host: 'steven.example',
      origin: 'https://attacker.example',
      'sec-fetch-site': 'cross-site',
      'content-type': 'text/plain;charset=UTF-8',
      ...headers,
    },
    body: '{"question":"Should I start a business?","history":[]}',
  });
const fromHere = (path: string) =>
  new NextRequest(`http://steven.example${path}`, {
    method: 'POST',
    headers: {
      host: 'steven.example',
      origin: 'http://steven.example',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
    },
    body: '{}',
  });

describe('proxy — requests from other sites (P8-08)', () => {
  afterEach(() => vi.unstubAllEnvs());
  /** Guided setup answers 404 itself (SR-21); CSP reports exist only in development. */
  const routes = apiRoutes().filter((p) => !/^\/api\/(setup|csp-report)(\/|$)/.test(p));

  it('refuses a POST from another site’s page on every API route, before any route runs', async () => {
    vi.stubEnv('DEAR_STEVEN_ACCESS_CODE', '');
    expect(routes).toEqual(expect.arrayContaining(['/api/ask', '/api/interview', '/api/key']));
    for (const path of routes) {
      const res = await proxy(fromElsewhere(path));
      expect(res.status, path).toBe(403);
      expect(res.headers.get('cache-control'), path).toBe('no-store');
      expect(await res.json(), path).toMatchObject({ error: { code: 'cross_site' } });
    }
  });

  it('refuses a sibling subdomain and a missing Fetch Metadata with a foreign Origin', async () => {
    vi.stubEnv('DEAR_STEVEN_ACCESS_CODE', '');
    const sibling = fromElsewhere('/api/ask', { 'sec-fetch-site': 'same-site' });
    expect((await proxy(sibling)).status).toBe(403);
    const oldBrowser = new NextRequest('http://steven.example/api/ask', {
      method: 'POST',
      headers: { host: 'steven.example', origin: 'https://attacker.example' },
      body: '{}',
    });
    expect((await proxy(oldBrowser)).status).toBe(403);
  });

  it('passes this site’s own requests, reads, and requests from no page', async () => {
    vi.stubEnv('DEAR_STEVEN_ACCESS_CODE', '');
    for (const path of routes) expect(passedOn(await proxy(fromHere(path))), path).toBe(true);
    const read = new NextRequest('http://steven.example/api/status', {
      headers: { host: 'steven.example', 'sec-fetch-site': 'cross-site' },
    });
    expect(passedOn(await proxy(read))).toBe(true);
    const script = new NextRequest('http://steven.example/api/ask', {
      method: 'POST',
      headers: { host: 'steven.example', 'content-type': 'application/json' },
      body: '{}',
    });
    expect(passedOn(await proxy(script))).toBe(true);
  });

  it('leaves guided setup to its own check, which answers 404', async () => {
    vi.stubEnv('DEAR_STEVEN_ACCESS_CODE', '');
    expect(passedOn(await proxy(fromElsewhere('/api/setup/keys')))).toBe(true);
  });
});

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

  it('refuses a cross-site request before the access check', async () => {
    vi.stubEnv('DEAR_STEVEN_ACCESS_CODE', 'open sesame');
    const good = await issueAccessToken('open sesame');
    const res = await proxy(fromElsewhere('/api/ask', { cookie: `${ACCESS_COOKIE}=${good}` }));
    expect(res.status).toBe(403);
  });

  it('is open when no code is set, and pages always get their CSP', async () => {
    vi.stubEnv('DEAR_STEVEN_ACCESS_CODE', '');
    for (const path of routes) expect(passedOn(await proxy(request(path))), path).toBe(true);
    vi.stubEnv('DEAR_STEVEN_ACCESS_CODE', 'open sesame');
    const page = await proxy(request('/'));
    expect(page.headers.get('content-security-policy')).toMatch(/script-src 'self' 'nonce-/);
  });
});
