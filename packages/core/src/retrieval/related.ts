import type { KnowledgeStore, StoredPassage } from '../store/index.ts';

export interface RelatedOptions {
  /** Related passages shown, each from a different episode. */
  k: number;
  /** Nearest neighbours considered before the per-episode and distance filters. */
  candidates: number;
  /** Cosine distance cut-off. Uncalibrated until the first live run — revisit in P5-01. */
  maxDistance: number;
}

export const DEFAULT_RELATED: RelatedOptions = { k: 3, candidates: 60, maxDistance: 0.55 };

/**
 * Passages from other conversations that sit close to a cited one (P5-04). Uses the passage's
 * stored embedding, so there is no model call; empty until embeddings exist.
 */
export function relatedPassages(
  store: KnowledgeStore,
  passageId: string,
  options: Partial<RelatedOptions> = {},
): StoredPassage[] {
  return store.similarPassages(passageId, { ...DEFAULT_RELATED, ...options }).map((r) => r.passage);
}
