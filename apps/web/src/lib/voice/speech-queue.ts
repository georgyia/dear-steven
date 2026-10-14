import { LIMITS } from '@dear-steven/core/limits';
import { speechPieces } from '@dear-steven/core/speech';

/**
 * A reply read aloud part by part, as its parts arrive (P9-01). Each part is fetched the moment it
 * is added, so the next one downloads while the current one plays. Parts always play in the order
 * they were added. A part the server can't read is read by the browser's own voice instead. Where
 * the audio comes from and goes to is passed in: Web Audio and speechSynthesis in the app
 * (`speaker.ts`), fakes in the tests.
 */

export interface SpeechPart {
  text: string;
  /** ISO 639-1 code of the text's language. */
  language: string;
}

export interface SpeechOutput {
  /** Starts fetching at once; yields samples as they arrive, and throws when refused. Absent: none. */
  fetch?: (part: SpeechPart, signal: AbortSignal) => AsyncIterable<Float32Array<ArrayBuffer>>;
  /** Plays samples right after whatever is already scheduled. */
  schedule: (samples: Float32Array<ArrayBuffer>) => void;
  /** Seconds scheduled and not yet played. */
  ahead: () => number;
  /** Resolves once everything scheduled has played (or been silenced). */
  drained: () => Promise<void>;
  /** Stops everything scheduled, at once. */
  silence: () => void;
  /** The browser's own voice: resolves when the part has been said, or the signal aborts. */
  speakLocally: (part: SpeechPart, signal: AbortSignal) => Promise<void>;
}

export interface SpeechQueue {
  add: (text: string, language: string) => void;
  /** Nothing more is coming: the queue ends once what it has has played. */
  close: () => void;
  /** Silences it now; nothing queued plays afterwards. */
  stop: () => void;
  /** Whether any of it has started playing. */
  readonly started: boolean;
  /** Started, and not yet finished or stopped. */
  readonly playing: boolean;
  /** Settles when it has all played, or was stopped. */
  readonly done: Promise<void>;
}

/** Samples a part gathers before it starts, when nothing is playing ahead of it: 0.2 s at 24 kHz. */
export const START_SAMPLES = 4_800;

interface Buffered {
  part: SpeechPart;
  chunks: Float32Array<ArrayBuffer>[];
  /** Samples gathered and not yet scheduled. */
  waiting: number;
  finished: boolean;
  failed: boolean;
}

export function createSpeechQueue(
  out: SpeechOutput,
  handlers: { onStart?: () => void; onEnd?: () => void } = {},
): SpeechQueue {
  const ctrl = new AbortController();
  const parts: Buffered[] = [];
  let closed = false;
  let started = false;
  let wake: (() => void) | null = null;
  const nudge = () => {
    const w = wake;
    wake = null;
    w?.();
  };
  const next = () =>
    new Promise<void>((resolve) => {
      wake = resolve;
    });

  const gather = async (b: Buffered) => {
    if (!out.fetch) {
      b.failed = true;
      b.finished = true;
      return;
    }
    try {
      for await (const samples of out.fetch(b.part, ctrl.signal)) {
        if (ctrl.signal.aborted) return;
        if (samples.length === 0) continue;
        b.chunks.push(samples);
        b.waiting += samples.length;
        nudge();
      }
    } catch {
      b.failed = true;
    } finally {
      b.finished = true;
      nudge();
    }
  };

  const begin = () => {
    if (started) return;
    started = true;
    handlers.onStart?.();
  };

  /** Everything gathered so far, as one run of samples. */
  const take = (b: Buffered) => {
    const all = new Float32Array(b.waiting);
    let at = 0;
    for (const c of b.chunks) {
      all.set(c, at);
      at += c.length;
    }
    b.chunks = [];
    b.waiting = 0;
    return all;
  };

  const play = async () => {
    for (let i = 0; ; i++) {
      while (i >= parts.length) {
        if (closed || ctrl.signal.aborted) return;
        await next();
      }
      const b = parts[i] as Buffered;
      let played = false;
      while (!ctrl.signal.aborted) {
        // A part starts once it has a moment of sound in hand, so it doesn't stutter.
        const ready =
          b.waiting > 0 && (b.finished || out.ahead() > 0.1 || b.waiting >= START_SAMPLES);
        if (ready) {
          begin();
          out.schedule(take(b));
          played = true;
        } else if (b.finished && b.waiting === 0) break;
        else await next();
      }
      if (ctrl.signal.aborted) return;
      if (b.failed && !played) {
        await out.drained();
        if (ctrl.signal.aborted) return;
        begin();
        await out.speakLocally(b.part, ctrl.signal);
      }
    }
  };

  let ended = false;
  const done = play()
    .then(() => (ctrl.signal.aborted ? undefined : out.drained()))
    // Audio that can't play (a closed context) ends the reading; it never fails the caller.
    .catch(() => undefined)
    .finally(() => {
      ended = true;
      handlers.onEnd?.();
    });

  return {
    add(text, language) {
      if (closed || ctrl.signal.aborted) return;
      for (const piece of speechPieces(text, LIMITS.speechChars)) {
        const b: Buffered = {
          part: { text: piece, language },
          chunks: [],
          waiting: 0,
          finished: false,
          failed: false,
        };
        parts.push(b);
        void gather(b);
      }
      nudge();
    },
    close() {
      closed = true;
      nudge();
    },
    stop() {
      if (ended || ctrl.signal.aborted) return;
      ctrl.abort();
      out.silence();
      nudge();
    },
    get started() {
      return started;
    },
    get playing() {
      return started && !ended;
    },
    done,
  };
}
