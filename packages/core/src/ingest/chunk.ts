import type { Segment, SpeakersPresent } from '../schema/index.ts';

/**
 * Turn-aware chunking (plan §D.5). A *unit* is one speaker turn — consecutive segments by the same
 * verified speaker — or, when speakers are unknown (RSS VTT), a single cue. Units are packed into
 * passages of ~350–500 tokens and are never split, except a single turn longer than the maximum,
 * which is split at segment boundaries. Consecutive passages overlap by their last unit(s), up to
 * `overlapTokens`, so an idea that straddles a boundary is retrievable from both sides.
 *
 * Passage text is raw transcript text only (turns separated by newlines); speaker labels are added
 * at prompt time from the segments, so quotes are always matched against what was actually said.
 */

export interface ChunkOptions {
  targetTokens: number;
  maxTokens: number;
  minTokens: number;
  overlapTokens: number;
}

export const DEFAULT_CHUNKING: ChunkOptions = {
  targetTokens: 420,
  maxTokens: 520,
  minTokens: 140,
  overlapTokens: 70,
};

export interface PassageDraft {
  idx: number;
  startMs: number;
  endMs: number;
  segmentStartIdx: number;
  segmentEndIdx: number;
  text: string;
  speakersPresent: SpeakersPresent;
  tokenCount: number;
}

/** ~4 characters per token for English; close enough for budgeting chunks and costs. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

interface Unit {
  segments: Segment[];
  tokens: number;
}

const verified = (s: Segment) => s.attributionMethod !== 'none' && s.speaker !== 'unknown';

function toUnits(segments: Segment[], maxTokens: number): Unit[] {
  const units: Unit[] = [];
  let current: Segment[] = [];
  const flush = () => {
    if (current.length === 0) return;
    // An over-long turn is split at segment boundaries, keeping each piece under the maximum.
    let piece: Segment[] = [];
    let pieceTokens = 0;
    for (const seg of current) {
      const t = estimateTokens(seg.text);
      if (piece.length > 0 && pieceTokens + t > maxTokens) {
        units.push({ segments: piece, tokens: pieceTokens });
        piece = [];
        pieceTokens = 0;
      }
      piece.push(seg);
      pieceTokens += t;
    }
    if (piece.length > 0) units.push({ segments: piece, tokens: pieceTokens });
    current = [];
  };

  for (const seg of segments) {
    if (!seg.text.trim()) continue;
    const prev = current[current.length - 1];
    const sameTurn =
      prev !== undefined &&
      verified(prev) &&
      verified(seg) &&
      prev.speaker === seg.speaker &&
      prev.speakerName === seg.speakerName;
    if (!sameTurn) flush();
    current.push(seg);
  }
  flush();
  return units;
}

function speakersOf(segments: Segment[]): SpeakersPresent {
  const kinds = new Set(segments.map((s) => (verified(s) ? s.speaker : 'unknown')));
  if (kinds.size === 1) {
    const only = [...kinds][0];
    return only === 'host' || only === 'guest' ? only : 'unknown';
  }
  return 'mixed';
}

function render(units: Unit[]): string {
  const lines: string[] = [];
  let prevTurnKey: string | null = null;
  for (const u of units) {
    const first = u.segments[0];
    if (!first) continue;
    const key = verified(first) ? `${first.speaker}:${first.speakerName ?? ''}` : null;
    const text = u.segments.map((s) => s.text.trim()).join(' ');
    // Unknown-speaker cues flow as one paragraph; verified turns start a new line.
    if (key === null && prevTurnKey === null && lines.length > 0)
      lines[lines.length - 1] += ` ${text}`;
    else lines.push(text);
    prevTurnKey = key;
  }
  return lines.join('\n');
}

function draft(units: Unit[], idx: number): PassageDraft {
  const segments = units.flatMap((u) => u.segments);
  const first = segments[0];
  const last = segments[segments.length - 1];
  if (!first || !last) throw new Error('Cannot build a passage from no segments');
  const text = render(units);
  return {
    idx,
    startMs: first.startMs,
    endMs: last.endMs,
    segmentStartIdx: first.idx,
    segmentEndIdx: last.idx,
    text,
    speakersPresent: speakersOf(segments),
    tokenCount: estimateTokens(text),
  };
}

export function chunkSegments(
  segments: Segment[],
  options: Partial<ChunkOptions> = {},
): PassageDraft[] {
  const opts = { ...DEFAULT_CHUNKING, ...options };
  const units = toUnits(
    [...segments].sort((a, b) => a.idx - b.idx),
    opts.maxTokens,
  );
  if (units.length === 0) return [];

  const groups: Unit[][] = [];
  let current: Unit[] = [];
  let tokens = 0;
  let fresh = 0; // units in `current` that are not overlap carried from the previous passage

  for (const unit of units) {
    const wouldOverflow = tokens + unit.tokens > opts.maxTokens;
    if (fresh > 0 && (tokens >= opts.targetTokens || wouldOverflow)) {
      groups.push(current);
      // Carry the tail of the finished passage forward as overlap.
      const carry: Unit[] = [];
      let carried = 0;
      for (let i = current.length - 1; i >= 0; i -= 1) {
        const u = current[i];
        if (!u || carried + u.tokens > opts.overlapTokens) break;
        carry.unshift(u);
        carried += u.tokens;
      }
      current = carry;
      tokens = carried;
      fresh = 0;
    }
    current.push(unit);
    tokens += unit.tokens;
    fresh += 1;
  }
  if (fresh > 0) groups.push(current);

  // A short final passage folds into the previous one when that stays reasonable.
  const lastGroup = groups[groups.length - 1];
  const prevGroup = groups[groups.length - 2];
  if (lastGroup && prevGroup) {
    const lastTokens = lastGroup.reduce((n, u) => n + u.tokens, 0);
    const prevTokens = prevGroup.reduce((n, u) => n + u.tokens, 0);
    const novel = lastGroup.filter((u) => !prevGroup.includes(u));
    const novelTokens = novel.reduce((n, u) => n + u.tokens, 0);
    if (lastTokens < opts.minTokens && prevTokens + novelTokens <= opts.maxTokens * 1.25) {
      groups.splice(groups.length - 2, 2, [...prevGroup, ...novel]);
    }
  }

  return groups.map((g, i) => draft(g, i));
}

/** The deterministic context prefix: what this passage is from. Stored apart from the text. */
export function contextPrefix(episode: {
  title: string;
  guestNames: string[];
  publishedAt: string;
}): string {
  const date = episode.publishedAt.slice(0, 10);
  const guests = episode.guestNames.length ? episode.guestNames.join(', ') : 'guest unknown';
  return `${episode.title} · ${guests} · ${date}`;
}
