import type { SearchHit } from '../store/index.ts';

export type HitSource = 'keyword' | 'semantic';

export interface FusedHit {
  pk: number;
  passageId: string;
  episodeId: string;
  score: number;
  sources: HitSource[];
}

/**
 * Reciprocal Rank Fusion (Cormack et al., 2009): score = Σ 1 / (k + rank). Rank-based, so BM25
 * scores and cosine distances never need calibrating against each other. k = 60 is the standard.
 */
export function reciprocalRankFusion(
  lists: { source: HitSource; hits: SearchHit[] }[],
  k = 60,
): FusedHit[] {
  const fused = new Map<number, FusedHit>();
  for (const { source, hits } of lists) {
    for (const hit of hits) {
      const entry = fused.get(hit.pk) ?? {
        pk: hit.pk,
        passageId: hit.passageId,
        episodeId: hit.episodeId,
        score: 0,
        sources: [],
      };
      entry.score += 1 / (k + hit.rank);
      if (!entry.sources.includes(source)) entry.sources.push(source);
      fused.set(hit.pk, entry);
    }
  }
  return [...fused.values()].sort((a, b) => b.score - a.score || a.pk - b.pk);
}

/** Keeps the best hits while capping how many come from any one episode. */
export function diversify<T extends { episodeId: string }>(
  hits: T[],
  perEpisode: number,
  take: number,
): T[] {
  const counts = new Map<string, number>();
  const out: T[] = [];
  for (const hit of hits) {
    const n = counts.get(hit.episodeId) ?? 0;
    if (n >= perEpisode) continue;
    counts.set(hit.episodeId, n + 1);
    out.push(hit);
    if (out.length >= take) break;
  }
  return out;
}
