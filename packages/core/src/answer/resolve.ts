import type {
  AnswerEpisode,
  AnswerMode,
  Attribution,
  Citation,
  ModelBlock,
  ResolvedBlock,
  Segment,
} from '../schema/index.ts';
import { citationBase, speakerOf } from './citations.ts';
import type { AnswerContext, SourcePassage } from './context.ts';
import { locateQuote } from './quotes.ts';

/** Which stored segments a character span of the passage text overlaps. */
function segmentsInSpan(source: SourcePassage, start: number, end: number): Segment[] {
  const text = source.passage.text;
  const out: Segment[] = [];
  let cursor = 0;
  for (const seg of source.segments) {
    const at = text.indexOf(seg.text.trim(), cursor);
    if (at === -1) continue;
    const segEnd = at + seg.text.trim().length;
    cursor = segEnd;
    if (segEnd > start && at < end) out.push(seg);
  }
  return out;
}

/**
 * Hands out citation ids (c1, c2, …) in reading order, so ids are stable from the first streamed
 * block to the final answer. One citation per passage, plus a separate one for each quotation
 * (its excerpt is the exact quoted span).
 */
export class CitationRegistry {
  private readonly ctx: AnswerContext;
  private readonly byKey = new Map<string, Citation>();

  constructor(ctx: AnswerContext) {
    this.ctx = ctx;
  }

  private source(shortId: string): SourcePassage {
    const s = this.ctx.byShortId.get(shortId);
    if (!s) throw new Error(`Unknown passage ${shortId}`);
    return s;
  }

  forClaim(shortId: string, attribution: Attribution): Citation {
    const existing = this.byKey.get(shortId);
    if (existing) return existing;
    const s = this.source(shortId);
    const speaker =
      attribution === 'guest' && s.hasVerifiedGuest
        ? 'guest'
        : attribution === 'host' && s.hasVerifiedHost
          ? 'host'
          : 'unverified';
    const citation: Citation = {
      id: `c${this.byKey.size + 1}`,
      ...citationBase(s.passage),
      speaker,
      speakerName:
        speaker === 'guest'
          ? (s.verifiedGuests[0] ?? null)
          : speaker === 'host'
            ? 'Steven Bartlett'
            : null,
      excerpt: s.passage.text,
      quoteSpan: null,
      relevance: null,
    };
    this.byKey.set(shortId, citation);
    return citation;
  }

  forQuote(shortId: string, quote: string): { citation: Citation; text: string } | null {
    const s = this.source(shortId);
    const span = locateQuote(s.passage.text, quote);
    if (!span) return null;
    const key = `${shortId}#${span.start}-${span.end}`;
    const existing = this.byKey.get(key);
    if (existing) return { citation: existing, text: span.text };
    const who = speakerOf(segmentsInSpan(s, span.start, span.end));
    const startSeg = segmentsInSpan(s, span.start, span.start + 1)[0];
    const startMs = startSeg?.startMs ?? s.passage.startMs;
    const base = citationBase({ ...s.passage, startMs });
    const citation: Citation = {
      id: `c${this.byKey.size + 1}`,
      ...base,
      speaker: who.speaker,
      speakerName: who.name,
      excerpt: span.text,
      quoteSpan: { start: span.start, end: span.end },
      relevance: null,
    };
    this.byKey.set(key, citation);
    return { citation, text: span.text };
  }

  /** All citations, in the order they were first used, with the model's relevance notes. */
  all(evidence: { passageId: string; why: string }[] = []): Citation[] {
    const why = new Map(evidence.map((e) => [e.passageId, e.why.trim()]));
    return [...this.byKey.entries()].map(([key, c]) => ({
      ...c,
      relevance: why.get(key.split('#')[0] ?? key) ?? c.relevance,
    }));
  }
}

/** A validated model block → what the UI renders. Returns the citations this block introduced. */
export function resolveBlock(
  block: ModelBlock,
  registry: CitationRegistry,
): { block: ResolvedBlock; citations: Citation[] } | null {
  if (block.kind === 'quote') {
    const q = registry.forQuote(block.passageId, block.quote);
    if (!q) return null;
    return {
      block: { kind: 'quote', citationId: q.citation.id, lead: block.lead, text: q.text },
      citations: [q.citation],
    };
  }
  const citations: Citation[] = [];
  const segments = block.segments
    .filter((s) => s.text.trim())
    .map((s) => {
      const ids = s.citations.map((shortId) => {
        const c = registry.forClaim(shortId, s.attribution);
        if (!citations.includes(c)) citations.push(c);
        return c.id;
      });
      return { text: s.text.trim(), attribution: s.attribution, citationIds: [...new Set(ids)] };
    });
  if (segments.length === 0) return null;
  return { block: { kind: block.kind, segments }, citations };
}

export function episodesOf(citations: Citation[]): AnswerEpisode[] {
  const map = new Map<string, AnswerEpisode>();
  for (const c of citations) {
    const e = map.get(c.episode.id) ?? { ...c.episode, citationIds: [] };
    e.citationIds.push(c.id);
    map.set(c.episode.id, e);
  }
  return [...map.values()];
}

/** The mode the evidence actually supports, whatever the model claimed. */
export function finalMode(
  claimed: AnswerMode,
  blocks: ResolvedBlock[],
  downgraded: boolean,
): AnswerMode {
  if (claimed === 'conversational') return 'conversational';
  const cited = blocks.some((b) =>
    b.kind === 'quote' ? true : b.segments.some((s) => s.citationIds.length > 0),
  );
  if (!cited) return 'insufficient';
  if (claimed === 'insufficient') return 'partial';
  if (downgraded && claimed === 'grounded') return 'partial';
  return claimed;
}
