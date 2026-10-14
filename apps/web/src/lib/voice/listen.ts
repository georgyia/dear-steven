'use client';

import { pickRecorderMime } from './capabilities';
import { createRecognizer } from './recognition';
import { transcribe } from './recorder';
import { audioContext } from './speaker';
import { type Heard, LevelGate, type TurnTiming, turnVerdict } from './turn-taking';

/**
 * Listening for one turn of a spoken conversation (P9-02). The mic opens, and closes again when
 * your turn has ended, when you've said nothing for a while, or when it's cancelled. With the
 * browser's speech recognition where it has one: its words drive the pause. Otherwise by recording
 * for the server's transcription: the mic's level drives the pause, and nothing is sent unless you
 * spoke.
 */

export type ListenFailure = 'denied' | 'unsupported' | 'network' | 'failed';

export class ListenError extends Error {
  readonly kind: ListenFailure;
  constructor(kind: ListenFailure) {
    super(`listening failed: ${kind}`);
    this.kind = kind;
  }
}

export interface TurnListener {
  /**
   * What you said, once your turn ends ('' when it couldn't be made out). Null when you said
   * nothing for the idle time, or listening was cancelled. Rejects with a `ListenError`.
   */
  heard: Promise<string | null>;
  /** Ends your turn now with what you've said, if you've said anything. */
  finish: () => void;
  /** Stops listening now; `heard` is null. */
  cancel: () => void;
}

export interface ListenOptions {
  input: 'browser' | 'server';
  lang: string;
  processLocally?: boolean;
  timing: TurnTiming;
  /** The microphone is open. */
  onOpen?: () => void;
  /** Your words so far (speech recognition only). */
  onWords?: (text: string) => void;
  /** The microphone's level, 0 to 1, twenty times a second (recording only). */
  onLevel?: (level: number) => void;
  now?: () => number;
}

const TICK_MS = 50;
/** While you haven't spoken, the recording starts afresh this often: at most this much silence is sent. */
const QUIET_RESTART_MS = 4_000;
/** How long a stopped recognizer gets to hand over its last words. */
const STOP_GRACE_MS = 1_500;

export function listenForTurn(options: ListenOptions): TurnListener {
  return options.input === 'browser' ? withRecognition(options) : withRecorder(options);
}

function outcome() {
  let resolve!: (text: string | null) => void;
  let reject!: (error: ListenError) => void;
  const heard = new Promise<string | null>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { heard, resolve, reject };
}

function withRecognition(o: ListenOptions): TurnListener {
  const now = o.now ?? (() => performance.now());
  const heard: Heard = { openedAt: now(), firstSpeechAt: null, lastSpeechAt: null };
  const { heard: result, resolve, reject } = outcome();
  let words = '';
  let over = false;
  /** We asked it to stop: the end that follows is the end of the turn. */
  let ending = false;
  /** It ended by itself with nothing heard: start it again. */
  let again = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const settle = (done: () => void) => {
    if (over) return;
    over = true;
    clearInterval(timer);
    done();
  };

  const rec = createRecognizer(
    {
      onAudioStart: () => o.onOpen?.(),
      onPartial: (text) => {
        if (!text || text === words) return;
        words = text;
        const at = now();
        heard.firstSpeechAt ??= at;
        heard.lastSpeechAt = at;
        o.onWords?.(text);
      },
      onFinal: (text) => {
        const said = (text || words).trim();
        // Our stop, or the browser's own end of an utterance (Android ends after each one).
        if (ending || said) settle(() => resolve(said));
        else again = true;
      },
      onError: (error) => {
        if (error === 'no-speech') {
          again = true;
          return;
        }
        const kind = error === 'denied' ? 'denied' : error === 'network' ? 'network' : 'failed';
        settle(() => reject(new ListenError(kind)));
      },
      onEnded: () => {
        if (over || !again) return;
        again = false;
        rec?.start();
      },
    },
    { lang: o.lang, processLocally: o.processLocally },
  );
  if (!rec) {
    reject(new ListenError('unsupported'));
    return { heard: result, finish: () => undefined, cancel: () => undefined };
  }

  const stop = () => {
    if (ending || over) return;
    ending = true;
    rec.stop();
    setTimeout(() => settle(() => resolve(words.trim())), STOP_GRACE_MS);
  };
  const cancel = () =>
    settle(() => {
      rec.abort();
      resolve(null);
    });
  timer = setInterval(() => {
    const verdict = turnVerdict(heard, now(), o.timing);
    if (verdict === 'ended') stop();
    else if (verdict === 'idle') cancel();
  }, TICK_MS);
  rec.start();
  return { heard: result, finish: () => (words ? stop() : undefined), cancel };
}

function withRecorder(o: ListenOptions): TurnListener {
  const now = o.now ?? (() => performance.now());
  const gate = new LevelGate(now());
  const { heard: result, resolve, reject } = outcome();
  const mime = pickRecorderMime((m) => MediaRecorder.isTypeSupported(m));
  let over = false;
  let sending = false;
  let stream: MediaStream | null = null;
  let ownContext: AudioContext | null = null;
  let take: { recorder: MediaRecorder; chunks: Blob[]; startedAt: number } | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  const releaseMic = () => {
    for (const track of stream?.getTracks() ?? []) track.stop();
  };
  const settle = (done: () => void) => {
    if (over) return;
    over = true;
    clearInterval(timer);
    if (take && take.recorder.state !== 'inactive' && !sending) {
      take.recorder.ondataavailable = null;
      take.recorder.onstop = null;
      take.recorder.stop();
    }
    releaseMic();
    void ownContext?.close().catch(() => undefined);
    done();
  };
  const record = (from: MediaStream) => {
    const recorder = new MediaRecorder(
      from,
      mime ? { mimeType: mime, audioBitsPerSecond: 32_000 } : undefined,
    );
    const next = { recorder, chunks: [] as Blob[], startedAt: now() };
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) next.chunks.push(e.data);
    };
    recorder.start(250);
    return next;
  };
  const send = () => {
    if (sending || over || !take) return;
    sending = true;
    clearInterval(timer);
    const { recorder, chunks } = take;
    recorder.onstop = () => {
      // The mic goes off before the upload: only the words are still on their way.
      releaseMic();
      const blob = new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' });
      transcribe(blob).then(
        (text) => settle(() => resolve(text)),
        () => settle(() => reject(new ListenError('failed'))),
      );
    };
    recorder.stop();
  };
  const cancel = () => settle(() => resolve(null));

  void (async () => {
    let opened: MediaStream;
    try {
      opened = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (error) {
      const denied =
        error instanceof DOMException &&
        (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      settle(() => reject(new ListenError(denied ? 'denied' : 'unsupported')));
      return;
    }
    stream = opened;
    if (over) return releaseMic();
    let ctx = audioContext();
    if (!ctx || ctx.state === 'closed') {
      ownContext = new AudioContext();
      ctx = ownContext;
    }
    // A suspended context measures nothing: the page has had its gesture, so it may run.
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
    if (over) return releaseMic();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(opened).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    take = record(opened);
    o.onOpen?.();
    timer = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += s * s;
      const level = Math.sqrt(sum / samples.length);
      o.onLevel?.(Math.min(1, level * 6));
      const at = now();
      gate.push(level, at);
      const verdict = turnVerdict(gate, at, o.timing);
      if (verdict === 'ended') send();
      else if (verdict === 'idle') cancel();
      else if (gate.firstSpeechAt === null && take && at - take.startedAt >= QUIET_RESTART_MS) {
        // Nothing said yet: start the recording afresh, so the silence before you speak isn't sent.
        take.recorder.ondataavailable = null;
        take.recorder.stop();
        take = record(opened);
      }
    }, TICK_MS);
  })();

  return {
    heard: result,
    finish: () => (gate.firstSpeechAt !== null ? send() : undefined),
    cancel,
  };
}
