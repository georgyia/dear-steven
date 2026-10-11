import type { Citation, ResolvedBlock } from '../schema/index.ts';

/**
 * Whether a shared answer (P6-17) still stands on the knowledge base as it is now: every cited
 * passage still stored, and every quote still a span of its passage. A link outlives the moment it
 * was made, so an episode taken down since then takes its quotes with it.
 *
 * `passages` maps passage id → stored text, for the passages the answer cites that still exist.
 */
export function stillSourced(
  answer: { blocks: ResolvedBlock[]; citations: Pick<Citation, 'id' | 'passageId'>[] },
  passages: ReadonlyMap<string, string>,
): boolean {
  const passageOf = new Map(answer.citations.map((c) => [c.id, c.passageId]));
  if (answer.citations.some((c) => !passages.has(c.passageId))) return false;
  return answer.blocks.every((block) => {
    if (block.kind !== 'quote') return true;
    return passages.get(passageOf.get(block.citationId) ?? '')?.includes(block.text) ?? false;
  });
}
