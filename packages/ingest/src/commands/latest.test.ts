import { mkdtempSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from '@dear-steven/core/config';
import { MODELS } from '@dear-steven/core/models';
import { type EpisodeInput, episodeIdFor, KnowledgeStore } from '@dear-steven/core/store';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context } from '../context.ts';
import { latest, latestEstimateUsd, latestTargets, newestPublished } from './latest.ts';

const DAY = 86_400_000;
const NOW = Date.now();
const rfc822 = (ms: number) => new Date(ms).toUTCString();

const VTT = `WEBVTT

${Array.from({ length: 16 }, (_, i) => {
  const t = (s: number) => `00:00:${String(s).padStart(2, '0')}.000`;
  return `${t(i * 3)} --> ${t(i * 3 + 3)}\nFixture line ${i} about doing the work before you feel ready.`;
}).join('\n\n')}
`;

let server: Server;
let base = '';
const requests: string[] = [];

/** The feed carries an episode already in the knowledge base and one published two days ago. */
const feed = () => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0">
<channel><title>Fixture feed</title>
<item>
  <title>Fixture Guest Two: A New Episode</title>
  <guid isPermaLink="false">fixture-new</guid>
  <pubDate>${rfc822(NOW - 2 * DAY)}</pubDate>
  <itunes:episodeType>full</itunes:episodeType>
  <itunes:duration>3600</itunes:duration>
  <podcast:transcript url="${base}/new.vtt" type="text/vtt"></podcast:transcript>
</item>
<item>
  <title>Fixture Guest One: An Old Episode</title>
  <guid isPermaLink="false">fixture-old</guid>
  <pubDate>${rfc822(NOW - 400 * DAY)}</pubDate>
  <itunes:episodeType>full</itunes:episodeType>
  <itunes:duration>3600</itunes:duration>
  <podcast:transcript url="${base}/old.vtt" type="text/vtt"></podcast:transcript>
</item>
</channel></rss>`;

beforeAll(async () => {
  server = createServer((req, res) => {
    requests.push(req.url ?? '');
    if (req.url === '/feed.xml') res.end(feed());
    else if (req.url?.endsWith('.vtt')) res.end(VTT);
    else res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const OLD: EpisodeInput = {
  sourceGuid: 'fixture-old',
  title: 'Fixture Guest One: An Old Episode',
  description: '',
  publishedAt: new Date(NOW - 400 * DAY).toISOString(),
  durationMs: 3_600_000,
  episodeType: 'full',
  guestNames: ['Fixture Guest One'],
  audioUrl: null,
  transcriptUrl: 'https://example.test/old.vtt',
};

/** A knowledge base that already holds the old episode, and an OpenAI that must not be asked. */
function context(env: Record<string, string> = {}): Context & { asked: () => number } {
  const dir = mkdtempSync(join(tmpdir(), 'dear-steven-latest-'));
  const store = KnowledgeStore.open(join(dir, 'kb.db'), { create: true });
  store.upsertEpisodes([OLD]);
  store.replaceTranscript(
    episodeIdFor(OLD.sourceGuid),
    [
      {
        idx: 0,
        startMs: 0,
        endMs: 3000,
        speaker: 'unknown',
        speakerName: null,
        attributionMethod: 'none',
        attributionConfidence: null,
        text: 'Already in.',
      },
    ],
    'rss-vtt',
  );
  let asked = 0;
  return {
    root: dir,
    config: readConfig({ DEAR_STEVEN_DB_PATH: join(dir, 'kb.db'), ...env }),
    store,
    dataDir: dir,
    openai: () => {
      asked += 1;
      throw new Error('OpenAI must not be called');
    },
    asked: () => asked,
  };
}

const NEW_ID = episodeIdFor('fixture-new');

describe('latest (P6-16)', () => {
  beforeEach(() => {
    requests.length = 0;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    return () => vi.restoreAllMocks();
  });

  it('brings in exactly the new episode, and a second run adds nothing', async () => {
    const ctx = context();
    await latest(ctx, { days: 14, dryRun: false, feed: `${base}/feed.xml` });

    expect(requests).toEqual(['/feed.xml', '/new.vtt']);
    expect(ctx.store.passageCount(NEW_ID)).toBeGreaterThan(0);
    const passages = ctx.store.passageCount(NEW_ID);

    requests.length = 0;
    await latest(ctx, { days: 14, dryRun: false, feed: `${base}/feed.xml` });
    expect(requests).toEqual(['/feed.xml']);
    expect(ctx.store.passageCount(NEW_ID)).toBe(passages);
    expect(ctx.asked()).toBe(0);
  });

  it('with --dry-run, lists the new episode and fetches no transcript', async () => {
    const ctx = context();
    await latest(ctx, { days: 14, dryRun: true, feed: `${base}/feed.xml` });

    expect(requests).toEqual(['/feed.xml']);
    expect(ctx.store.passageCount(NEW_ID)).toBe(0);
    const printed = vi.mocked(console.log).mock.calls.flat().join('\n');
    expect(printed).toContain('Fixture Guest Two: A New Episode');
    expect(printed).not.toContain('Fixture Guest One: An Old Episode');
  });

  it('stops before any paid call when embedding is over the budget', async () => {
    const ctx = context({ OPENAI_API_KEY: 'sk-test-not-a-real-key' });
    await latest(ctx, { days: 14, dryRun: false, budget: 0.000_000_1, feed: `${base}/feed.xml` });

    expect(ctx.asked()).toBe(0);
    expect(ctx.store.countNeedingEmbedding(MODELS.embedding).passages).toBeGreaterThan(0);
    const printed = vi.mocked(console.log).mock.calls.flat().join('\n');
    expect(printed).toMatch(/Stopped before paying/);
  });

  it('without --budget, embeds nothing and says why', async () => {
    const ctx = context({ OPENAI_API_KEY: 'sk-test-not-a-real-key' });
    await latest(ctx, { days: 14, dryRun: false, feed: `${base}/feed.xml` });

    expect(ctx.asked()).toBe(0);
    const printed = vi.mocked(console.log).mock.calls.flat().join('\n');
    expect(printed).toMatch(/Add --budget/);
  });
});

describe('latestTargets', () => {
  const at = (days: number, guid: string, extra: Partial<EpisodeInput> = {}): EpisodeInput => ({
    ...OLD,
    sourceGuid: guid,
    title: guid,
    publishedAt: new Date(NOW - days * DAY).toISOString(),
    ...extra,
  });

  const open = () =>
    KnowledgeStore.open(join(mkdtempSync(join(tmpdir(), 'dear-steven-latest-')), 'kb.db'), {
      create: true,
    });

  it('takes the last N days and nothing from the back catalogue', () => {
    const store = open();
    store.upsertEpisodes([
      at(3, 'recent'),
      at(1, 'brand-new'),
      at(40, 'last-month'),
      at(500, 'back-catalogue'),
      at(1, 'no-transcript', { transcriptUrl: null }),
      at(1, 'a-bonus', { episodeType: 'bonus' }),
    ]);

    const ids = latestTargets(store, null, 14, new Date(NOW)).map((e) => e.sourceGuid);
    expect(ids).toEqual(['brand-new', 'recent']);
  });

  it('after a long gap, catches up on everything since the newest episode it had', () => {
    const store = open();
    store.upsertEpisodes([at(60, 'had-this')]);
    store.replaceTranscript(episodeIdFor('had-this'), [], 'rss-vtt');
    const newest = newestPublished(store);
    store.upsertEpisodes([at(1, 'this-week'), at(45, 'during-the-gap'), at(90, 'older')]);

    const ids = latestTargets(store, newest, 14, new Date(NOW)).map((e) => e.sourceGuid);
    expect(ids).toEqual(['this-week', 'during-the-gap']);
  });

  it('estimates from running time, before anything is fetched', () => {
    const hour = { ...OLD, id: 'x', durationMs: 3_600_000 } as never;
    expect(latestEstimateUsd([hour])).toBeCloseTo((60 * 200 * 0.02) / 1_000_000, 10);
  });
});
