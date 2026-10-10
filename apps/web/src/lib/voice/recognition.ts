'use client';

/**
 * A thin wrapper over the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`):
 * one utterance per press, interim text while speaking, the final transcript on end.
 */

export type RecognitionError = 'denied' | 'no-speech' | 'network' | 'aborted' | 'other';

export interface RecognitionHandlers {
  onAudioStart: () => void;
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (error: RecognitionError) => void;
}

export interface Recognizer {
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onaudiostart: (() => void) | null;
  onresult: ((e: { resultIndex: number; results: ArrayLike<SpeechResultLike> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type Ctor = new () => SpeechRecognitionLike;

const ERRORS: Record<string, RecognitionError> = {
  'not-allowed': 'denied',
  'service-not-allowed': 'denied',
  'no-speech': 'no-speech',
  network: 'network',
  aborted: 'aborted',
};

export function createRecognizer(handlers: RecognitionHandlers, lang?: string): Recognizer | null {
  const w = window as Window & { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  const Impl = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Impl) return null;

  const rec = new Impl();
  rec.lang = lang ?? (navigator.language || 'en-GB');
  rec.interimResults = true;
  // Android Chrome repeats results in continuous mode; one-shot is reliable there.
  rec.continuous = !/Android/i.test(navigator.userAgent);
  rec.maxAlternatives = 1;

  let finalText = '';
  let interim = '';
  let failed = false;

  rec.onaudiostart = () => handlers.onAudioStart();
  rec.onresult = (e) => {
    interim = '';
    for (let i = e.resultIndex; i < e.results.length; i += 1) {
      const r = e.results[i];
      if (!r) continue;
      if (r.isFinal) finalText += `${r[0].transcript} `;
      else interim += r[0].transcript;
    }
    handlers.onPartial(`${finalText}${interim}`.replace(/\s+/g, ' ').trim());
  };
  rec.onerror = (e) => {
    const kind = ERRORS[e.error] ?? 'other';
    if (kind === 'aborted') return;
    failed = true;
    handlers.onError(kind);
  };
  rec.onend = () => {
    if (failed) return;
    handlers.onFinal(`${finalText}${interim}`.replace(/\s+/g, ' ').trim());
  };

  return {
    start: () => {
      finalText = '';
      interim = '';
      failed = false;
      try {
        rec.start();
      } catch {
        // Already started (Safari can throw on quick double presses).
      }
    },
    stop: () => rec.stop(),
    abort: () => {
      failed = true;
      rec.abort();
    },
  };
}
