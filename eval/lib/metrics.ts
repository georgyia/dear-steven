import { isVerified } from '@dear-steven/core/answer';
import { personaLint } from '@dear-steven/core/persona';
import type { FinalAnswer } from '@dear-steven/core/schema';
import type { KnowledgeStore } from '@dear-steven/core/store';

/**
 * The four things we measure separately (plan §14): retrieval quality, citation correctness,
 * speaker attribution, and persona consistency. Usefulness is judged by a person, not a metric —
 * a fluent answer is not necessarily a correct one.
 */

export interface AnswerCheck {
  /** Every citation names a stored passage, and its excerpt is a substring of that passage. */
  citationsResolve: boolean;
  /** Every pull quote is byte-identical to a span of the stored transcript. */
  quotesMatch: boolean;
  /** No host/guest chip without verified speaker segments behind it. */
  attributionOk: boolean;
  personaIssues: string[];
  problems: string[];
}

/** How long an answer reads: its words, quotes included (talk replies must stay short, P7-05). */
export function answerWords(final: Pick<FinalAnswer, 'blocks'>): number {
  return final.blocks
    .map((b) => (b.kind === 'quote' ? b.text : b.segments.map((s) => s.text).join(' ')))
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

export function recallAt(k: number, retrievedEpisodeGuids: string[], expected: string[]): boolean {
  return retrievedEpisodeGuids.slice(0, k).some((g) => expected.includes(g));
}

export function checkAnswer(final: FinalAnswer, store: KnowledgeStore): AnswerCheck {
  const problems: string[] = [];
  let citationsResolve = true;
  let attributionOk = true;
  for (const c of final.citations) {
    const p = store.getPassage(c.passageId);
    if (!p) {
      citationsResolve = false;
      problems.push(`${c.id}: passage ${c.passageId} does not exist`);
      continue;
    }
    if (!p.text.includes(c.excerpt)) {
      citationsResolve = false;
      problems.push(`${c.id}: excerpt is not a substring of the stored passage`);
    }
    if (c.speaker === 'host' || c.speaker === 'guest') {
      const segs = store.getSegments(p.episodeId, p.segmentStartIdx, p.segmentEndIdx);
      if (!segs.some((s) => isVerified(s) && s.speaker === c.speaker)) {
        attributionOk = false;
        problems.push(`${c.id}: ${c.speaker} chip without verified ${c.speaker} segments`);
      }
    }
  }

  let quotesMatch = true;
  const byId = new Map(final.citations.map((c) => [c.id, c]));
  for (const b of final.blocks) {
    if (b.kind !== 'quote') continue;
    const c = byId.get(b.citationId);
    const p = c ? store.getPassage(c.passageId) : null;
    if (!p?.text.includes(b.text) || c?.excerpt !== b.text) {
      quotesMatch = false;
      problems.push(`quote "${b.text.slice(0, 40)}…" does not byte-match the transcript`);
    }
  }

  const prose = [
    ...final.blocks.flatMap((b) =>
      b.kind === 'quote' ? [b.lead ?? ''] : b.segments.map((s) => s.text),
    ),
    final.spoken,
  ].join('\n');
  const personaIssues = personaLint(prose);
  return { citationsResolve, quotesMatch, attributionOk, personaIssues, problems };
}

export const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
};
