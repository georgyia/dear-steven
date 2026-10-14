import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chunkSegments, contextPrefix } from '@dear-steven/core/ingest';
import type { Segment } from '@dear-steven/core/schema';
import { type EpisodeInput, episodeIdFor, KnowledgeStore } from '@dear-steven/core/store';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { POST as ask } from '@/app/api/ask/route';
import { POST as interview } from '@/app/api/interview/route';
import { POST as speech } from '@/app/api/speech/route';
import { GET as status } from '@/app/api/status/route';
import { POST as transcribe } from '@/app/api/transcribe/route';
import { en } from '@/i18n/en';
import { answerStream, FAKE_QUESTION, jsonReply, MODERATION_OK } from '../../e2e/fake-openai';
import { resetFreeQuestions, TICKET_HEADER, VISITOR_COOKIE } from './free-questions';
import { resetRateLimits } from './rate-limit';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));

/**
 * Free questions on the operator's key (P8-02), through the routes: three answers, then
 * `needs_key` with no call to OpenAI; a whole interview counts once; a key of their own goes on.
 * OpenAI here is `e2e/fake-openai.ts`: answers stream back as a fixture synthesis paragraph, with
 * the tokens they cost, and interview questions come back as JSON.
 */
const OWN_KEY = `sk-proj-${'Ab3'.repeat(16)}`;
let dir: string;
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

const QUESTION = FAKE_QUESTION;

function fakeOpenAI() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    const body = JSON.parse(String(init?.body ?? '{}')) as { input?: unknown; stream?: boolean };
    if (url.endsWith('/embeddings')) {
      const inputs = Array.isArray(body.input) ? body.input : [body.input];
      return Response.json({
        object: 'list',
        model: 'text-embedding-3-small',
        data: inputs.map((_, index) => ({
          object: 'embedding',
          index,
          embedding: Array.from({ length: 1536 }, () => 0.02),
        })),
        usage: { prompt_tokens: 12, total_tokens: 12 },
      });
    }
    if (url.endsWith('/moderations')) return Response.json(MODERATION_OK);
    if (url.endsWith('/responses')) {
      return body.stream
        ? new Response(answerStream(), { headers: { 'content-type': 'text/event-stream' } })
        : Response.json(jsonReply(QUESTION));
    }
    return Response.json(
      { error: { message: 'not here', type: 'invalid_request_error' } },
      { status: 404 },
    );
  });
}

/** One browser: keeps the visitor cookie the server sets. */
function browser(address = '203.0.113.9') {
  let cookie: string | null = null;
  const headers = (extra: Record<string, string> = {}) => {
    const h = new Headers({
      'content-type': 'application/json',
      'x-forwarded-for': address,
      ...extra,
    });
    if (cookie) h.set('cookie', cookie);
    return h;
  };
  const keep = (res: Response) => {
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0] ?? null;
    return res;
  };
  return {
    forget: () => {
      cookie = null;
    },
    ask: async (question: string, extra?: Record<string, string>) => {
      const res = keep(
        await ask(
          new Request('http://localhost/api/ask', {
            method: 'POST',
            headers: headers(extra),
            body: JSON.stringify({ question, history: [] }),
          }),
        ),
      );
      return { res, body: await res.text() };
    },
    interview: async (turns: unknown[], ticket?: string | null) => {
      const res = keep(
        await interview(
          new Request('http://localhost/api/interview', {
            method: 'POST',
            headers: headers(ticket ? { [TICKET_HEADER]: ticket } : {}),
            body: JSON.stringify({ setup: {}, turns, action: 'next' }),
          }),
        ),
      );
      return { res, ticket: res.headers.get(TICKET_HEADER), body: await res.json() };
    },
    status: async () =>
      (await status(new Request('http://localhost/api/status', { headers: headers() }))).json(),
    headers,
  };
}

const turn = (answer: string) => ({ question: QUESTION.question, stage: 'opening', answer });

beforeEach(() => {
  resetRateLimits();
  resetFreeQuestions();
  const handles = (globalThis as { __dearSteven?: { client?: unknown; apiKey?: string } })
    .__dearSteven;
  if (handles) {
    handles.client = undefined;
    handles.apiKey = undefined;
  }
  dir = mkdtempSync(join(tmpdir(), 'dear-steven-free-routes-'));
  seed();
  vi.stubEnv('OPENAI_API_KEY', 'sk-test-not-a-real-key');
  vi.stubEnv('DEAR_STEVEN_FREE_QUESTIONS', '3');
  vi.stubEnv('DEAR_STEVEN_DEMO', '');
  vi.stubEnv('DEAR_STEVEN_ALLOW_OPERATOR_KEY', '');
  // Free questions need a daily cap (P8-09); this one is never reached here.
  vi.stubEnv('DEAR_STEVEN_DAILY_BUDGET_USD', '5');
  vi.stubEnv('DEAR_STEVEN_ACCESS_CODE', '');
  vi.stubEnv('DEAR_STEVEN_DB_PATH', join(dir, 'kb.db'));
  vi.stubEnv('DEAR_STEVEN_ENV_FILE', join(dir, '.env'));
  for (const level of ['log', 'warn', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
  network = fakeOpenAI();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('free questions through the routes (P8-02)', () => {
  it('answers three questions on the operator’s key, then asks for a key without calling OpenAI', async () => {
    const sam = browser();
    for (let i = 0; i < 3; i++) {
      const { res } = await sam.ask(`How do I start, take ${i}?`);
      expect(res.status).toBe(200);
    }
    expect(await sam.status()).toMatchObject({ free: { limit: 3, used: 3, remaining: 0 } });
    network.mockClear();
    const { res, body } = await sam.ask('And a fourth?');
    expect(res.status).toBe(402);
    expect(JSON.parse(body)).toMatchObject({ error: { code: 'needs_key' } });
    expect(network).not.toHaveBeenCalled();
  });

  it('sets an anonymous, HttpOnly visitor cookie with the first question', async () => {
    const res = await ask(
      new Request('http://localhost/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
        body: JSON.stringify({ question: 'How do I start?', history: [] }),
      }),
    );
    await res.text();
    expect(res.headers.get('set-cookie')).toMatch(
      new RegExp(
        `^${VISITOR_COOKIE}=[A-Za-z0-9_-]{22}; Path=/; Max-Age=\\d+; HttpOnly; Secure; SameSite=Lax$`,
      ),
    );
  });

  it('doesn’t count a question that cost nothing', async () => {
    const sam = browser();
    // A safety reply makes no paid call.
    vi.stubEnv('DEAR_STEVEN_FREE_QUESTIONS', '1');
    await sam.ask('I want to kill myself');
    expect(await sam.status()).toMatchObject({ free: { used: 0, remaining: 1 } });
  });

  it('gives a new cookie another allowance only until the network has had nine', async () => {
    const office = browser('198.51.100.20');
    let answered = 0;
    for (let person = 0; person < 5; person++) {
      office.forget();
      resetRateLimits(); // five people, not one person asking fifteen times a minute
      for (let i = 0; i < 3; i++) {
        if ((await office.ask(`Question ${person}.${i}?`)).res.status === 200) answered += 1;
      }
    }
    expect(answered).toBe(9);
    // Somewhere else, a fresh allowance.
    expect((await browser('192.0.2.77').ask('Hello?')).res.status).toBe(200);
  });

  it('counts a whole interview once, and refuses a step with no ticket once they are used up', async () => {
    vi.stubEnv('DEAR_STEVEN_FREE_QUESTIONS', '1');
    const sam = browser();
    const first = await sam.interview([]);
    expect(first.res.status).toBe(200);
    expect(first.ticket).toMatch(/^v1\./);
    let ticket = first.ticket;
    for (let i = 1; i <= 5; i++) {
      const step = await sam.interview(
        Array.from({ length: i }, (_, k) => turn(`Answer ${k}: I run a small design studio.`)),
        ticket,
      );
      expect(step.res.status).toBe(200);
      ticket = step.ticket ?? ticket; // as the client does: a ticket comes once, with the step it covers
    }
    expect(await sam.status()).toMatchObject({ free: { used: 1, remaining: 0 } });
    // Without the ticket, a step is a new question, and there are none left.
    network.mockClear();
    const forged = await sam.interview([turn('One more.')], 'v1.made-up.9999999999999.signature');
    expect(forged.res.status).toBe(402);
    expect(network).not.toHaveBeenCalled();
  });

  it('lets a visitor with their own key carry on, uncounted', async () => {
    vi.stubEnv('DEAR_STEVEN_FREE_QUESTIONS', '1');
    const sam = browser();
    await sam.ask('First?');
    expect((await sam.ask('Second?')).res.status).toBe(402);
    expect((await sam.ask('Second, on my key?', { 'x-openai-key': OWN_KEY })).res.status).toBe(200);
    expect(
      await (
        await status(
          new Request('http://localhost/api/status', {
            headers: sam.headers({ 'x-openai-key': OWN_KEY }),
          }),
        )
      ).json(),
    ).toMatchObject({ free: null });
  });

  it('offers no server voice on free questions: it would read or hear anything for free', async () => {
    const sam = browser();
    const said = await speech(
      new Request('http://localhost/api/speech', {
        method: 'POST',
        headers: sam.headers(),
        body: JSON.stringify({ text: 'Read this aloud for free.' }),
      }),
    );
    expect(said.status).toBe(402);
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(2048)], { type: 'audio/webm' }), 'a.webm');
    const heard = await transcribe(
      new Request('http://localhost/api/transcribe', {
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.9' },
        body: form,
      }),
    );
    expect(heard.status).toBe(402);
    expect(network).not.toHaveBeenCalled();
  });
});

describe('free questions need a daily cap (P8-09)', () => {
  beforeEach(() => vi.stubEnv('DEAR_STEVEN_DAILY_BUDGET_USD', ''));

  it('gives none without a cap, and never asks OpenAI', async () => {
    const sam = browser();
    const asked = await sam.ask('How do I start?');
    expect(asked.res.status).toBe(402);
    expect(JSON.parse(asked.body)).toMatchObject({
      error: { code: 'needs_key', message: en.serverErrors.needsKey(0) },
    });
    const interviewed = await sam.interview([]);
    expect(interviewed.res.status).toBe(402);
    expect(interviewed.ticket).toBeNull();
    expect(await sam.status()).toMatchObject({ free: { limit: 0, used: 0, remaining: 0 } });
    expect(network).not.toHaveBeenCalled();
  });

  it('says why in the log, once, naming both settings', async () => {
    const sam = browser();
    await sam.ask('How do I start?');
    await sam.ask('And then?');
    await sam.status();
    const said = vi
      .mocked(console.error)
      .mock.calls.map((call) => call.join(' '))
      .filter((line) => line.startsWith('[free]'));
    expect(said).toHaveLength(1);
    expect(said[0]).toMatch(/DEAR_STEVEN_FREE_QUESTIONS.*DEAR_STEVEN_DAILY_BUDGET_USD/);
  });

  it('leaves a visitor’s own key alone, and changes nothing once a cap is set', async () => {
    const sam = browser();
    expect((await sam.ask('On my key?', { 'x-openai-key': OWN_KEY })).res.status).toBe(200);
    vi.stubEnv('DEAR_STEVEN_DAILY_BUDGET_USD', '2');
    expect((await sam.ask('And on yours, now there is a cap?')).res.status).toBe(200);
    expect(await sam.status()).toMatchObject({ free: { limit: 3, used: 1, remaining: 2 } });
  });
});
