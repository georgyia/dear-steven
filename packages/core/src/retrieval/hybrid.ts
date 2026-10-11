import type { Embedder } from '../openai/embedder.ts';
import type { KnowledgeStore, StoredPassage } from '../store/index.ts';
import { diversify, type HitSource, reciprocalRankFusion } from './rrf.ts';

export interface RetrievalOptions {
  /** Candidates taken from each list before fusion. */
  candidates: number;
  rrfK: number;
  perEpisode: number;
  take: number;
  /** More texts to search by meaning alongside the query — the question in its own language. */
  alsoSemantic?: string[];
}

export const DEFAULT_RETRIEVAL: RetrievalOptions = {
  candidates: 80,
  rrfK: 60,
  perEpisode: 3,
  take: 12,
};

export interface RetrievedPassage extends StoredPassage {
  score: number;
  sources: HitSource[];
}

export interface RetrievalResult {
  passages: RetrievedPassage[];
  /** Which searches actually ran — semantic search needs both a key and embedded passages. */
  modes: HitSource[];
}

/**
 * Hybrid retrieval (plan §E): FTS5 BM25 and vec0 KNN, top 80 each, fused with RRF, capped at three
 * passages per episode, twelve in total. (80 rather than the plan's 40: with 40, one dominant
 * episode could fill the whole candidate pool and the per-episode cap left almost nothing.)
 * Degrades to keyword-only when there is no embedder or no embedded passages yet, so a freshly
 * ingested knowledge base is searchable immediately.
 */
export async function hybridSearch(
  store: KnowledgeStore,
  query: string,
  embedder: Embedder | null,
  options: Partial<RetrievalOptions> = {},
  signal?: AbortSignal,
): Promise<RetrievalResult> {
  const opts = { ...DEFAULT_RETRIEVAL, ...options };
  const lists: { source: HitSource; hits: ReturnType<KnowledgeStore['ftsSearch']> }[] = [];

  const keyword = store.ftsSearch(query, opts.candidates);
  lists.push({ source: 'keyword', hits: keyword });

  if (embedder && store.hasEmbeddings()) {
    // The question in its own language too (P6-01): meaning survives where a translation slips.
    const texts = [query, ...(opts.alsoSemantic ?? []).filter((t) => t && t !== query)];
    for (const vector of await embedder.embed(texts, signal)) {
      lists.push({ source: 'semantic', hits: store.vectorSearch(vector, opts.candidates) });
    }
  }

  const picked = diversify(reciprocalRankFusion(lists, opts.rrfK), opts.perEpisode, opts.take);
  const byPk = new Map(store.getPassagesByPks(picked.map((p) => p.pk)).map((p) => [p.pk, p]));
  const passages = picked.flatMap((hit) => {
    const p = byPk.get(hit.pk);
    return p ? [{ ...p, score: hit.score, sources: hit.sources }] : [];
  });
  return {
    passages,
    modes: lists.filter((l) => l.source === 'keyword' || l.hits.length > 0).map((l) => l.source),
  };
}
