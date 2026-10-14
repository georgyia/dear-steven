/**
 * Taking turns in a spoken conversation (P9-02), decided here and nowhere else: when your turn has
 * ended, and when the conversation pauses because you've said nothing. Pure, so the thresholds are
 * unit-tested rather than discovered on a call.
 */

export interface TurnTiming {
  /** Quiet after your last word that ends your turn. */
  pauseMs: number;
  /** Quiet, before you've said anything, after which the conversation pauses and the mic closes. */
  idleMs: number;
  /** The longest one turn can run (the server's transcription takes a minute at most). */
  maxMs: number;
}

export const TURN_TIMING = {
  /** A back-and-forth: a short pause is the end of what you wanted to say. */
  talk: { pauseMs: 900, idleMs: 30_000, maxMs: 60_000 },
  /** An answer: people stop to think in the middle of one (P9-03). */
  interview: { pauseMs: 2_000, idleMs: 30_000, maxMs: 60_000 },
} satisfies Record<string, TurnTiming>;

/** What has been heard so far in this turn, and when. */
export interface Heard {
  /** When listening began. */
  openedAt: number;
  /** When speech was first heard, or null if it hasn't been. */
  firstSpeechAt: number | null;
  /** When speech was last heard: a new word, or the level over the gate. */
  lastSpeechAt: number | null;
}

export type TurnVerdict = 'listening' | 'ended' | 'idle';

export function turnVerdict(heard: Heard, now: number, timing: TurnTiming): TurnVerdict {
  if (heard.lastSpeechAt === null || heard.firstSpeechAt === null) {
    return now - heard.openedAt >= timing.idleMs ? 'idle' : 'listening';
  }
  if (now - heard.lastSpeechAt >= timing.pauseMs) return 'ended';
  return now - heard.firstSpeechAt >= timing.maxMs ? 'ended' : 'listening';
}

/** Below this RMS level nothing counts as speech, however quiet the room (about -34 dBFS). */
export const MIN_SPEECH_LEVEL = 0.02;
/** How long the level has to stay up before it counts as speech, so a click or a cough doesn't. */
export const SPEECH_ONSET_MS = 120;
/** A loud moment this soon after speech carries the speech on: syllables aren't all loud. */
export const SPEECH_HANGOVER_MS = 300;
/** The room's noise floor is the quietest level of this long a window. */
const FLOOR_WINDOW_MS = 1_500;

/**
 * Speech or quiet from the microphone's level, for browsers without speech recognition, where
 * nothing else says when you've stopped. The noise floor is the quietest moment of the last second
 * and a half: words have gaps between them, a hum doesn't. Speech is a level well above it, held
 * for a moment, or picked up again soon after.
 */
export class LevelGate implements Heard {
  openedAt: number;
  firstSpeechAt: number | null = null;
  lastSpeechAt: number | null = null;
  private recent: { at: number; level: number }[] = [];
  private loudSince: number | null = null;

  constructor(openedAt: number) {
    this.openedAt = openedAt;
  }

  /** One reading of the level (RMS, 0 to 1) at time `at`; returns whether it is speech. */
  push(level: number, at: number): boolean {
    this.recent.push({ at, level });
    while ((this.recent[0]?.at ?? at) < at - FLOOR_WINDOW_MS) this.recent.shift();
    const floor = Math.min(...this.recent.map((r) => r.level));
    if (level <= Math.max(MIN_SPEECH_LEVEL, floor * 3)) {
      this.loudSince = null;
      return false;
    }
    this.loudSince ??= at;
    const carriedOn = this.lastSpeechAt !== null && at - this.lastSpeechAt <= SPEECH_HANGOVER_MS;
    if (!carriedOn && at - this.loudSince < SPEECH_ONSET_MS) return false;
    this.firstSpeechAt ??= at;
    this.lastSpeechAt = at;
    return true;
  }
}
