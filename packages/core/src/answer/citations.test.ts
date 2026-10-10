import { describe, expect, it } from 'vitest';
import { embeddingInput } from '../openai/embedder.ts';
import { type Episode, RelatedMomentsSchema, type Segment } from '../schema/index.ts';
import { fakeEmbedder, seedEpisode, tempStore, unknownSegments } from '../test/fixtures.ts';
import { buildRelatedMoments, episodeSummary } from './citations.ts';

const episode = (over: Partial<Episode> = {}): Episode & { passages: number } => ({
  id: 'ep_1',
  sourceGuid: 'g',
  title: 'Ada Lovelace: Episode 1',
  description: '',
  publishedAt: '2026-01-01T05:00:00Z',
  durationMs: 1,
  episodeType: 'full',
  guestNames: ['Ada Lovelace'],
  audioUrl: null,
  transcriptUrl: null,
  transcriptSource: 'rss-vtt',
  transcriptStatus: 'fetched',
  youtubeVideoId: null,
  youtubeOffsetMs: 0,
  youtubeAlignment: 'unknown',
  summary: null,
  indexedAt: '2026-01-02T00:00:00Z',
  passages: 12,
  ...over,
});

describe('episodeSummary', () => {
  it('reports RSS transcripts as unverified speakers and no video', () => {
    expect(episodeSummary(episode())).toMatchObject({
      speakers: 'unverified',
      video: 'none',
      youtubeUrl: null,
      passages: 12,
    });
  });

  it('reports diarized transcripts as verified and links the episode without a timestamp', () => {
    const s = episodeSummary(
      episode({
        transcriptSource: 'openai-diarize',
        youtubeVideoId: 'dQw4w9WgXcQ',
        youtubeAlignment: 'estimated',
      }),
    );
    expect(s.speakers).toBe('verified');
    expect(s.video).toBe('estimated');
    expect(s.youtubeUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });
});

describe('buildRelatedMoments', () => {
  const line =
    'Procrastination is avoiding the feeling a task gives you rather than the task itself, and ';
  const seed = async () => {
    const store = tempStore();
    const one = seedEpisode(store, 1, [`${line}that is the whole point.`]);
    const guest: Segment[] = unknownSegments([`${line.repeat(3)}I learned it slowly.`]).map(
      (seg) => ({
        ...seg,
        speaker: 'guest',
        speakerName: 'Grace Hopper',
        attributionMethod: 'diarization',
        attributionConfidence: 0.9,
      }),
    );
    seedEpisode(store, 2, [], guest);
    seedEpisode(store, 3, [`${line}most people never notice.`]);
    const todo = store.passagesNeedingEmbedding(fakeEmbedder.model, 100);
    const vectors = await fakeEmbedder.embed(todo.map(embeddingInput));
    store.setEmbeddings(
      todo.map((p, i) => ({ pk: p.pk, embedding: vectors[i] as Float32Array })),
      fakeEmbedder.model,
    );
    const source = store.db
      .prepare<[string], { id: string }>('SELECT id FROM passages WHERE episode_id = ?')
      .get(one)?.id as string;
    return { store, source };
  };

  it('returns passages from other conversations, each with its own speaker state', async () => {
    const { store, source } = await seed();
    const related = RelatedMomentsSchema.parse(
      buildRelatedMoments(store, source, { maxDistance: 2 }),
    );
    expect(related.passages).toHaveLength(2);
    const byGuest = related.passages.find((p) => p.episode.guestNames[0] === 'Grace Hopper');
    expect(byGuest).toMatchObject({ speaker: 'guest', speakerName: 'Grace Hopper' });
    expect(byGuest?.excerpt.length).toBeLessThanOrEqual(240);
    expect(byGuest?.excerpt.endsWith('…')).toBe(true);
    const rss = related.passages.find((p) => p.episode.guestNames[0] !== 'Grace Hopper');
    expect(rss).toMatchObject({ speaker: 'unverified', speakerName: null, quality: 'asr' });
    expect(related.passages.every((p) => p.passageId !== source)).toBe(true);
  });
});
