import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { POST as access } from '@/app/api/access/route';
import { POST as ask } from '@/app/api/ask/route';
import { POST as cspReport } from '@/app/api/csp-report/route';
import { POST as interview } from '@/app/api/interview/route';
import { POST as setupKeys } from '@/app/api/setup/keys/route';
import { POST as setupRun } from '@/app/api/setup/run/route';
import { POST as share } from '@/app/api/share/route';
import { POST as speech } from '@/app/api/speech/route';
import { POST as transcribe } from '@/app/api/transcribe/route';
import { ENDLESS_CHUNK, endlessBody } from '@/test/endless-body';
import { resetRateLimits } from './rate-limit';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));

/**
 * Every route that reads a body refuses one over its limit with 413, without buffering it
 * (P10-04): with an honest `Content-Length` before reading a byte, and without one as soon as the
 * bytes read pass the limit. The body here never ends, so a route that read it all would never
 * answer. Live mode, on the operator's key: nothing reaches OpenAI.
 */
const ROUTES: { path: string; post: (req: Request) => Promise<Response>; limit: number }[] = [
  { path: '/api/ask', post: ask, limit: 64 * 1024 },
  { path: '/api/interview', post: interview, limit: 48 * 1024 },
  { path: '/api/share', post: share, limit: 32 * 1024 },
  { path: '/api/speech', post: speech, limit: 16 * 1024 },
  { path: '/api/transcribe', post: transcribe, limit: 8 * 1024 * 1024 + 64 * 1024 },
  { path: '/api/access', post: access, limit: 4 * 1024 },
  { path: '/api/setup/keys', post: setupKeys, limit: 4096 },
  { path: '/api/setup/run', post: setupRun, limit: 1024 },
  { path: '/api/csp-report', post: cspReport, limit: 8 * 1024 },
];
const SETUP_TOKEN = 'T'.repeat(43);

let network: MockInstance<typeof fetch>;

const post = (path: string, body: ReadableStream<Uint8Array>, length?: number) =>
  new Request(`http://127.0.0.1:3000${path}`, {
    method: 'POST',
    headers: {
      host: '127.0.0.1:3000',
      'content-type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
      'x-setup-token': SETUP_TOKEN,
      ...(length === undefined ? {} : { 'content-length': String(length) }),
    },
    body,
    duplex: 'half',
  } as RequestInit);

async function refused(res: Response, path: string) {
  expect(res.status).toBe(413);
  // The development CSP report answers with no body, as it does for every other refusal.
  if (path !== '/api/csp-report') {
    expect(await res.json()).toMatchObject({ error: { code: 'bad_request' } });
  }
}

beforeEach(() => {
  resetRateLimits();
  const dir = mkdtempSync(join(tmpdir(), 'dear-steven-body-'));
  vi.stubEnv('OPENAI_API_KEY', 'sk-test-not-a-real-key');
  vi.stubEnv('DEAR_STEVEN_DEMO', '');
  vi.stubEnv('DEAR_STEVEN_FREE_QUESTIONS', '');
  vi.stubEnv('DEAR_STEVEN_ALLOW_OPERATOR_KEY', '');
  vi.stubEnv('DEAR_STEVEN_DAILY_BUDGET_USD', '');
  vi.stubEnv('DEAR_STEVEN_ACCESS_CODE', 'four long words here');
  vi.stubEnv('DEAR_STEVEN_SETUP_TOKEN', SETUP_TOKEN);
  vi.stubEnv('DEAR_STEVEN_SETUP_HOST', '127.0.0.1');
  vi.stubEnv('DEAR_STEVEN_DB_PATH', join(dir, 'kb.db'));
  vi.stubEnv('DEAR_STEVEN_ENV_FILE', join(dir, '.env'));
  // The CSP report route exists only under `next dev`.
  vi.stubEnv('NODE_ENV', 'development');
  network = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('request bodies are capped before they are read (P10-04)', () => {
  it.each(ROUTES)('$path stops reading a body with no length at its limit', async (route) => {
    const body = endlessBody(4 * route.limit);
    await refused(await route.post(post(route.path, body.stream)), route.path);
    const taken = body.taken();
    // What was read, and at most the one piece the stream queues ahead.
    expect(taken).toBeGreaterThan(route.limit);
    expect(taken).toBeLessThanOrEqual(route.limit + 2 * ENDLESS_CHUNK);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(body.taken()).toBe(taken);
    expect(network).not.toHaveBeenCalled();
  });

  it.each(ROUTES)('$path refuses a Content-Length over its limit unread', async (route) => {
    const req = post(route.path, endlessBody(4 * route.limit).stream, route.limit + 1);
    await refused(await route.post(req), route.path);
    expect(req.bodyUsed).toBe(false);
    expect(network).not.toHaveBeenCalled();
  });
});
