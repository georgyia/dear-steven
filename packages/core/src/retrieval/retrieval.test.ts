import { describe, expect, it } from 'vitest';
import { embeddingInput } from '../openai/embedder.ts';
import type { SearchHit } from '../store/index.ts';
import { fakeEmbedder, seedEpisode, tempStore } from '../test/fixtures.ts';
import { hybridSearch } from './hybrid.ts';
import { diversify, reciprocalRankFusion } from './rrf.ts';

const hit = (pk: number, rank: number, episodeId = `e${pk}`): SearchHit => ({
  pk,
  passageId: `p${pk}`,
  episodeId,
  rank,
  score: 0,
});

describe('reciprocalRankFusion', () => {
  it('rewards passages that both searches agree on', () => {
    const fused = reciprocalRankFusion([
      { source: 'keyword', hits: [hit(1, 1), hit(2, 2), hit(3, 3)] },
      { source: 'semantic', hits: [hit(3, 1), hit(4, 2), hit(1, 3)] },
    ]);
    expect(fused.map((f) => f.pk).slice(0, 2)).toEqual([1, 3]);
    expect(fused[0]?.sources).toEqual(['keyword', 'semantic']);
    expect(fused[0]?.score).toBeCloseTo(1 / 61 + 1 / 63);
  });

  it('is a no-op ordering for a single list', () => {
    const fused = reciprocalRankFusion([{ source: 'keyword', hits: [hit(5, 1), hit(6, 2)] }]);
    expect(fused.map((f) => f.pk)).toEqual([5, 6]);
  });
});

describe('diversify', () => {
  it('caps passages per episode and the total', () => {
    const hits = [1, 2, 3, 4, 5, 6].map((pk) => ({ pk, episodeId: pk <= 4 ? 'a' : 'b' }));
    expect(diversify(hits, 3, 12).map((h) => h.pk)).toEqual([1, 2, 3, 5, 6]);
    expect(diversify(hits, 3, 2).map((h) => h.pk)).toEqual([1, 2]);
  });
});

describe('hybridSearch', () => {
  const seed = () => {
    const store = tempStore();
    seedEpisode(store, 1, [
      'Procrastination is an emotion regulation problem, not a time management problem.',
      'We avoid tasks that make us feel bad, and avoidance brings relief.',
    ]);
    seedEpisode(store, 2, [
      'Build a business by talking to customers before writing any code.',
      'Most founders fall in love with the idea instead of the problem.',
    ]);
    seedEpisode(store, 3, ['Sleep is the foundation of recovery, mood and discipline.']);
    return store;
  };

  it('works keyword-only before anything is embedded', async () => {
    const store = seed();
    const result = await hybridSearch(store, 'how do I stop procrastinating', fakeEmbedder);
    expect(result.modes).toEqual(['keyword']);
    expect(result.passages[0]?.text).toMatch(/Procrastination/);
    expect(result.passages[0]?.episode.title).toBe('Ada Lovelace: Episode 1');
  });

  it('fuses keyword and semantic results once embeddings exist', async () => {
    const store = seed();
    const todo = store.passagesNeedingEmbedding(fakeEmbedder.model, 100);
    const vectors = await fakeEmbedder.embed(todo.map(embeddingInput));
    store.setEmbeddings(
      todo.map((p, i) => ({ pk: p.pk, embedding: vectors[i] as Float32Array })),
      fakeEmbedder.model,
    );

    const result = await hybridSearch(store, 'founders customers problem', fakeEmbedder);
    expect(result.modes).toEqual(['keyword', 'semantic']);
    expect(result.passages[0]?.episode.guestNames).toEqual(['Grace Hopper']);
    expect(result.passages[0]?.sources).toContain('semantic');
  });

  it('returns nothing (not an error) for an unsearchable question on an empty base', async () => {
    const store = tempStore();
    const result = await hybridSearch(store, 'why?', null);
    expect(result.passages).toEqual([]);
  });
});
