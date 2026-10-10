import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EMBEDDING_DIMENSIONS } from '../config/models.ts';
import { chunkSegments, contextPrefix } from '../ingest/chunk.ts';
import type { Embedder } from '../openai/embedder.ts';
import type { Segment } from '../schema/index.ts';
import { type EpisodeInput, episodeIdFor, KnowledgeStore } from '../store/index.ts';

/** A throwaway on-disk knowledge base (WAL needs a real file). */
export function tempStore(): KnowledgeStore {
  const dir = mkdtempSync(join(tmpdir(), 'dear-steven-kb-'));
  return KnowledgeStore.open(join(dir, 'kb.db'), { create: true });
}

/** Deterministic hashed bag-of-words "embedding": shared words ⇒ nearby vectors. Test-only. */
export const fakeEmbedder: Embedder = {
  model: 'fake-bow-1',
  dimensions: EMBEDDING_DIMENSIONS,
  async embed(texts) {
    return texts.map((t) => {
      const v = new Float32Array(EMBEDDING_DIMENSIONS);
      for (const w of t.toLowerCase().match(/[a-z]{3,}/g) ?? []) {
        let h = 2166136261;
        for (let i = 0; i < w.length; i += 1) h = Math.imul(h ^ w.charCodeAt(i), 16777619);
        const i = Math.abs(h) % EMBEDDING_DIMENSIONS;
        v[i] = (v[i] ?? 0) + 1;
      }
      const norm = Math.hypot(...v) || 1;
      return v.map((x) => x / norm);
    });
  },
};

/** Fictional-for-our-purposes guests (historical figures, not show guests). */
export const GUESTS = [
  'Ada Lovelace',
  'Grace Hopper',
  'Alan Turing',
  'Katherine Johnson',
  'Hedy Lamarr',
];
export const guestOf = (n: number) => GUESTS[(n - 1) % GUESTS.length] as string;

export const episodeInput = (n: number, over: Partial<EpisodeInput> = {}): EpisodeInput => ({
  sourceGuid: `guid-${n}`,
  title: `${guestOf(n)}: Episode ${n}`,
  description: `Description ${n}`,
  publishedAt: `2026-0${(n % 9) + 1}-01T05:00:00Z`,
  durationMs: 3_600_000,
  episodeType: 'full',
  guestNames: [guestOf(n)],
  audioUrl: `https://example.test/${n}.mp3`,
  transcriptUrl: `https://example.test/${n}.vtt`,
  ...over,
});

export const unknownSegments = (sentences: string[]): Segment[] =>
  sentences.map((text, idx) => ({
    idx,
    startMs: idx * 8000,
    endMs: idx * 8000 + 7000,
    speaker: 'unknown',
    speakerName: null,
    attributionMethod: 'none',
    attributionConfidence: null,
    text,
  }));

/** Seeds one episode with a transcript and passages; returns its id. */
export function seedEpisode(
  store: KnowledgeStore,
  n: number,
  sentences: string[],
  segments?: Segment[],
): string {
  const input = episodeInput(n);
  store.upsertEpisodes([input]);
  const id = episodeIdFor(input.sourceGuid);
  const segs = segments ?? unknownSegments(sentences);
  store.replaceTranscript(id, segs, segments ? 'openai-diarize' : 'rss-vtt');
  store.replacePassages(
    id,
    chunkSegments(segs, { targetTokens: 40, maxTokens: 80, minTokens: 10, overlapTokens: 0 }),
    contextPrefix(input),
  );
  return id;
}
