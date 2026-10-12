import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from '@dear-steven/core/config';
import { chunkSegments, contextPrefix } from '@dear-steven/core/ingest';
import { MODELS } from '@dear-steven/core/models';
import type { Segment } from '@dear-steven/core/schema';
import { type EpisodeInput, episodeIdFor, KnowledgeStore } from '@dear-steven/core/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Context } from '../context.ts';
import { index } from './index.ts';

const EPISODE: EpisodeInput = {
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

/** A knowledge base with a few passages waiting for embeddings, and an OpenAI that must not be asked. */
function context(): Context & { asked: () => number } {
  const dir = mkdtempSync(join(tmpdir(), 'dear-steven-index-'));
  const store = KnowledgeStore.open(join(dir, 'kb.db'), { create: true });
  store.upsertEpisodes([EPISODE]);
  const segments: Segment[] = Array.from({ length: 12 }, (_, idx) => ({
    idx,
    startMs: idx * 8000,
    endMs: idx * 8000 + 7000,
    speaker: 'unknown',
    speakerName: null,
    attributionMethod: 'none',
    attributionConfidence: null,
    text: `Sentence ${idx} about starting the work before you feel ready for it.`,
  }));
  const id = episodeIdFor(EPISODE.sourceGuid);
  store.replaceTranscript(id, segments, 'rss-vtt');
  store.replacePassages(id, chunkSegments(segments), contextPrefix(EPISODE));
  let asked = 0;
  return {
    root: dir,
    config: readConfig({ DEAR_STEVEN_DB_PATH: join(dir, 'kb.db') }),
    store,
    dataDir: dir,
    openai: () => {
      asked += 1;
      throw new Error('OpenAI must not be called');
    },
    asked: () => asked,
  };
}

describe('index --budget (P6-04)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('embeds nothing, and never calls OpenAI, when the estimate is over the budget', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const ctx = context();
    expect(ctx.store.countNeedingEmbedding(MODELS.embedding).passages).toBeGreaterThan(0);
    await expect(index(ctx, { dryRun: false, budget: 0.000_000_1 })).rejects.toThrow(
      /over the --budget of \$0\.000; nothing was embedded/,
    );
    expect(ctx.asked()).toBe(0);
  });

  it('goes ahead when the estimate fits', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const ctx = context();
    await expect(index(ctx, { dryRun: false, budget: 1 })).rejects.toThrow(/must not be called/);
    expect(ctx.asked()).toBe(1);
  });
});
