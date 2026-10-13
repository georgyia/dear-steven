// Builds the free-questions e2e server's knowledge base (P8-02): two fixture episodes whose
// transcripts are labelled fixture text, chunked into passages. Run before that server starts:
// `node e2e/free-fixtures.ts`. Starts from nothing every time, so the ledger is empty too.
import { mkdirSync, rmSync } from 'node:fs';
import { chunkSegments, contextPrefix } from '@dear-steven/core/ingest';
import type { Segment } from '@dear-steven/core/schema';
import { type EpisodeInput, episodeIdFor, KnowledgeStore } from '@dear-steven/core/store';
import { E2E_FREE_DB, E2E_FREE_DIR } from './free-env.ts';

rmSync(E2E_FREE_DIR, { recursive: true, force: true });
mkdirSync(E2E_FREE_DIR, { recursive: true });
const store = KnowledgeStore.open(E2E_FREE_DB, { create: true });
for (const n of [1, 2]) {
  const episode: EpisodeInput = {
    sourceGuid: `e2e-free-${n}`,
    title: `Demo Guest ${n} (fixture): Starting before you feel ready`,
    description: 'Fixture episode for the free-questions e2e. Not a real conversation.',
    publishedAt: `2026-0${n}-01T05:00:00Z`,
    durationMs: 3_600_000,
    episodeType: 'full',
    guestNames: [`Demo Guest ${n}`],
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
    text: `Fixture line ${idx} of episode ${n}: start the work before you feel ready, and the feeling follows the action.`,
  }));
  const id = episodeIdFor(episode.sourceGuid);
  store.replaceTranscript(id, segments, 'rss-vtt');
  store.replacePassages(id, chunkSegments(segments), contextPrefix(episode));
}
store.close();
process.stdout.write(`free-questions fixture knowledge base ready: ${E2E_FREE_DB}\n`);
