import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chunkSegments, contextPrefix } from '@dear-steven/core/ingest';
import type { AskEvent, Segment } from '@dear-steven/core/schema';
import { type EpisodeInput, episodeIdFor, KnowledgeStore } from '@dear-steven/core/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as ask } from '@/app/api/ask/route';
import { POST as interview } from '@/app/api/interview/route';
import { de } from '@/i18n/de';
import { en } from '@/i18n/en';
import { resetRateLimits } from './rate-limit';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));

/**
 * Visitors see errors in their own words; the operator's details go to the log (P10-08). Through
 * the routes, on the operator's key, with OpenAI rejecting every call as it does a revoked key.
 */
const OPERATOR = 'sk-proj-visitorErrorsTest0000000000000000000000';
let dir: string;
let logs: string[];

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

const post = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.40' },
  body: JSON.stringify(body),
});

/** The `error` event at the end of an answer's stream. */
async function streamedError(res: Response): Promise<Extract<AskEvent, { type: 'error' }>> {
  const events = (await res.text())
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => JSON.parse(chunk.slice('data: '.length)) as AskEvent);
  const error = events.find((event) => event.type === 'error');
  if (!error) throw new Error(`no error event in ${JSON.stringify(events)}`);
  return error;
}

/** Nothing a visitor can act on: the env file, an environment variable, a command. */
const OPERATOR_DETAIL = /\.env\b|[A-Z][A-Z0-9]*_[A-Z0-9_]+|\bpnpm\b/;

beforeEach(() => {
  resetRateLimits();
  const handles = (globalThis as { __dearSteven?: { client?: unknown; apiKey?: string } })
    .__dearSteven;
  if (handles) {
    handles.client = undefined;
    handles.apiKey = undefined;
  }
  dir = mkdtempSync(join(tmpdir(), 'dear-steven-visitor-errors-'));
  seed();
  vi.stubEnv('OPENAI_API_KEY', OPERATOR);
  vi.stubEnv('YOUTUBE_API_KEY', '');
  vi.stubEnv('DEAR_STEVEN_DEMO', '');
  vi.stubEnv('DEAR_STEVEN_ALLOW_OPERATOR_KEY', '');
  vi.stubEnv('DEAR_STEVEN_FREE_QUESTIONS', '');
  vi.stubEnv('DEAR_STEVEN_DAILY_BUDGET_USD', '');
  vi.stubEnv('DEAR_STEVEN_ACCESS_CODE', '');
  vi.stubEnv('DEAR_STEVEN_DB_PATH', join(dir, 'kb.db'));
  vi.stubEnv('DEAR_STEVEN_ENV_FILE', join(dir, '.env'));
  logs = [];
  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
  }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    Response.json(
      { error: { message: 'Incorrect API key provided.', code: 'invalid_api_key' } },
      { status: 401 },
    ),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('a rejected operator key (P10-08)', () => {
  it('shows the visitor what happened, and logs what the operator should do', async () => {
    const res = await ask(
      new Request(
        'http://localhost/api/ask',
        post({ question: 'How do I start before I feel ready?', history: [] }),
      ),
    );
    const error = await streamedError(res);
    expect(error).toMatchObject({ code: 'not_configured', message: en.serverErrors.keyRejected });
    expect(error.message).not.toMatch(OPERATOR_DETAIL);
    expect(logs.some((line) => /OPENAI_API_KEY in \.env/.test(line))).toBe(true);
  });

  it('speaks German to a German visitor, and still logs in English', async () => {
    const res = await ask(
      new Request(
        'http://localhost/api/ask',
        post({ question: 'Wie fange ich an?', history: [], uiLocale: 'de' }),
      ),
    );
    expect(await streamedError(res)).toMatchObject({ message: de.serverErrors.keyRejected });
    expect(logs.some((line) => /OPENAI_API_KEY in \.env/.test(line))).toBe(true);
  });

  it('is worded the same way in an interview', async () => {
    const res = await interview(
      new Request('http://localhost/api/interview', post({ setup: {}, turns: [], action: 'next' })),
    );
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({
      error: { code: 'not_configured', message: en.serverErrors.keyRejected },
    });
    expect(logs.some((line) => /\[interview\].*OPENAI_API_KEY in \.env/.test(line))).toBe(true);
  });
});

describe('a knowledge base that can’t be opened (P10-08)', () => {
  it('tells the visitor to come back, and the log where to look', async () => {
    const broken = join(dir, 'broken.db');
    writeFileSync(broken, 'not a database');
    vi.stubEnv('DEAR_STEVEN_DB_PATH', broken);
    const res = await ask(
      new Request('http://localhost/api/ask', post({ question: 'How do I start?', history: [] })),
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe(en.serverErrors.noKnowledgeBase);
    expect(body.error.message).not.toMatch(OPERATOR_DETAIL);
    expect(logs.some((line) => /\[ask\].*DEAR_STEVEN_DB_PATH/.test(line))).toBe(true);
  });
});
