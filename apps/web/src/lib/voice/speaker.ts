'use client';

import type { StockVoice } from '@dear-steven/core/schema';
import type { VoiceOutput } from './capabilities';

/**
 * Spoken replies. `speak()` only ever runs from a user gesture (the mic press or the Listen
 * button), and the shared AudioContext is unlocked in that gesture — that is what makes playback
 * reliable on iOS, where <audio>.play() after an await is blocked.
 */
export interface TextToSpeech {
  /** `language` is the text's ISO 639-1 code; it picks the voice and the pronunciation. */
  speak: (
    text: string,
    language: string,
    handlers?: { onStart?: () => void; onEnd?: () => void },
  ) => Promise<void>;
  stop: () => void;
}

let context: AudioContext | null = null;

/** Call synchronously inside a click / pointerdown handler. */
export function unlockAudio() {
  const Ctx =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  context ??= new Ctx();
  if (context.state === 'suspended') void context.resume();
}

export interface VoiceChoice {
  /** Stock OpenAI voice for /api/speech; `null` = the server default. */
  server: StockVoice | null;
  /** `voiceURI` of a system voice; `null` = pick automatically. */
  browser: string | null;
}

const languageOf = (tag: string) => tag.toLowerCase().split(/[-_]/)[0];

/** The chosen voice if it speaks this language, else the best one that does (or the default). */
export function browserVoice(
  voices: SpeechSynthesisVoice[],
  uri: string | null,
  language: string,
): SpeechSynthesisVoice | null {
  const speaks = voices.filter((v) => languageOf(v.lang) === language);
  const chosen = uri ? speaks.find((v) => v.voiceURI === uri) : undefined;
  if (chosen) return chosen;
  if (language === 'en') {
    return (
      speaks.find((v) => v.lang === 'en-GB' && /daniel|arthur|male/i.test(v.name)) ??
      speaks.find((v) => v.lang === 'en-GB') ??
      speaks[0] ??
      null
    );
  }
  return speaks.find((v) => v.default) ?? speaks[0] ?? null;
}

export function createSpeaker(
  output: VoiceOutput,
  choice: VoiceChoice = { server: null, browser: null },
): TextToSpeech {
  let source: AudioBufferSourceNode | null = null;
  let generation = 0;

  const speakBrowser = (
    text: string,
    language: string,
    h: { onStart?: () => void; onEnd?: () => void } = {},
  ) =>
    new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window)) return resolve();
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = language;
      const voice = browserVoice(window.speechSynthesis.getVoices(), choice.browser, language);
      if (voice) u.voice = voice;
      u.rate = 1.02;
      u.onstart = () => h.onStart?.();
      u.onend = () => {
        h.onEnd?.();
        resolve();
      };
      u.onerror = () => {
        h.onEnd?.();
        resolve();
      };
      window.speechSynthesis.speak(u);
    });

  const stop = () => {
    generation += 1;
    try {
      source?.stop();
    } catch {
      // Already stopped.
    }
    source = null;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  return {
    stop,
    async speak(text, language, handlers = {}) {
      stop();
      const mine = generation;
      if (output === 'none' || !text.trim()) return;
      if (output === 'browser' || !context) return speakBrowser(text, language, handlers);
      try {
        const res = await fetch('/api/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            language,
            ...(choice.server ? { voice: choice.server } : {}),
          }),
        });
        if (!res.ok) throw new Error(`speech ${res.status}`);
        const buffer = await context.decodeAudioData(await res.arrayBuffer());
        if (mine !== generation) return;
        const node = context.createBufferSource();
        node.buffer = buffer;
        node.connect(context.destination);
        source = node;
        await new Promise<void>((resolve) => {
          node.onended = () => {
            if (source === node) source = null;
            handlers.onEnd?.();
            resolve();
          };
          handlers.onStart?.();
          node.start();
        });
      } catch {
        if (mine === generation) await speakBrowser(text, language, handlers);
      }
    },
  };
}
