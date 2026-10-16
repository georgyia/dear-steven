import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chunkSegments, contextPrefix } from '@dear-steven/core/ingest';
import type { Segment } from '@dear-steven/core/schema';
import { type EpisodeInput, episodeIdFor, KnowledgeStore } from '@dear-steven/core/store';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { GET } from './route';

/**
 * The health check (P10-02): 200 only when this deployment can do what it was configured to do,
 * 503 with a reason code otherwise, and nothing else in the answer. It never calls OpenAI.
 */
let dir: string;
let network: MockInstance<typeof fetch>;

/** A knowledge base holding one episode's passages, or none at all. */
function knowledgeBase(withPassages: boolean) {
  const store = KnowledgeStore.open(join(dir, 'kb.db'), { create: true });
  if (withPassages) {
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
  }
  store.close();
}

async function health() {
  const res = GET();
  return { status: res.status, cache: res.headers.get('cache-control'), body: await res.json() };
}

beforeEach(() => {
  delete (globalThis as { __dearStevenHeldBackSaid?: boolean }).__dearStevenHeldBackSaid;
  dir = mkdtempSync(join(tmpdir(), 'dear-steven-health-'));
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('OPENAI_API_KEY', '');
  vi.stubEnv('DEAR_STEVEN_DEMO', '');
  vi.stubEnv('DEAR_STEVEN_ALLOW_OPERATOR_KEY', '');
  vi.stubEnv('DEAR_STEVEN_DAILY_BUDGET_USD', '');
  vi.stubEnv('DEAR_STEVEN_DB_PATH', join(dir, 'kb.db'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  network = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  expect(network).not.toHaveBeenCalled();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GET /api/health (P10-02)', () => {
  it('answers 200 when live on the operator’s key, under a cap, and the knowledge base is ready', async () => {
    knowledgeBase(true);
    vi.stubEnv('OPENAI_API_KEY', 'sk-operator-not-a-real-key-0000000000');
    vi.stubEnv('DEAR_STEVEN_DAILY_BUDGET_USD', '2');
    expect(await health()).toEqual({ status: 200, cache: 'no-store', body: { ok: true } });
  });

  it('answers 200 when keyless on purpose, so visitors bring their own key, and ready', async () => {
    knowledgeBase(true);
    expect(await health()).toMatchObject({ status: 200, body: { ok: true } });
    vi.stubEnv('OPENAI_API_KEY', 'sk-operator-not-a-real-key-0000000000');
    vi.stubEnv('DEAR_STEVEN_ALLOW_OPERATOR_KEY', '0');
    expect(await health()).toMatchObject({ status: 200, body: { ok: true } });
  });

  it('answers 200 in forced demo mode, which needs no database', async () => {
    vi.stubEnv('DEAR_STEVEN_DEMO', '1');
    expect(await health()).toMatchObject({ status: 200, body: { ok: true } });
  });

  it.each([
    ['no_database', 'a missing file', () => {}],
    ['empty', 'a database with no passages', () => knowledgeBase(false)],
    [
      'store_error',
      'a file that is not a database',
      () => writeFileSync(join(dir, 'kb.db'), 'not a database, only some text'.repeat(200)),
    ],
    [
      'no_daily_cap',
      'the operator’s key held back for want of a cap (P10-01)',
      () => {
        knowledgeBase(true);
        vi.stubEnv('OPENAI_API_KEY', 'sk-operator-not-a-real-key-0000000000');
      },
    ],
  ])('answers 503 %s for %s, and nothing but the code', async (reason, _, arrange) => {
    arrange();
    const answer = await health();
    expect(answer).toEqual({ status: 503, cache: 'no-store', body: { ok: false, reason } });
  });

  it.skipIf(process.getuid?.() === 0)(
    'answers 503 data_dir_read_only when the data folder can’t be written',
    async () => {
      knowledgeBase(true);
      chmodSync(dir, 0o555);
      try {
        const answer = await health();
        expect(answer).toEqual({
          status: 503,
          cache: 'no-store',
          body: { ok: false, reason: 'data_dir_read_only' },
        });
      } finally {
        chmodSync(dir, 0o755);
      }
    },
  );
});
