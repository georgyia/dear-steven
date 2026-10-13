import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chunkSegments, contextPrefix } from '@dear-steven/core/ingest';
import { type Segment, SUMMARY_VERSION } from '@dear-steven/core/schema';
import { type EpisodeInput, episodeIdFor, KnowledgeStore } from '@dear-steven/core/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/episodes/[id]/summary/route';
import { resetRateLimits } from './rate-limit';

/** GET /api/episodes/:id/summary (P8-04): the stored summary with citations, and nothing else. */
const LINE =
  'Fixture line: start the work before you feel ready, and the feeling follows the action.';
let dir: string;

function seed(summarised: boolean): string {
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
  const segments: Segment[] = Array.from({ length: 30 }, (_, idx) => ({
    idx,
    startMs: idx * 8000,
    endMs: idx * 8000 + 7000,
    speaker: 'unknown',
    speakerName: null,
    attributionMethod: 'none',
    attributionConfidence: null,
    text: `${LINE} (${idx})`,
  }));
  const id = episodeIdFor(episode.sourceGuid);
  store.replaceTranscript(id, segments, 'rss-vtt');
  store.replacePassages(id, chunkSegments(segments), contextPrefix(episode));
  const first = store.episodePassages(id)[0];
  if (summarised && first) {
    store.saveConversationSummary(id, {
      version: SUMMARY_VERSION,
      model: 'test-model',
      createdAt: '2026-10-13T12:00:00.000Z',
      speakers: 'unverified',
      about: 'The conversation covers starting before you feel ready.',
      topics: [{ title: 'Starting', passageId: first.id, startMs: first.startMs }],
      moments: [{ passageId: first.id, startMs: 8000, text: `${LINE} (1)`, label: 'Starting' }],
      exchanges: [],
    });
  }
  store.close();
  return id;
}

const get = (id: string) =>
  GET(
    new Request(`http://localhost/api/episodes/${id}/summary`, {
      headers: { 'x-forwarded-for': '203.0.113.9' },
    }),
    {
      params: Promise.resolve({ id }),
    },
  );

beforeEach(() => {
  resetRateLimits();
  const handles = (globalThis as { __dearSteven?: { store?: { close(): void }; dbPath?: string } })
    .__dearSteven;
  handles?.store?.close();
  if (handles) {
    handles.store = undefined;
    handles.dbPath = undefined;
  }
  dir = mkdtempSync(join(tmpdir(), 'dear-steven-summary-route-'));
  vi.stubEnv('OPENAI_API_KEY', '');
  vi.stubEnv('DEAR_STEVEN_DEMO', '');
  vi.stubEnv('DEAR_STEVEN_ACCESS_CODE', '');
  vi.stubEnv('DEAR_STEVEN_DB_PATH', join(dir, 'kb.db'));
  vi.stubEnv('DEAR_STEVEN_ENV_FILE', join(dir, '.env'));
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/episodes/:id/summary (P8-04)', () => {
  it('returns the stored summary with its citations, and makes no network call', async () => {
    // A key, so the server is live, but nothing may be called for a summary.
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-not-a-real-key');
    const network = vi.spyOn(globalThis, 'fetch');
    const id = seed(true);
    const res = await get(id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.moments[0].citation).toMatchObject({
      excerpt: `${LINE} (1)`,
      startMs: 8000,
    });
    expect(body.summary.demo).toBe(false);
    // Nothing from the transcript but the summary's own spans.
    expect(JSON.stringify(body)).not.toContain(`${LINE} (20)`);
    expect(network).not.toHaveBeenCalled();
    network.mockRestore();
  });

  it('says there is no summary yet, and 404s an episode it doesn’t know', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-not-a-real-key');
    const id = seed(false);
    expect(await (await get(id)).json()).toMatchObject({ episode: { id }, summary: null });
    expect((await get('ep_unknown')).status).toBe(404);
    expect((await get('../etc')).status).toBe(400);
  });

  it('serves the labelled demo summaries in demo mode', async () => {
    const body = await (await get('demo_ep_1')).json();
    expect(body.summary).toMatchObject({
      demo: true,
      about: expect.stringMatching(/^Demo summary/),
    });
  });

  it('is rate limited like the other knowledge-base reads', async () => {
    let status = 200;
    for (let i = 0; i < 130 && status === 200; i++) status = (await get('demo_ep_1')).status;
    expect(status).toBe(429);
  });
});
