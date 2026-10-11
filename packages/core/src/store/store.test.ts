import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { describe, expect, it } from 'vitest';
import { embeddingInput } from '../openai/embedder.ts';
import { episodeInput, fakeEmbedder, seedEpisode, tempStore } from '../test/fixtures.ts';
import { toFtsQuery } from './fts.ts';
import { episodeIdFor, KnowledgeStore, StoreMissingError } from './index.ts';
import { MIGRATIONS } from './migrations.ts';

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

  it('keeps the YouTube offset and where it changes, in order', () => {
    const store = tempStore();
    store.upsertEpisodes([episodeInput(1)]);
    const id = episodeIdFor('guid-1');
    expect(store.getEpisode(id)?.youtubeOffsetSteps).toEqual([]);
    store.setYouTube(id, {
      videoId: 'dQw4w9WgXcQ',
      durationMs: 3_600_000,
      offsetMs: -11_000,
      offsetSteps: [
        { fromMs: 2_400_000.4, offsetMs: 49_000 },
        { fromMs: 1_200_000, offsetMs: 43_000 },
      ],
      alignment: 'exact',
    });
    expect(store.getEpisode(id)).toMatchObject({
      youtubeOffsetMs: -11_000,
      youtubeOffsetSteps: [
        { fromMs: 1_200_000, offsetMs: 43_000 },
        { fromMs: 2_400_000, offsetMs: 49_000 },
      ],
    });
    store.setYouTube(id, {
      videoId: 'dQw4w9WgXcQ',
      durationMs: null,
      offsetMs: 5_000,
      alignment: 'exact',
    });
    expect(store.getEpisode(id)?.youtubeOffsetSteps).toEqual([]);
  });

  it('upgrades a first-version database without losing its links', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'dear-steven-v1-')), 'kb.db');
    const v1 = new Database(path);
    sqliteVec.load(v1);
    v1.exec(MIGRATIONS[0] ?? '');
    v1.pragma('user_version = 1');
    v1.prepare(
      `INSERT INTO episodes (id, source_guid, title, published_at, episode_type, youtube_video_id,
        youtube_offset_ms, youtube_alignment) VALUES ('ep_1', 'g1', 'T', '2026-01-01', 'full',
        'dQw4w9WgXcQ', 7000, 'estimated')`,
    ).run();
    v1.close();
    const store = KnowledgeStore.open(path);
    expect(store.getEpisode('ep_1')).toMatchObject({
      youtubeVideoId: 'dQw4w9WgXcQ',
      youtubeOffsetMs: 7000,
      youtubeOffsetSteps: [],
      youtubeAlignment: 'estimated',
    });
  });

  it('keeps a generated summary, and finds what was said around a passage', () => {
    const store = tempStore();
    const id = seedEpisode(store, 1, [
      'First the guest talks about growing up poor in a small town, sharing a bedroom with three brothers, working weekends in a bakery and saving every coin for a second-hand bicycle.',
      'Then the guest explains the first business, a market stall selling phone cases on Saturdays, the early mornings, the cold, the regulars who came back, and the first month that made a profit.',
      'Finally the guest says the stall taught them to sell, to read a face, to price quickly and to walk away from a bad deal, which mattered more than anything they later learned at university.',
    ]);
    store.setSummary(id, 'A conversation about starting small.');
    expect(store.getEpisode(id)?.summary).toBe('A conversation about starting small.');
    const passages = store.getPassagesByIds(
      Array.from(
        { length: store.passageCount(id) },
        (_, i) => `${id}_p${String(i).padStart(4, '0')}`,
      ),
    );
    expect(passages.length).toBeGreaterThan(1);
    const middle = passages[1];
    if (!middle) throw new Error('no middle passage');
    const around = store.neighbourPassages(id, middle.idx);
    expect(around.before).toBe(passages[0]?.text);
    expect(around.after).toBe(passages[2]?.text ?? null);
    expect(store.neighbourPassages(id, 0).before).toBeNull();
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

describe('KnowledgeStore — browsing indexed episodes', () => {
  const seedThree = () => {
    const store = tempStore();
    seedEpisode(store, 1, ['A conversation about procrastination and feelings.']);
    seedEpisode(store, 2, ['A conversation about building companies from nothing.']);
    seedEpisode(store, 3, ['A conversation about sleep.']);
    store.upsertEpisodes([episodeInput(4, { title: 'Not yet transcribed: 100% raw' })]);
    return store;
  };

  it('lists only indexed episodes, newest first, with passage counts', () => {
    const page = seedThree().browseIndexed({ limit: 10, offset: 0 });
    expect(page.total).toBe(3);
    expect(page.episodes.map((e) => e.guestNames[0])).toEqual([
      'Alan Turing',
      'Grace Hopper',
      'Ada Lovelace',
    ]);
    expect(page.episodes.every((e) => e.passages > 0)).toBe(true);
  });

  it('searches titles and guest names, case-insensitively', () => {
    const store = seedThree();
    expect(
      store
        .browseIndexed({ search: 'grace', limit: 10, offset: 0 })
        .episodes.map((e) => e.guestNames[0]),
    ).toEqual(['Grace Hopper']);
    expect(store.browseIndexed({ search: 'Episode 3', limit: 10, offset: 0 }).total).toBe(1);
  });

  it('treats LIKE wildcards in the search as literal characters', () => {
    const store = seedThree();
    expect(store.browseIndexed({ search: '%', limit: 10, offset: 0 }).total).toBe(0);
    expect(store.browseIndexed({ search: '_', limit: 10, offset: 0 }).total).toBe(0);
  });

  it('pages through results', () => {
    const store = seedThree();
    const first = store.browseIndexed({ limit: 2, offset: 0 });
    const second = store.browseIndexed({ limit: 2, offset: 2 });
    expect(first.episodes).toHaveLength(2);
    expect(second.episodes).toHaveLength(1);
    expect(second.total).toBe(3);
  });
});

describe('KnowledgeStore — similar passages', () => {
  const embed = async (store: KnowledgeStore, model: string, episodeId?: string) => {
    const todo = store.passagesNeedingEmbedding(model, 1000, episodeId);
    const vectors = await fakeEmbedder.embed(todo.map(embeddingInput));
    store.setEmbeddings(
      todo.map((p, i) => ({ pk: p.pk, embedding: vectors[i] as Float32Array })),
      model,
    );
  };
  const avoid =
    'Procrastination is avoiding the feeling a task gives you rather than the task itself.';
  const seed = () => {
    const store = tempStore();
    const one = seedEpisode(store, 1, Array(8).fill(avoid));
    const two = seedEpisode(store, 2, [
      'People procrastinate to avoid the feeling a task gives them, not the task itself.',
    ]);
    const three = seedEpisode(store, 3, [
      'Procrastination is the feeling you avoid; the task itself is rarely the hard part.',
    ]);
    seedEpisode(store, 4, ['Fighting is the oldest sport in the world and the UFC changed it.']);
    const first = (episodeId: string) =>
      store.db
        .prepare<[string], { id: string }>(
          'SELECT id FROM passages WHERE episode_id = ? ORDER BY idx LIMIT 1',
        )
        .get(episodeId)?.id as string;
    return { store, one, two, three, first };
  };
  const loose = { k: 3, candidates: 50, maxDistance: 2 };

  it('finds close passages in other episodes — never the same one, one per episode', async () => {
    const { store, one, two, three, first } = seed();
    await embed(store, fakeEmbedder.model);
    expect(store.passageCount(one)).toBeGreaterThan(1);
    const found = store.similarPassages(first(one), loose);
    const episodes = found.map((r) => r.passage.episodeId);
    expect(episodes).not.toContain(one);
    expect(new Set(episodes).size).toBe(episodes.length);
    expect(episodes.slice(0, 2).sort()).toEqual([two, three].sort());
    expect(found.map((r) => r.distance)).toEqual([...found.map((r) => r.distance)].sort());
    expect(store.similarPassages(first(one), { ...loose, k: 1 })).toHaveLength(1);
  });

  it('drops anything beyond the distance cut-off', async () => {
    const { store, one, first } = seed();
    await embed(store, fakeEmbedder.model);
    expect(store.similarPassages(first(one), { ...loose, maxDistance: 0.0001 })).toEqual([]);
  });

  it('is empty without embeddings, and never mixes embedding models', async () => {
    const { store, one, two, three, first } = seed();
    expect(store.similarPassages(first(one), loose)).toEqual([]);
    await embed(store, fakeEmbedder.model, one);
    await embed(store, fakeEmbedder.model, three);
    await embed(store, 'another-model', two);
    const episodes = store.similarPassages(first(one), loose).map((r) => r.passage.episodeId);
    expect(episodes).toEqual([three]);
    expect(store.similarPassages('missing_p0001', loose)).toEqual([]);
  });
});
