import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chunkSegments, contextPrefix } from '@dear-steven/core/ingest';
import type { Segment } from '@dear-steven/core/schema';
import { type EpisodeInput, episodeIdFor, KnowledgeStore } from '@dear-steven/core/store';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { resetRateLimits } from './rate-limit';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));

/**
 * The operator's key never leaves the server (P8-01). With a canary as `OPENAI_API_KEY`, every API
 * route on disk is called, the ones that spend with a request that reaches OpenAI, and OpenAI
 * answers each call by echoing the key back, masked, as it does when it rejects one. Neither the
 * key nor that masked tail may appear in any response body or header, or in any log line.
 *
 * Pages and the client bundle are checked against a running server in `e2e/operator-key.spec.ts`.
 */
const OPERATOR = 'sk-proj-unitCanary4hT8nQ2vX6bL9mR3kP7wJ1cF5dS0gYx';
const SECRET = OPERATOR.slice('sk-proj-'.length);
const TAIL = SECRET.slice(-4);

/** Any eight characters of the secret in a row: a truncated or partly masked copy counts too. */
const pieces = Array.from({ length: SECRET.length - 7 }, (_, i) => SECRET.slice(i, i + 8));

const API = fileURLToPath(new URL('../app/api', import.meta.url));

/** Every route module on disk, so a new one is covered the day it is added. */
function routes(): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? walk(join(dir, d.name)) : d.name === 'route.ts' ? [dir] : [],
    );
  return walk(API).map((dir) => relative(API, dir).replaceAll('\\', '/'));
}

/** A request each spending route accepts, so it gets as far as calling OpenAI. */
function bodyFor(route: string): BodyInit | undefined {
  const json = (value: unknown) => JSON.stringify(value);
  switch (route) {
    case 'ask':
      return json({ question: 'How do I start before I feel ready?', history: [] });
    case 'interview':
      return json({ setup: {}, turns: [], action: 'next' });
    case 'speech':
      return json({ text: 'Start before you feel ready.' });
    case 'transcribe': {
      const form = new FormData();
      form.append('audio', new Blob([new Uint8Array(2048)], { type: 'audio/webm' }), 'a.webm');
      return form;
    }
    case 'access':
      return json({ code: 'not-the-code' });
    default:
      return json({});
  }
}

let dir: string;
let logs: string[];
let network: MockInstance<typeof fetch>;

function seed() {
  const store = KnowledgeStore.open(join(dir, 'kb.db'), { create: true });
  const episode: EpisodeInput = {
    sourceGuid: 'guid-1',
    title: 'Demo Guest: Starting',
    description: 'A test episode.',
    publishedAt: '2026-01-01T05:00:00Z',
    durationMs: 3_600_000,
    episodeType: 'full',
    guestNames: ['Demo Guest'],
    audioUrl: null,
    transcriptUrl: null,
  };
  store.upsertEpisodes([episode]);
  const segments: Segment[] = Array.from({ length: 60 }, (_, idx) => ({
    idx,
    startMs: idx * 8000,
    endMs: idx * 8000 + 7000,
    speaker: 'unknown',
    speakerName: null,
    attributionMethod: 'none',
    attributionConfidence: null,
    text: `Sentence ${idx}: start the work before you feel ready, and the feeling follows the action.`,
  }));
  const id = episodeIdFor(episode.sourceGuid);
  store.replaceTranscript(id, segments, 'rss-vtt');
  store.replacePassages(id, chunkSegments(segments), contextPrefix(episode));
  store.close();
}

beforeEach(() => {
  resetRateLimits();
  // The operator's client is cached for the process, holding the `fetch` it was made with.
  const handles = (globalThis as { __dearSteven?: { client?: unknown; apiKey?: string } })
    .__dearSteven;
  if (handles) {
    handles.client = undefined;
    handles.apiKey = undefined;
  }
  dir = mkdtempSync(join(tmpdir(), 'dear-steven-operator-'));
  seed();
  vi.stubEnv('OPENAI_API_KEY', OPERATOR);
  vi.stubEnv('YOUTUBE_API_KEY', '');
  vi.stubEnv('DEAR_STEVEN_DEMO', '');
  vi.stubEnv('DEAR_STEVEN_ALLOW_OPERATOR_KEY', '');
  vi.stubEnv('DEAR_STEVEN_DAILY_BUDGET_USD', '');
  vi.stubEnv('DEAR_STEVEN_ACCESS_CODE', '');
  vi.stubEnv('DEAR_STEVEN_SETUP_TOKEN', '');
  vi.stubEnv('DEAR_STEVEN_DB_PATH', join(dir, 'kb.db'));
  vi.stubEnv('DEAR_STEVEN_ENV_FILE', join(dir, '.env'));
  logs = [];
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push(
        args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : String(a))).join(' '),
      );
    });
  }
  // OpenAI rejects every call, echoing the key it was given, masked, as it really does.
  network = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    Response.json(
      {
        error: {
          message: `Incorrect API key provided: sk-proj-************************${TAIL}. You can find your API key at https://platform.openai.com/account/api-keys.`,
          type: 'invalid_request_error',
          code: 'invalid_api_key',
        },
      },
      { status: 401 },
    ),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the operator's key (P8-01)", () => {
  it('is found on disk for every route, so none is skipped', () => {
    expect(routes()).toEqual(
      expect.arrayContaining(['ask', 'interview', 'speech', 'transcribe', 'key', 'status']),
    );
  });

  it.each(routes())('never comes back out of /api/%s', async (route) => {
    const mod = (await import(join(API, route, 'route.ts'))) as Record<
      string,
      (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>
    >;
    const path = `/api/${route.replace(/\[[^\]]+\]/g, 'ps_1')}`;
    const ctx = { params: Promise.resolve({ id: 'ps_1' }) };
    for (const method of ['GET', 'POST'] as const) {
      const handler = mod[method];
      if (!handler) continue;
      const body = method === 'POST' ? bodyFor(route) : undefined;
      const headers = new Headers({ 'x-forwarded-for': '203.0.113.9', host: 'localhost' });
      if (typeof body === 'string') headers.set('content-type', 'application/json');
      const res = await handler(
        new Request(`http://localhost${path}${method === 'GET' ? '?q=start' : ''}`, {
          method,
          headers,
          body,
        }),
        ctx,
      );
      const out = [
        await res.text(),
        ...[...res.headers].map(([k, v]) => `${k}: ${v}`),
        ...logs,
      ].join('\n');
      expect(pieces.filter((piece) => out.includes(piece))).toEqual([]);
      expect(out).not.toContain(TAIL);
      expect(out).not.toContain('Incorrect API key');
    }
  });

  it('is what the spending routes really run on', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(
      new Request('http://localhost/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
        body: bodyFor('ask'),
      }),
    );
    await res.text();
    const calls = network.mock.calls.filter(([url]) => String(url).includes('api.openai.com'));
    expect(calls.length).toBeGreaterThan(0);
    for (const [url, init] of calls) {
      expect(String(url)).not.toContain(OPERATOR);
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${OPERATOR}`);
    }
  });
});
