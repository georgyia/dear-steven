import { describe, expect, it } from 'vitest';
import { embeddingInput } from '../openai/embedder.ts';
import { episodeInput, fakeEmbedder, seedEpisode, tempStore } from '../test/fixtures.ts';
import { toFtsQuery } from './fts.ts';
import { episodeIdFor, KnowledgeStore, StoreMissingError } from './index.ts';

describe('KnowledgeStore — episodes', () => {
  it('upserts idempotently and keeps manual guest names', () => {
    const store = tempStore();
    expect(store.upsertEpisodes([episodeInput(1), episodeInput(2)])).toEqual({
      inserted: 2,
      updated: 0,
    });
    const id = episodeIdFor('guid-1');
    store.setGuestNames(id, ['Dr Real Name'], 'manual');
    expect(store.upsertEpisodes([episodeInput(1, { title: 'Renamed' })])).toEqual({
      inserted: 0,
      updated: 1,
    });
    const e = store.getEpisode(id);
    expect(e?.title).toBe('Renamed');
    expect(e?.guestNames).toEqual(['Dr Real Name']);
    expect(store.discoveredCount()).toBe(2);
  });

  it('finds episodes by id, guid or title fragment', () => {
    const store = tempStore();
    store.upsertEpisodes([episodeInput(1, { title: 'Dana White: Build It' })]);
    expect(store.findEpisodes('guid-1')).toHaveLength(1);
    expect(store.findEpisodes(episodeIdFor('guid-1'))).toHaveLength(1);
    expect(store.findEpisodes('Dana White')[0]?.title).toBe('Dana White: Build It');
  });

  it('refuses to create a database unless asked', () => {
    expect(() => KnowledgeStore.open('/nonexistent/dir/kb.db')).toThrow(StoreMissingError);
  });
});

describe('KnowledgeStore — transcripts, passages and search', () => {
  const sentences = [
    'Procrastination is an emotion regulation problem, not a time management problem.',
    'When a task feels ambiguous the brain treats it as a threat and we avoid it.',
    'The relief you feel when you put it off is what makes the habit stick.',
    'Fighting is the oldest sport in the world and the UFC changed it forever.',
    'Discipline is doing the minimum on your worst day so you never miss twice.',
    'Start a business by talking to ten customers before you build anything.',
  ];

  it('indexes passages for keyword search', () => {
    const store = tempStore();
    seedEpisode(store, 1, sentences);
    const hits = store.ftsSearch('Why do I keep procrastinating?', 5);
    expect(hits[0]?.passageId).toMatch(/_p\d{4}$/);
    const top = store.getPassage(hits[0]?.passageId ?? '');
    expect(top?.text).toMatch(/Procrastination/);
    expect(top?.episode.guestNames).toEqual(['Ada Lovelace']);
    expect(store.stats()).toMatchObject({
      episodes: 1,
      transcribedEpisodes: 1,
      embeddedPassages: 0,
    });
  });

  it('stores embeddings and searches them by cosine distance', async () => {
    const store = tempStore();
    seedEpisode(store, 1, sentences);
    const todo = store.passagesNeedingEmbedding(fakeEmbedder.model, 100);
    expect(todo.length).toBe(store.stats().passages);
    const vectors = await fakeEmbedder.embed(todo.map(embeddingInput));
    store.setEmbeddings(
      todo.map((p, i) => ({ pk: p.pk, embedding: vectors[i] as Float32Array })),
      fakeEmbedder.model,
    );
    expect(store.passagesNeedingEmbedding(fakeEmbedder.model, 100)).toHaveLength(0);
    expect(store.hasEmbeddings()).toBe(true);

    const [q] = await fakeEmbedder.embed(['customers business build']);
    const hits = store.vectorSearch(q as Float32Array, 3);
    expect(store.getPassage(hits[0]?.passageId ?? '')?.text).toMatch(/customers/);
  });

  it('re-transcribing drops the old passages and their vectors', async () => {
    const store = tempStore();
    const id = seedEpisode(store, 1, sentences);
    const todo = store.passagesNeedingEmbedding(fakeEmbedder.model, 100);
    const vectors = await fakeEmbedder.embed(todo.map(embeddingInput));
    store.setEmbeddings(
      todo.map((p, i) => ({ pk: p.pk, embedding: vectors[i] as Float32Array })),
      fakeEmbedder.model,
    );
    store.replaceTranscript(id, [], 'rss-vtt');
    expect(store.passageCount(id)).toBe(0);
    expect(store.db.prepare('SELECT COUNT(*) AS n FROM passages_vec').get()).toEqual({ n: 0 });
    expect(store.ftsSearch('procrastination', 5)).toEqual([]);
  });

  it('purges an episode completely: segments, passages, FTS rows, vectors and runs', async () => {
    const store = tempStore();
    const id = seedEpisode(store, 1, sentences);
    seedEpisode(store, 2, ['Something else entirely about sleep and recovery.']);
    const todo = store.passagesNeedingEmbedding(fakeEmbedder.model, 100);
    const vectors = await fakeEmbedder.embed(todo.map(embeddingInput));
    store.setEmbeddings(
      todo.map((p, i) => ({ pk: p.pk, embedding: vectors[i] as Float32Array })),
      fakeEmbedder.model,
    );
    store.finishRun(store.startRun(id, 'chunk'), 'done');

    expect(store.purgeEpisode(id)).toBe(true);
    const count = (sql: string) => (store.db.prepare(sql).get() as { n: number }).n;
    expect(count(`SELECT COUNT(*) AS n FROM segments WHERE episode_id = '${id}'`)).toBe(0);
    expect(count(`SELECT COUNT(*) AS n FROM passages WHERE episode_id = '${id}'`)).toBe(0);
    expect(count(`SELECT COUNT(*) AS n FROM ingestion_runs WHERE episode_id = '${id}'`)).toBe(0);
    expect(store.ftsSearch('procrastination', 5)).toEqual([]);
    expect(count('SELECT COUNT(*) AS n FROM passages_vec')).toBe(store.stats().passages);
    expect(store.stats().episodes).toBe(1);
  });
});

describe('KnowledgeStore — ingestion runs', () => {
  it('records the latest run per stage and the money spent', () => {
    const store = tempStore();
    store.upsertEpisodes([episodeInput(1)]);
    const id = episodeIdFor('guid-1');
    store.finishRun(store.startRun(id, 'transcribe'), 'failed', { error: 'timeout' });
    store.finishRun(store.startRun(id, 'transcribe', { mode: 'diarize' }), 'done', {
      meta: { costUsd: 0.42 },
    });
    const runs = store.latestRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      stage: 'transcribe',
      status: 'done',
      meta: { mode: 'diarize', costUsd: 0.42 },
    });
    expect(store.spentUsd()).toBeCloseTo(0.42);
  });
});

describe('toFtsQuery', () => {
  it('quotes terms, drops stopwords and filler', () => {
    expect(toFtsQuery('Hey Steven, why do I keep procrastinating on my project?')).toBe(
      '"procrastinating" OR "project"',
    );
  });
  it('neutralises FTS5 syntax in user input', () => {
    const q = toFtsQuery('NEAR(fear failure) OR "drop table" * ^start');
    expect(q).toBe('"near" OR "fear" OR "failure" OR "drop" OR "table" OR "start"');
  });
  it('returns null when nothing is searchable', () => {
    expect(toFtsQuery('why is it?')).toBe(null);
  });
});
