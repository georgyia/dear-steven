import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from '@dear-steven/core/config';
import { chunkSegments, contextPrefix } from '@dear-steven/core/ingest';
import type { Segment, SetupEvent, SetupState } from '@dear-steven/core/schema';
import { type EpisodeInput, episodeIdFor, KnowledgeStore } from '@dear-steven/core/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as keys } from '@/app/api/setup/keys/route';
import { GET as state } from '@/app/api/setup/route';
import { POST as run } from '@/app/api/setup/run/route';
import { MESSAGES } from '@/i18n';
import { readEvents } from '@/lib/sse';
import { runningStage, setupAllowed, setupToken, stageResponse } from './setup';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));

/**
 * Guided local setup (P6-04): off unless this server was started for it, refused to anything not
 * plainly from this machine with the token, and never echoing a key. Stages run through the real
 * ingest CLI.
 */
const TOKEN = 'T'.repeat(43);
const CANARY = `sk-canary-${'Zq9'.repeat(12)}`;
const copy = MESSAGES.en.serverErrors;
const SETUP_ENV = { DEAR_STEVEN_SETUP_TOKEN: TOKEN, DEAR_STEVEN_SETUP_HOST: '127.0.0.1' };

let dir: string;

const request = (
  path: string,
  init: { body?: unknown; headers?: Record<string, string>; token?: string | null } = {},
) => {
  const { body, token = TOKEN } = init;
  const headers = new Headers({ host: '127.0.0.1:3000', ...init.headers });
  if (token !== null) headers.set('x-setup-token', token);
  if (body !== undefined) headers.set('content-type', 'application/json');
  return new Request(`http://127.0.0.1:3000${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
};

/** A knowledge base with passages waiting for embeddings. */
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
  const segments: Segment[] = Array.from({ length: 400 }, (_, idx) => ({
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

const collect = async (res: Response) => {
  const events: SetupEvent[] = [];
  for await (const e of readEvents<SetupEvent>(res.body as ReadableStream<Uint8Array>)) {
    events.push(e);
  }
  return events;
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dear-steven-setup-'));
  vi.stubEnv('OPENAI_API_KEY', '');
  vi.stubEnv('YOUTUBE_API_KEY', '');
  vi.stubEnv('DEAR_STEVEN_DAILY_BUDGET_USD', '');
  vi.stubEnv('DEAR_STEVEN_DEMO', '');
  vi.stubEnv('DEAR_STEVEN_DB_PATH', join(dir, 'kb.db'));
  vi.stubEnv('DEAR_STEVEN_ENV_FILE', join(dir, '.env'));
  for (const [k, v] of Object.entries(SETUP_ENV)) vi.stubEnv(k, v);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('who may use setup', () => {
  it('is off unless the server was started for it on this machine', () => {
    expect(setupToken({})).toBeNull();
    expect(setupToken({ ...SETUP_ENV, DEAR_STEVEN_SETUP_TOKEN: 'short' })).toBeNull();
    expect(setupToken({ ...SETUP_ENV, DEAR_STEVEN_SETUP_HOST: '0.0.0.0' })).toBeNull();
    expect(setupToken({ ...SETUP_ENV, DEAR_STEVEN_SETUP_HOST: '192.168.1.20' })).toBeNull();
    expect(setupToken(SETUP_ENV)).toBe(TOKEN);
  });

  it('takes only same-page requests that name this machine and carry the token', () => {
    expect(setupAllowed(request('/api/setup'))).toBe(true);
    expect(setupAllowed(request('/api/setup', { headers: { host: 'localhost:3000' } }))).toBe(true);
    for (const [why, req] of [
      ['no token', request('/api/setup', { token: null })],
      ['wrong token', request('/api/setup', { token: 'U'.repeat(43) })],
      ['token prefix', request('/api/setup', { token: TOKEN.slice(0, 32) })],
      ['LAN address', request('/api/setup', { headers: { host: '192.168.1.20:3000' } })],
      ['rebound name', request('/api/setup', { headers: { host: 'evil.example:3000' } })],
      ['other origin', request('/api/setup', { headers: { origin: 'http://evil.example' } })],
      ['cross-site', request('/api/setup', { headers: { 'sec-fetch-site': 'cross-site' } })],
      ['via a proxy', request('/api/setup', { headers: { 'x-forwarded-for': '203.0.113.9' } })],
    ] as const) {
      expect(setupAllowed(req), why).toBe(false);
    }
    const local = { origin: 'http://127.0.0.1:3000', 'x-forwarded-for': '::ffff:127.0.0.1' };
    expect(setupAllowed(request('/api/setup', { headers: local }))).toBe(true);
  });

  it('answers 404 on every route otherwise — the same as a server without it', async () => {
    vi.stubEnv('DEAR_STEVEN_SETUP_TOKEN', '');
    for (const res of [
      await state(request('/api/setup')),
      await keys(request('/api/setup/keys', { body: { openaiApiKey: CANARY } })),
      await run(request('/api/setup/run', { body: { stage: 'discover' } })),
    ]) {
      expect(res.status).toBe(404);
    }
    expect(() => readFileSync(join(dir, '.env'))).toThrow();
  });
});

describe('saving keys', () => {
  it('writes .env and applies at once, but never says a key back', async () => {
    writeFileSync(join(dir, '.env'), '# mine\nOTHER=kept\n');
    const res = await keys(
      request('/api/setup/keys', { body: { openaiApiKey: CANARY, dailyBudgetUsd: 2 } }),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(CANARY);
    expect(text).not.toContain(CANARY.slice(-4));
    const body = JSON.parse(text) as SetupState;
    expect(body.keys).toEqual({ openai: true, youtube: false });
    expect(body.dailyBudgetUsd).toBe(2);
    expect(readFileSync(join(dir, '.env'), 'utf8')).toBe(
      `# mine\nOTHER=kept\nOPENAI_API_KEY=${CANARY}\nDEAR_STEVEN_DAILY_BUDGET_USD=2\n`,
    );
    expect(readConfig()).toMatchObject({ openaiApiKey: CANARY, mode: 'live', dailyBudgetUsd: 2 });
  });

  it('refuses a value that could write a second line, without repeating it', async () => {
    const res = await keys(
      request('/api/setup/keys', { body: { openaiApiKey: `${CANARY}\nDEAR_STEVEN_DEMO=0` } }),
    );
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain(copy.setupKeysInvalid);
    expect(text).not.toContain('Zq9');
    expect(() => readFileSync(join(dir, '.env'))).toThrow();
  });
});

describe('running stages', () => {
  it('will not embed when the estimate is over the budget — no process is started', async () => {
    seed();
    vi.stubEnv('OPENAI_API_KEY', CANARY);
    const res = await run(
      request('/api/setup/run', { body: { stage: 'index', budgetUsd: 0.000_001 } }),
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(
      /Embedding would cost about \$0\.\d{3}, over your \$0\.000 limit/,
    );
    expect(runningStage()).toBeNull();
    const noBudget = await run(request('/api/setup/run', { body: { stage: 'index' } }));
    expect(noBudget.status).toBe(400);
  });

  it('needs the key a stage runs on', async () => {
    seed();
    const index = await run(request('/api/setup/run', { body: { stage: 'index', budgetUsd: 1 } }));
    expect(await index.text()).toContain(copy.setupNeedsOpenAI);
    const link = await run(request('/api/setup/run', { body: { stage: 'match-youtube' } }));
    expect(await link.text()).toContain(copy.setupNeedsYouTube);
  });

  it('runs a stage through the CLI, streams it, and one at a time', async () => {
    seed();
    const first = await run(request('/api/setup/run', { body: { stage: 'chunk' } }));
    expect(first.headers.get('content-type')).toContain('text/event-stream');
    const second = await run(request('/api/setup/run', { body: { stage: 'discover' } }));
    expect(second.status).toBe(409);
    expect(await second.text()).toContain(copy.setupBusy);

    const events = await collect(first);
    expect(events.at(-1)).toEqual({ type: 'done', ok: true });
    expect(events.some((e) => e.type === 'line' && /Nothing to chunk/.test(e.text))).toBe(true);
    expect(runningStage()).toBeNull();
  });

  it('will not let the panel set a bigger budget for new episodes than for embedding', async () => {
    seed();
    const res = await run(request('/api/setup/run', { body: { stage: 'latest', budgetUsd: 25 } }));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain(copy.setupBadStage);
    expect(runningStage()).toBeNull();
  });

  it('brings in new episodes through the same CLI command as the terminal (P6-16)', async () => {
    seed();
    const published = new Date(Date.now() - 86_400_000).toUTCString();
    const vtt = 'WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nA fixture line, published yesterday.\n';
    const server = createServer((req, res) => {
      if (req.url === '/new.vtt') return res.end(vtt);
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      res.end(`<?xml version="1.0"?><rss xmlns:podcast="https://podcastindex.org/namespace/1.0"><channel>
        <item><title>Fixture Guest: New This Week</title><guid>fixture-new</guid>
        <pubDate>${published}</pubDate>
        <podcast:transcript url="${base}/new.vtt" type="text/vtt"/></item></channel></rss>`);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    vi.stubEnv(
      'DEAR_STEVEN_FEED_URL',
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/feed.xml`,
    );
    try {
      const res = await run(request('/api/setup/run', { body: { stage: 'latest' } }));
      const events = await collect(res);
      const lines = events.flatMap((e) => (e.type === 'line' ? [e.text] : []));
      expect(events.at(-1)).toEqual({ type: 'done', ok: true });
      expect(lines).toContain('1 new episode answerable now.');
    } finally {
      server.close();
    }
  });

  it('shows what a terminal would, and says when a stage failed', async () => {
    const script = [
      "process.stdout.write('\\x1b[33mone\\x1b[0m\\n');",
      "process.stdout.write('10 listed\\r20 listed\\r30 listed\\n\\n\\r\\x1b[2K\\n');",
      "process.stderr.write('✗ broke\\n');",
      "process.stdout.write('no newline at the end');",
      'process.exit(2);',
    ].join('');
    const res = stageResponse({ stage: 'discover' }, new AbortController().signal, () =>
      spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'pipe'] }),
    );
    const events = await collect(res);
    const lines = events.flatMap((e) => (e.type === 'line' ? [e.text] : []));
    expect(lines.sort()).toEqual(['30 listed', 'no newline at the end', 'one', '✗ broke']);
    expect(events.at(-1)).toEqual({ type: 'done', ok: false });
  });

  it('stops the stage when the page goes away', async () => {
    const ctrl = new AbortController();
    const res = stageResponse({ stage: 'discover' }, ctrl.signal, () =>
      spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60_000)'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
    setTimeout(() => ctrl.abort(), 100);
    const events = await collect(res);
    expect(events.at(-1)).toEqual({ type: 'done', ok: false });
    expect(runningStage()).toBeNull();
  });
});
