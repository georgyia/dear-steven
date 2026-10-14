import { citationBase, episodeSummary, momentOf, speakerOf } from '../answer/citations.ts';
import type { Citation, ConversationSummaryView, SummarySpan } from '../schema/index.ts';
import type { KnowledgeStore, StoredPassage } from '../store/index.ts';

/**
 * A stored summary as the explorer shows it (P8-04): each topic, moment, question and answer with
 * the citation the evidence drawer opens, at the moment it starts. The excerpt is the stored span,
 * found again in its passage; an item whose passage or words are gone (the transcript changed
 * after it was summarised) is left out rather than shown wrong. `null` for an episode that isn't
 * indexed.
 */
export function summaryView(
  store: KnowledgeStore,
  episodeId: string,
): ConversationSummaryView | null {
  const episode = store.getEpisode(episodeId);
  const passages = store.passageCount(episodeId);
  if (!episode || passages === 0) return null;
  const row = episodeSummary({ ...episode, passages });
  const summary = store.conversationSummary(episodeId);
  if (!summary) return { episode: row, summary: null };

  const cache = new Map<string, StoredPassage | null>();
  const passage = (id: string) => {
    if (!cache.has(id)) {
      const p = store.getPassage(id);
      cache.set(id, p && p.episodeId === episodeId ? p : null);
    }
    return cache.get(id) ?? null;
  };

  const cite = (id: string, span: SummarySpan | { passageId: string; startMs: number }) => {
    const p = passage(span.passageId);
    if (!p) return null;
    const text = 'text' in span ? span.text : null;
    const at = text === null ? -1 : p.text.indexOf(text);
    if (text !== null && at < 0) return null;
    const who = speakerOf(store.getSegments(p.episodeId, p.segmentStartIdx, p.segmentEndIdx));
    const citation: Citation = {
      ...citationBase(p),
      ...momentOf(p.episode, span.startMs),
      id,
      startMs: span.startMs,
      speaker: who.speaker,
      speakerName: who.name,
      excerpt: text ?? p.text,
      quoteSpan: text === null ? null : { start: at, end: at + text.length },
      relevance: null,
    };
    return citation;
  };

  const keep = <T>(items: (T | null)[]): T[] => items.filter((x): x is T => x !== null);
  return {
    episode: row,
    summary: {
      about: summary.about,
      speakers: summary.speakers,
      topics: keep(
        summary.topics.map((t, i) => {
          const citation = cite(`summary-topic-${i}`, t);
          return citation && { title: t.title, citation };
        }),
      ),
      moments: keep(
        summary.moments.map((m, i) => {
          const citation = cite(`summary-moment-${i}`, m);
          return citation && { label: m.label, citation };
        }),
      ),
      exchanges: keep(
        summary.exchanges.map((x, i) => {
          const question = cite(`summary-question-${i}`, x.question);
          const answer = cite(`summary-answer-${i}`, x.answer);
          return question && answer && { question, answer };
        }),
      ),
      demo: false,
    },
  };
}
