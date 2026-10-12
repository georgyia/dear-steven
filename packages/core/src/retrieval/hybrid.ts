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
  /** More phrasings to search for by keyword and by meaning (P6-07), fused with the query. */
  alternates?: string[];
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

  const alternates = (opts.alternates ?? []).filter((t) => t && t !== query);
  for (const text of [query, ...alternates]) {
    lists.push({ source: 'keyword', hits: store.ftsSearch(text, opts.candidates) });
  }

  if (embedder && store.hasEmbeddings()) {
    // The question in its own language too (P6-01): meaning survives where a translation slips.
    const texts = [
      ...new Set([query, ...alternates, ...(opts.alsoSemantic ?? []).filter(Boolean)]),
    ];
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
    modes: [
      ...new Set(
        lists.filter((l) => l.source === 'keyword' || l.hits.length > 0).map((l) => l.source),
      ),
    ],
  };
}
