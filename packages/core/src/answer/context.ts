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
  /** What was said just before and after, trimmed (P6-07): context, never citable or quotable. */
  before: string | null;
  after: string | null;
}

/** A machine-written overview of one conversation the sources come from (P6-07). */
export interface EpisodeOverview {
  title: string;
  summary: string;
}

export interface AnswerContext {
  sources: SourcePassage[];
  byShortId: Map<string, SourcePassage>;
  /** Guests of the retrieved episodes — the only people the answer may name. */
  retrievedGuests: string[];
  /** Every guest in the knowledge base, for the fabricated-guest guard. */
  knownGuests: string[];
  /** Overviews of the conversations the sources come from, where one has been generated. */
  episodes: EpisodeOverview[];
}

/** How much surrounding conversation the model sees (P6-07); counted in the answer budget. */
export const CONTEXT_BUDGET = {
  /** Only the strongest sources get their neighbours. */
  neighbourSources: 6,
  /** Words kept on each side. */
  neighbourWords: 90,
} as const;

const lastWords = (text: string | null, n: number) => {
  if (!text) return null;
  const words = text.trim().split(/\s+/);
  return words.length > n ? `…${words.slice(-n).join(' ')}` : text.trim();
};
const firstWords = (text: string | null, n: number) => {
  if (!text) return null;
  const words = text.trim().split(/\s+/);
  return words.length > n ? `${words.slice(0, n).join(' ')}…` : text.trim();
};

export function buildContext(
  store: KnowledgeStore,
  passages: RetrievedPassage[],
  budget: { neighbourSources: number; neighbourWords: number } = CONTEXT_BUDGET,
): AnswerContext {
  const sources = passages.map((passage, i): SourcePassage => {
    const segments = store.getSegments(
      passage.episodeId,
      passage.segmentStartIdx,
      passage.segmentEndIdx,
    );
    const verified = segments.filter(isVerified);
    const around =
      i < budget.neighbourSources
        ? store.neighbourPassages(passage.episodeId, passage.idx)
        : { before: null, after: null };
    return {
      shortId: `p${i + 1}`,
      before: lastWords(around.before, budget.neighbourWords),
      after: firstWords(around.after, budget.neighbourWords),
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
    episodes: [...new Map(passages.map((p) => [p.episodeId, p.episode])).values()].flatMap((e) =>
      e.summary ? [{ title: e.title, summary: e.summary }] : [],
    ),
  };
}

/** Transcript text cannot open or close our tags. */
const neutralise = (text: string) => text.replace(/</g, '‹').replace(/>/g, '›');

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

  const before = s.before ? `<before>${neutralise(s.before)}</before>\n` : '';
  const after = s.after ? `\n<after>${neutralise(s.after)}</after>` : '';
  return `<source id="${s.shortId}" episode="${attr(p.episode.title)}" guests="${attr(p.episode.guestNames.join(', ') || 'not named')}" date="${p.episode.publishedAt.slice(0, 10)}" at="${formatTimestamp(p.startMs)}" speakers="${speakers}">
${before}${body}${after}
</source>`;
}

function renderOverviews(ctx: AnswerContext): string {
  if (ctx.episodes.length === 0) return '';
  const items = ctx.episodes.map(
    (e) => `<episode title="${attr(e.title)}" generated="true">${neutralise(e.summary)}</episode>`,
  );
  return `<episodes>\n${items.join('\n')}\n</episodes>\n\n`;
}

export function renderSources(ctx: AnswerContext): string {
  if (ctx.sources.length === 0) {
    return '<sources>\n(no passages matched this question)\n</sources>';
  }
  return `${renderOverviews(ctx)}<sources>\n${ctx.sources.map(renderSource).join('\n\n')}\n</sources>`;
}
