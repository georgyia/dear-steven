import { formatTimestamp } from '../format/time.ts';
import type { RetrievedPassage } from '../retrieval/index.ts';
import type { Segment } from '../schema/index.ts';
import type { KnowledgeStore } from '../store/index.ts';
import { isVerified } from './citations.ts';

/** A retrieved passage as the answer pipeline sees it: short id, stored text, its segments. */
export interface SourcePassage {
  shortId: string;
  passage: RetrievedPassage;
  segments: Segment[];
  /** Verified guest names speaking in this passage (diarized/manual only). */
  verifiedGuests: string[];
  hasVerifiedHost: boolean;
  hasVerifiedGuest: boolean;
}

export interface AnswerContext {
  sources: SourcePassage[];
  byShortId: Map<string, SourcePassage>;
  /** Guests of the retrieved episodes — the only people the answer may name. */
  retrievedGuests: string[];
  /** Every guest in the knowledge base, for the fabricated-guest guard. */
  knownGuests: string[];
}

export function buildContext(store: KnowledgeStore, passages: RetrievedPassage[]): AnswerContext {
  const sources = passages.map((passage, i): SourcePassage => {
    const segments = store.getSegments(
      passage.episodeId,
      passage.segmentStartIdx,
      passage.segmentEndIdx,
    );
    const verified = segments.filter(isVerified);
    return {
      shortId: `p${i + 1}`,
      passage,
      segments,
      verifiedGuests: [
        ...new Set(
          verified
            .filter((s) => s.speaker === 'guest' && s.speakerName)
            .map((s) => s.speakerName as string),
        ),
      ],
      hasVerifiedHost: verified.some((s) => s.speaker === 'host'),
      hasVerifiedGuest: verified.some((s) => s.speaker === 'guest'),
    };
  });
  return {
    sources,
    byShortId: new Map(sources.map((s) => [s.shortId, s])),
    retrievedGuests: [...new Set(passages.flatMap((p) => p.episode.guestNames))],
    knownGuests: store.knownGuestNames(),
  };
}

/** Transcript text cannot open or close our tags. */
export const neutralise = (text: string) => text.replace(/</g, '‹').replace(/>/g, '›');

const attr = (v: string) => neutralise(v).replace(/"/g, "'");

function renderSource(s: SourcePassage): string {
  const p = s.passage;
  const verified = s.hasVerifiedHost || s.hasVerifiedGuest;
  const speakers = verified
    ? `verified (${[s.hasVerifiedHost ? 'host: Steven' : '', ...s.verifiedGuests.map((g) => `guest: ${g}`), s.hasVerifiedGuest && s.verifiedGuests.length === 0 ? 'guest: unnamed' : ''].filter(Boolean).join('; ')})`
    : 'unverified — the transcript does not say who is speaking';

  let body: string;
  if (verified) {
    const lines: string[] = [];
    let last = '';
    for (const seg of s.segments) {
      const who = isVerified(seg)
        ? seg.speaker === 'host'
          ? 'Steven'
          : (seg.speakerName ?? 'Guest')
        : 'Unknown';
      if (who !== last) lines.push(`[${who}] ${neutralise(seg.text)}`);
      else lines[lines.length - 1] += ` ${neutralise(seg.text)}`;
      last = who;
    }
    body = lines.join('\n');
  } else {
    body = neutralise(p.text);
  }

  return `<source id="${s.shortId}" episode="${attr(p.episode.title)}" guests="${attr(p.episode.guestNames.join(', ') || 'not named')}" date="${p.episode.publishedAt.slice(0, 10)}" at="${formatTimestamp(p.startMs)}" speakers="${speakers}">
${body}
</source>`;
}

export function renderSources(ctx: AnswerContext): string {
  if (ctx.sources.length === 0) {
    return '<sources>\n(no passages matched this question)\n</sources>';
  }
  return `<sources>\n${ctx.sources.map(renderSource).join('\n\n')}\n</sources>`;
}
