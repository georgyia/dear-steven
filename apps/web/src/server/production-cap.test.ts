import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chunkSegments, contextPrefix } from '@dear-steven/core/ingest';
import type { Segment } from '@dear-steven/core/schema';
import { type EpisodeInput, episodeIdFor, KnowledgeStore } from '@dear-steven/core/store';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { POST as ask } from '@/app/api/ask/route';
import { GET as status } from '@/app/api/status/route';
import { resetRateLimits } from './rate-limit';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));

/**
 * A production server spends the operator's key only under a daily cap (P10-01). Without one it
 * answers as if no operator key was given: demo, with the reason on `/api/status`, one log line
 * naming the variable, and no request to OpenAI on the operator's key. A visitor's own key still
 * works there. OpenAI here refuses every call; what matters is whose key each call carried.
 */
const OPERATOR = 'sk-operator-not-a-real-key-0000000000';
const OWN = `sk-proj-${'Ab3'.repeat(16)}`;
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
  const segments: Segment[] = Array.from({ length: 20 }, (_, idx) => ({
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

const headers = (key?: string) => {
  const h = new Headers({ 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' });
  if (key) h.set('x-openai-key', key);
  return h;
};

const askQuestion = async (key?: string) => {
  const res = await ask(
    new Request('http://localhost/api/ask', {
      method: 'POST',
      headers: headers(key),
      body: JSON.stringify({ question: 'How do I start before I feel ready?', history: [] }),
    }),
  );
  return { res, body: await res.text() };
};

const statusOf = async (key?: string) =>
  (await status(new Request('http://localhost/api/status', { headers: headers(key) }))).json();

/** The key each request to OpenAI carried. */
const keysSent = () =>
  network.mock.calls
    .filter(([url]) => String(url).startsWith('https://api.openai.com/'))
    .map(([, init]) => new Headers(init?.headers).get('authorization'));

beforeEach(() => {
  resetRateLimits();
  // The operator's client is cached for the process, holding the `fetch` it was made with.
  const handles = (globalThis as { __dearSteven?: { client?: unknown; apiKey?: string } })
    .__dearSteven;
  if (handles) {
    handles.client = undefined;
    handles.apiKey = undefined;
  }
  delete (globalThis as { __dearStevenHeldBackSaid?: boolean }).__dearStevenHeldBackSaid;
  dir = mkdtempSync(join(tmpdir(), 'dear-steven-production-cap-'));
  seed();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('OPENAI_API_KEY', OPERATOR);
  vi.stubEnv('DEAR_STEVEN_DEMO', '');
  vi.stubEnv('DEAR_STEVEN_ALLOW_OPERATOR_KEY', '');
  vi.stubEnv('DEAR_STEVEN_DAILY_BUDGET_USD', '');
  vi.stubEnv('DEAR_STEVEN_FREE_QUESTIONS', '');
  vi.stubEnv('DEAR_STEVEN_ACCESS_CODE', '');
  vi.stubEnv('DEAR_STEVEN_DB_PATH', join(dir, 'kb.db'));
  vi.stubEnv('DEAR_STEVEN_ENV_FILE', join(dir, '.env'));
  logs = [];
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
  }
  network = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () =>
      Response.json(
        { error: { message: 'refused here', type: 'invalid_request_error' } },
        { status: 401 },
      ),
    );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('a production server without a daily cap (P10-01)', () => {
  it('reports demo on /api/status, with the reason', async () => {
    expect(await statusOf()).toMatchObject({
      mode: 'demo',
      demoReason: 'no_daily_cap',
      spend: { capUsd: null },
      setup: { openaiKey: false, visitorKey: false },
    });
  });

  it("answers from the demo fixtures, and never calls OpenAI on the operator's key", async () => {
    const { res, body } = await askQuestion();
    expect(res.status).toBe(200);
    expect(body).toContain('"demo":true');
    expect(network).not.toHaveBeenCalled();
  });

  it('says why once in the log, naming the variable to set and never the key', async () => {
    await statusOf();
    await askQuestion();
    await statusOf();
    const said = logs.filter((line) => line.startsWith('[config]'));
    expect(said).toHaveLength(1);
    expect(said[0]).toContain('DEAR_STEVEN_DAILY_BUDGET_USD');
    expect(logs.join('\n')).not.toContain(OPERATOR);
  });

  it("still runs a visitor's own key", async () => {
    expect(await statusOf(OWN)).toMatchObject({
      mode: 'live',
      demoReason: null,
      setup: { openaiKey: true, visitorKey: true },
    });
    await askQuestion(OWN);
    expect(keysSent().length).toBeGreaterThan(0);
    expect(new Set(keysSent())).toEqual(new Set([`Bearer ${OWN}`]));
  });
});

describe('a production server with a daily cap (P10-01)', () => {
  beforeEach(() => vi.stubEnv('DEAR_STEVEN_DAILY_BUDGET_USD', '2'));

  it("runs live on the operator's key, as before", async () => {
    expect(await statusOf()).toMatchObject({
      mode: 'live',
      demoReason: null,
      spend: { capUsd: 2 },
      setup: { openaiKey: true, visitorKey: false },
    });
    await askQuestion();
    expect(keysSent().length).toBeGreaterThan(0);
    expect(new Set(keysSent())).toEqual(new Set([`Bearer ${OPERATOR}`]));
    expect(logs.filter((line) => line.startsWith('[config]'))).toEqual([]);
  });
});

describe('outside production (P10-01)', () => {
  it("runs live on the operator's key without a cap, as before", async () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(await statusOf()).toMatchObject({ mode: 'live', demoReason: null });
    await askQuestion();
    expect(new Set(keysSent())).toEqual(new Set([`Bearer ${OPERATOR}`]));
    expect(logs.filter((line) => line.startsWith('[config]'))).toEqual([]);
  });
});
