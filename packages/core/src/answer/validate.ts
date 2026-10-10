import type { ModelBlock, ModelSegment } from '../schema/index.ts';
import type { AnswerContext, SourcePassage } from './context.ts';
import { locateQuote } from './quotes.ts';

/**
 * Deterministic citation validation (plan §E). Runs on every completed block before it is
 * streamed, and again after the repair pass. Nothing here calls a model: each rule is a plain
 * check against the passages actually retrieved for this question.
 */

export type ViolationKind =
  | 'uncited_claim'
  | 'attribution_unsupported'
  | 'unknown_guest'
  | 'conversation_not_in_sources'
  | 'guest_not_in_cited_episode'
  | 'quote_unknown_passage'
  | 'quote_not_found';

export interface Violation {
  blockIndex: number;
  segmentIndex: number | null;
  kind: ViolationKind;
  /** Written for the repair prompt: what is wrong and how to fix it. */
  message: string;
}

export interface BlockCheck {
  /** The block with unknown citation ids removed and synthesis citations cleared. */
  block: ModelBlock;
  violations: Violation[];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mentions = (text: string, name: string) =>
  new RegExp(`(^|[^\\p{L}])${escapeRe(name)}($|[^\\p{L}])`, 'iu').test(text);

const STOP_NAMES = new Set([
  'the',
  'my',
  'a',
  'an',
  'our',
  'this',
  'that',
  'them',
  'him',
  'her',
  'you',
  'me',
  'someone',
  'people',
]);

/** Captures "spoke with X", "my conversation with X", "sat down with X", "interviewed X"… */
const CONVERSATION =
  /\b(?:spoke|speaking|spoken|talked|talking|sat down|sitting down|chatted|chatting|conversation|conversations|discussion|interview|episode)\s+(?:with|to)\s+((?:Dr\.?|Professor|Prof\.?|Sir|Dame)\s+)?([A-Z][\p{L}’'.-]+(?:\s+(?:[A-Z][\p{L}’'.-]+|de|van|von|ten|da|del|la|le)){0,3})|\binterviewed\s+((?:Dr\.?|Professor|Prof\.?)\s+)?([A-Z][\p{L}’'.-]+(?:\s+[A-Z][\p{L}’'.-]+){0,3})/gu;

/** True if `name` plausibly refers to one of `guests` (full name, or a first/last name token). */
export function matchesGuest(name: string, guests: string[]): boolean {
  const n = name
    .toLowerCase()
    .replace(/[’']s$/, '')
    .trim();
  const tokens = n
    .split(/\s+/)
    .filter(
      (t) => (t.length > 1 || /\d/.test(t)) && !['dr', 'dr.', 'prof', 'professor'].includes(t),
    );
  return guests.some((g) => {
    const gl = g.toLowerCase();
    if (gl.includes(n) || n.includes(gl)) return true;
    const gTokens = gl.split(/\s+/);
    return tokens.length > 0 && tokens.every((t) => gTokens.includes(t));
  });
}

function checkSegment(
  segment: ModelSegment,
  blockIndex: number,
  segmentIndex: number,
  ctx: AnswerContext,
): { segment: ModelSegment; violations: Violation[] } {
  const violations: Violation[] = [];
  const v = (kind: ViolationKind, message: string) =>
    violations.push({
      blockIndex,
      segmentIndex,
      kind,
      message: `Block ${blockIndex}, segment ${segmentIndex}: ${message}`,
    });

  const known = segment.citations.filter((id) => ctx.byShortId.has(id));
  const cited = known.map((id) => ctx.byShortId.get(id) as SourcePassage);
  const clean: ModelSegment = {
    ...segment,
    citations: segment.attribution === 'synthesis' ? [] : [...new Set(known)],
  };

  if (segment.attribution !== 'synthesis' && clean.citations.length === 0) {
    v(
      'uncited_claim',
      `a "${segment.attribution}" statement must cite a passage from <sources>; cite the passage that supports it, or mark it "synthesis" if it is your own reasoning.`,
    );
  }
  if (
    segment.attribution === 'guest' &&
    cited.length > 0 &&
    !cited.some((s) => s.hasVerifiedGuest)
  ) {
    v(
      'attribution_unsupported',
      `it claims a guest said this, but the cited passage${cited.length > 1 ? 's have' : ' has'} unverified speakers (${known.join(', ')}). Rephrase it as episode-level ("In my conversation with …, the idea came up that …") with attribution "episode".`,
    );
  }
  if (segment.attribution === 'host' && cited.length > 0 && !cited.some((s) => s.hasVerifiedHost)) {
    v(
      'attribution_unsupported',
      `it claims Steven said this, but no cited passage has verified host lines (${known.join(', ')}). Rephrase it as episode-level with attribution "episode", or as your own reasoning ("synthesis") without citations.`,
    );
  }

  // Fabricated-guest guard: a guest from elsewhere in the knowledge base who is not in the sources.
  for (const guest of ctx.knownGuests) {
    if (mentions(segment.text, guest) && !matchesGuest(guest, ctx.retrievedGuests)) {
      v(
        'unknown_guest',
        `it names ${guest}, who is not in any retrieved passage. Remove the reference.`,
      );
    }
  }

  // "When I spoke with X" must be a conversation that is actually in the sources…
  for (const m of segment.text.matchAll(CONVERSATION)) {
    const name = (m[2] ?? m[4] ?? '').trim();
    if (!name || STOP_NAMES.has(name.toLowerCase())) continue;
    if (!matchesGuest(name, ctx.retrievedGuests)) {
      v(
        'conversation_not_in_sources',
        `it describes a conversation with ${name}, which is not among the retrieved episodes. Only refer to conversations that appear in <sources>.`,
      );
    } else if (segment.attribution !== 'synthesis' && cited.length > 0) {
      // …and, for a sourced claim, one of the cited passages must come from that conversation.
      const fromThatEpisode = cited.some((s) => matchesGuest(name, s.passage.episode.guestNames));
      if (!fromThatEpisode) {
        v(
          'guest_not_in_cited_episode',
          `it attributes this to the conversation with ${name}, but the cited passage (${known.join(', ')}) is from a different episode. Cite a passage from that conversation or change the wording.`,
        );
      }
    }
  }

  return { segment: clean, violations };
}

export function validateBlock(
  block: ModelBlock,
  blockIndex: number,
  ctx: AnswerContext,
): BlockCheck {
  if (block.kind === 'quote') {
    const source = ctx.byShortId.get(block.passageId);
    if (!source) {
      return {
        block,
        violations: [
          {
            blockIndex,
            segmentIndex: null,
            kind: 'quote_unknown_passage',
            message: `Block ${blockIndex}: the quote cites ${block.passageId}, which is not in <sources>.`,
          },
        ],
      };
    }
    const span = locateQuote(source.passage.text, block.quote);
    return {
      block,
      violations: span
        ? []
        : [
            {
              blockIndex,
              segmentIndex: null,
              kind: 'quote_not_found',
              message: `Block ${blockIndex}: the quote does not appear word-for-word in ${block.passageId}. Copy an exact sentence from that passage, or remove the quote.`,
            },
          ],
    };
  }

  const checked = block.segments.map((s, i) => checkSegment(s, blockIndex, i, ctx));
  return {
    block: { ...block, segments: checked.map((c) => c.segment) },
    violations: checked.flatMap((c) => c.violations),
  };
}

const DROP_KINDS: ViolationKind[] = [
  'unknown_guest',
  'conversation_not_in_sources',
  'guest_not_in_cited_episode',
];

/**
 * Last resort after the repair pass (plan §E.5): fix what is still wrong without a model.
 * Unsupported speaker claims become episode-level, uncited claims become synthesis, references to
 * conversations that are not in the sources are removed, and unmatched quotes are dropped. Returns
 * null when nothing of the block survives.
 */
export function downgradeBlock(
  block: ModelBlock,
  violations: Violation[],
): { block: ModelBlock | null; notes: Set<'speaker' | 'removed' | 'quote'> } {
  const notes = new Set<'speaker' | 'removed' | 'quote'>();
  if (violations.length === 0) return { block, notes };
  if (block.kind === 'quote') {
    notes.add('quote');
    return { block: null, notes };
  }
  const segments = block.segments.flatMap((segment, i): ModelSegment[] => {
    const mine = violations.filter((v) => v.segmentIndex === i);
    if (mine.length === 0) return [segment];
    if (mine.some((v) => DROP_KINDS.includes(v.kind))) {
      notes.add('removed');
      return [];
    }
    if (mine.some((v) => v.kind === 'uncited_claim'))
      return [{ ...segment, attribution: 'synthesis', citations: [] }];
    if (mine.some((v) => v.kind === 'attribution_unsupported')) {
      notes.add('speaker');
      return [{ ...segment, attribution: 'episode' }];
    }
    return [segment];
  });
  return { block: segments.length ? { ...block, segments } : null, notes };
}

export const DOWNGRADE_CAVEATS = {
  speaker:
    'Where the transcript doesn’t record who was speaking, I’ve credited the conversation rather than a person.',
  removed: 'I left out a line I couldn’t trace to one of the conversations I found.',
  quote: 'I left out a quotation I couldn’t match word-for-word to the transcript.',
} as const;
