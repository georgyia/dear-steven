import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EMPTY_KNOWLEDGE_REPLY } from '@dear-steven/core/copy';
import { MODELS } from '@dear-steven/core/models';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { POST as ask } from '@/app/api/ask/route';
import { POST as checkKey } from '@/app/api/key/route';
import { POST as speech } from '@/app/api/speech/route';
import { GET as status } from '@/app/api/status/route';
import { MESSAGES } from '@/i18n';
import { resetRateLimits } from './rate-limit';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));

/**
 * Bring your own key (P6-03), proven with a canary: a key that must never come back out — not in
 * a response, a log line, a URL, a cache or the spend ledger — while the request it came with
 * really does run on it.
 */
const CANARY = `sk-canary-${'Qx7'.repeat(12)}`;
/** OpenAI's own 401 echoes a masked key; even that tail must not get through. */
const TAIL = CANARY.slice(-4);
const copy = MESSAGES.en.serverErrors;

let dataDir: string;
let logs: string[];
let network: MockInstance<typeof fetch>;

const request = (path: string, init: RequestInit & { key?: string; origin?: string } = {}) => {
  const { key, origin = 'http://localhost', ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set('x-forwarded-for', '203.0.113.9');
  if (key !== undefined) headers.set('x-openai-key', key);
  return new Request(`${origin}${path}`, { ...rest, headers });
};

const openai = (status: number, body: unknown) =>
  network.mockImplementation(async () =>
    body instanceof ArrayBuffer
      ? new Response(body, { status, headers: { 'content-type': 'audio/mpeg' } })
      : Response.json(body, { status }),
  );

const REJECTED = {
  error: {
    message: `Incorrect API key provided: sk-canar************************${TAIL}. You can find your API key at https://platform.openai.com/account/api-keys.`,
    type: 'invalid_request_error',
    code: 'invalid_api_key',
  },
};

/** Everything that left the server: the response body and every console line. */
async function leaked(res: Response): Promise<string> {
  return `${await res.text()}\n${logs.join('\n')}`;
}

function expectRanOnCanary() {
  const [url, init] = network.mock.calls[0] ?? [];
  expect(String(url)).toMatch(/^https:\/\/api\.openai\.com\/v1\//);
  expect(String(url)).not.toContain(CANARY);
  expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${CANARY}`);
}

function expectNothingKept() {
  const handles = (globalThis as { __dearSteven?: { apiKey?: string } }).__dearSteven;
  expect(handles?.apiKey).not.toBe(CANARY);
  expect(existsSync(join(dataDir, 'spend.json'))).toBe(false);
}

beforeEach(() => {
  resetRateLimits();
  dataDir = mkdtempSync(join(tmpdir(), 'dear-steven-byok-'));
  vi.stubEnv('OPENAI_API_KEY', '');
  vi.stubEnv('DEAR_STEVEN_DEMO', '');
  vi.stubEnv('DEAR_STEVEN_ALLOW_OPERATOR_KEY', '');
  vi.stubEnv('DEAR_STEVEN_DAILY_BUDGET_USD', '');
  vi.stubEnv('DEAR_STEVEN_DB_PATH', join(dataDir, 'kb.db'));
  logs = [];
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
  }
  network = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/key — "Test and use"', () => {
  it('checks the key against the answer model, free, and says only yes', async () => {
    openai(200, { id: MODELS.answer, object: 'model' });
    const res = await checkKey(request('/api/key', { method: 'POST', key: CANARY }));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(String(network.mock.calls[0]?.[0])).toBe(
      `https://api.openai.com/v1/models/${MODELS.answer}`,
    );
    expectRanOnCanary();
    expect(await leaked(res)).not.toContain(CANARY);
    expectNothingKept();
  });

  it('turns a rejected key into a clear message, with no trace of the key', async () => {
    openai(401, REJECTED);
    const res = await checkKey(request('/api/key', { method: 'POST', key: CANARY }));
    expect(res.status).toBe(400);
    const out = await leaked(res);
    expect(out).toContain(copy.yourKeyRejected);
    expect(out).not.toContain(CANARY);
    expect(out).not.toContain(TAIL);
    expect(out).not.toContain('Incorrect API key');
    expect(network).toHaveBeenCalledTimes(1);
    expectNothingKept();
  });

  it('names the model when the key works but cannot use it', async () => {
    openai(404, { error: { message: `The model does not exist (key ${CANARY})` } });
    const res = await checkKey(request('/api/key', { method: 'POST', key: CANARY }));
    const out = await leaked(res);
    expect(out).toContain(copy.keyNoModel(MODELS.answer));
    expect(out).not.toContain(CANARY);
  });

  it('refuses a malformed key without calling OpenAI or echoing it', async () => {
    const odd = `${CANARY}<b>`;
    const res = await checkKey(request('/api/key', { method: 'POST', key: odd }));
    expect(res.status).toBe(400);
    const out = await leaked(res);
    expect(out).toContain(copy.keyMalformed);
    expect(out).not.toContain('Qx7Qx7');
    expect(network).not.toHaveBeenCalled();
  });

  it('never spends a call on the operator key', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-operator-key');
    const res = await checkKey(request('/api/key', { method: 'POST' }));
    expect(res.status).toBe(400);
    expect(network).not.toHaveBeenCalled();
  });

  it('refuses a key sent over plain HTTP from another machine', async () => {
    const res = await checkKey(
      request('/api/key', { method: 'POST', key: CANARY, origin: 'http://steven.example' }),
    );
    expect(res.status).toBe(400);
    expect(await leaked(res)).toContain(copy.keyNeedsHttps);
    expect(network).not.toHaveBeenCalled();

    openai(200, { id: MODELS.answer });
    const behindTls = request('/api/key', {
      method: 'POST',
      key: CANARY,
      origin: 'http://steven.example',
      headers: { 'x-forwarded-proto': 'https' },
    });
    expect((await checkKey(behindTls)).status).toBe(200);
  });

  it('is rate limited per client', async () => {
    openai(401, REJECTED);
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await checkKey(request('/api/key', { method: 'POST', key: CANARY }))).status);
    }
    expect(statuses).toEqual([400, 400, 400, 400, 400, 429]);
  });

  it('does nothing when the operator forces demo mode', async () => {
    vi.stubEnv('DEAR_STEVEN_DEMO', '1');
    const res = await checkKey(request('/api/key', { method: 'POST', key: CANARY }));
    expect(res.status).toBe(503);
    expect(network).not.toHaveBeenCalled();
  });
});

describe('GET /api/status with a key', () => {
  it('is live on the visitor key, and says so without repeating it', async () => {
    const res = status(request('/api/status', { key: CANARY }));
    const body = await res.clone().json();
    expect(body).toMatchObject({ mode: 'live', setup: { openaiKey: true, visitorKey: true } });
    expect(await leaked(res)).not.toContain(CANARY);
    expect(network).not.toHaveBeenCalled();
  });

  it('keeps the operator key to the operator when told to', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-operator-key');
    vi.stubEnv('DEAR_STEVEN_ALLOW_OPERATOR_KEY', '0');
    const body = await status(request('/api/status')).json();
    expect(body).toMatchObject({
      mode: 'demo',
      demoReason: 'no_openai_key',
      setup: { openaiKey: false, visitorKey: false },
    });
  });
});

describe('POST /api/ask with a key', () => {
  const question = (key: string) =>
    request('/api/ask', {
      method: 'POST',
      key,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'How do I build discipline?', history: [] }),
    });

  it('switches a keyless server to live mode for that request, past the operator cap', async () => {
    // The operator's cap is spent; a visitor paying with their own key is not stopped by it.
    vi.stubEnv('DEAR_STEVEN_DAILY_BUDGET_USD', '0.0001');
    const today = new Date().toISOString().slice(0, 10);
    writeFileSync(join(dataDir, 'spend.json'), JSON.stringify({ day: today, usd: 1 }));
    const res = await ask(question(CANARY));
    const out = await leaked(res);
    // Live, with no knowledge base here: the honest empty answer — not the demo, not "resting".
    expect(out).toContain(EMPTY_KNOWLEDGE_REPLY.en.text);
    expect(out).not.toMatch(/daily limit|Demo/);
    expect(out).not.toContain(CANARY);
    expect(network).not.toHaveBeenCalled();
  });

  it('refuses a malformed key before anything else', async () => {
    const res = await ask(question('sk-not a key'));
    expect(res.status).toBe(400);
    expect(await leaked(res)).toContain(copy.keyMalformed);
  });
});

describe('POST /api/speech with a key', () => {
  const say = () =>
    request('/api/speech', {
      method: 'POST',
      key: CANARY,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Hello there.' }),
    });

  it('runs on the visitor key and leaves the operator ledger alone', async () => {
    openai(200, new Uint8Array([1, 2, 3]).buffer);
    const res = await speech(say());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
    expectRanOnCanary();
    expect(logs.join('\n')).not.toContain(CANARY);
    expectNothingKept();
  });

  it('reports a rejected key as the visitor’s to fix, with no trace of it', async () => {
    openai(401, REJECTED);
    const res = await speech(say());
    expect(res.status).toBe(502);
    const out = await leaked(res);
    expect(out).toContain(copy.yourKeyRejected);
    expect(out).not.toContain(CANARY);
    expect(out).not.toContain(TAIL);
  });
});
