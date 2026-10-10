'use client';

import type { VoiceOutput } from './capabilities';

/**
 * Spoken replies. `speak()` only ever runs from a user gesture (the mic press or the Listen
 * button), and the shared AudioContext is unlocked in that gesture — that is what makes playback
 * reliable on iOS, where <audio>.play() after an await is blocked.
 */
export interface TextToSpeech {
  speak: (text: string, handlers?: { onStart?: () => void; onEnd?: () => void }) => Promise<void>;
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

function browserVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'en-GB' && /daniel|arthur|male/i.test(v.name)) ??
    voices.find((v) => v.lang === 'en-GB') ??
    voices.find((v) => v.lang.startsWith('en')) ??
    null
  );
}

export function createSpeaker(output: VoiceOutput): TextToSpeech {
  let source: AudioBufferSourceNode | null = null;
  let generation = 0;

  const speakBrowser = (text: string, h: { onStart?: () => void; onEnd?: () => void } = {}) =>
    new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window)) return resolve();
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = browserVoice();
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
    async speak(text, handlers = {}) {
      stop();
      const mine = generation;
      if (output === 'none' || !text.trim()) return;
      if (output === 'browser' || !context) return speakBrowser(text, handlers);
      try {
        const res = await fetch('/api/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
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
        if (mine === generation) await speakBrowser(text, handlers);
      }
    },
  };
}
