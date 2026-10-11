'use client';

import { DEFAULT_UI_LOCALE, LOCALE_TAG, type UiLocale } from '@dear-steven/core/copy';

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
  /** Chrome: recognise on the device instead of Google's speech service. */
  processLocally?: boolean;
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

type Ctor = (new () => SpeechRecognitionLike) & {
  available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string>;
  install?: (o: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
};

function recognitionImpl(): Ctor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * The language to listen for: the interface language, in the browser's own regional form when it
 * matches (so an Austrian browser hears de-AT), else that language's default tag.
 */
export function recognitionLang(
  locale: UiLocale = DEFAULT_UI_LOCALE,
  browser: string | undefined = typeof navigator === 'undefined' ? undefined : navigator.language,
): string {
  return browser?.toLowerCase().split('-')[0] === locale ? browser : LOCALE_TAG[locale];
}

export type OnDeviceStatus = 'available' | 'downloadable' | 'unavailable';

/**
 * On-device recognition ships in Google Chrome only. Elsewhere it is not even probed: in Chromium
 * builds without Chrome's speech component (headless Chromium 156, found by the e2e suite),
 * `available({ processLocally: true })` crashes the tab.
 */
export function onDeviceProbeAllowed(
  nav: { userAgentData?: { brands?: { brand: string }[] } } | undefined = typeof navigator ===
  'undefined'
    ? undefined
    : (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }),
): boolean {
  return Boolean(nav?.userAgentData?.brands?.some((b) => b.brand === 'Google Chrome'));
}

/**
 * Whether Chrome can recognise speech on this device (`SpeechRecognition.available` with
 * `processLocally`). Feature-detected: an older or different API shape reads as unavailable.
 * Call lazily (settings opened, or the user already opted in), never on every page load.
 */
export async function onDeviceStatus(lang = recognitionLang()): Promise<OnDeviceStatus> {
  const Impl = recognitionImpl();
  if (!onDeviceProbeAllowed() || typeof Impl?.available !== 'function') return 'unavailable';
  try {
    const status = await Impl.available({ langs: [lang], processLocally: true });
    if (status === 'available') return 'available';
    return status === 'downloadable' || status === 'downloading' ? 'downloadable' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/** Downloads the on-device model (Chrome asks no questions; it may take a while). */
export async function installOnDevice(lang = recognitionLang()): Promise<boolean> {
  const Impl = recognitionImpl();
  if (!onDeviceProbeAllowed() || typeof Impl?.install !== 'function') return false;
  try {
    return (await Impl.install({ langs: [lang], processLocally: true })) === true;
  } catch {
    return false;
  }
}

const ERRORS: Record<string, RecognitionError> = {
  'not-allowed': 'denied',
  'service-not-allowed': 'denied',
  'no-speech': 'no-speech',
  network: 'network',
  aborted: 'aborted',
};

export function createRecognizer(
  handlers: RecognitionHandlers,
  options: { lang?: string; processLocally?: boolean } = {},
): Recognizer | null {
  const Impl = recognitionImpl();
  if (!Impl) return null;

  const rec = new Impl();
  rec.lang = options.lang ?? recognitionLang();
  // Only set when asked for (and known to be available): unset, the browser decides as before.
  if (options.processLocally) rec.processLocally = true;
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
