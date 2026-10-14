'use client';

import type { StockVoice } from '@dear-steven/core/schema';
import { SPEECH_SAMPLE_RATE } from '@dear-steven/core/speech';
import { keyHeaders } from '@/lib/visitor-key';
import type { VoiceOutput } from './capabilities';
import { pcmDecoder } from './pcm';
import {
  createSpeechQueue,
  type SpeechOutput,
  type SpeechPart,
  type SpeechQueue,
} from './speech-queue';

/**
 * Spoken replies. Playback only ever starts after a user gesture in this visit (the mic press, a
 * typed question, the Listen button), and the shared AudioContext is unlocked in that gesture.
 * That is what makes playback reliable on iOS, where <audio>.play() after an await is blocked.
 * Server speech arrives as PCM and plays as it streams in (P9-01).
 */
export interface TextToSpeech {
  /** `language` is the text's ISO 639-1 code; it picks the voice and the pronunciation. */
  speak: (
    text: string,
    language: string,
    handlers?: { onStart?: () => void; onEnd?: () => void },
  ) => Promise<void>;
  /** A reply read aloud part by part as its parts arrive (P9-01). Stops whatever was playing. */
  reply: (handlers?: { onStart?: () => void; onEnd?: () => void }) => SpeechQueue;
  stop: () => void;
}

let context: AudioContext | null = null;

/** The page's AudioContext, once a gesture has unlocked it; listening measures the mic on it too. */
export const audioContext = () => context;

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

const languageOf = (tag: string) => tag.toLowerCase().split(/[-_]/)[0] ?? tag;

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

/** Samples scheduled back to back on the AudioContext's clock, so the pieces join seamlessly. */
function webAudioSink(ctx: AudioContext) {
  const live = new Set<AudioBufferSourceNode>();
  let until = 0;
  let waiting: (() => void)[] = [];
  const release = () => {
    if (live.size > 0) return;
    const w = waiting;
    waiting = [];
    for (const resolve of w) resolve();
  };
  return {
    schedule(samples: Float32Array<ArrayBuffer>) {
      const buffer = ctx.createBuffer(1, samples.length, SPEECH_SAMPLE_RATE);
      buffer.copyToChannel(samples, 0);
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(ctx.destination);
      const at = Math.max(until, ctx.currentTime + 0.03);
      node.onended = () => {
        live.delete(node);
        release();
      };
      live.add(node);
      node.start(at);
      until = at + buffer.duration;
    },
    ahead: () => Math.max(0, until - ctx.currentTime),
    drained: () =>
      live.size === 0 ? Promise.resolve() : new Promise<void>((resolve) => waiting.push(resolve)),
    silence() {
      for (const node of live) {
        try {
          node.stop();
        } catch {
          // Already stopped.
        }
      }
      live.clear();
      until = 0;
      release();
    },
  };
}

const NO_SINK = {
  schedule: () => undefined,
  ahead: () => 0,
  drained: () => Promise.resolve(),
  silence: () => undefined,
};

export function createSpeaker(
  output: VoiceOutput,
  choice: VoiceChoice = { server: null, browser: null },
): TextToSpeech {
  let current: SpeechQueue | null = null;
  let sink: ReturnType<typeof webAudioSink> | null = null;
  let sinkFor: AudioContext | null = null;

  const speakLocally = (part: SpeechPart, signal: AbortSignal) =>
    new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window) || signal.aborted) return resolve();
      const u = new SpeechSynthesisUtterance(part.text);
      u.lang = part.language;
      const voice = browserVoice(window.speechSynthesis.getVoices(), choice.browser, part.language);
      if (voice) u.voice = voice;
      u.rate = 1.02;
      const finish = () => {
        signal.removeEventListener('abort', cancel);
        resolve();
      };
      const cancel = () => {
        window.speechSynthesis.cancel();
        finish();
      };
      u.onend = finish;
      u.onerror = finish;
      signal.addEventListener('abort', cancel, { once: true });
      window.speechSynthesis.speak(u);
    });

  async function* fromServer(part: SpeechPart, signal: AbortSignal) {
    const ctx = context;
    if (!ctx || ctx.state === 'closed') throw new Error('no audio context');
    const running = () => ctx.state === 'running';
    if (!running()) {
      await Promise.race([ctx.resume(), new Promise((resolve) => setTimeout(resolve, 300))]);
      if (!running()) throw new Error('audio is locked');
    }
    const res = await fetch('/api/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await keyHeaders()) },
      body: JSON.stringify({
        text: part.text,
        language: languageOf(part.language),
        ...(choice.server ? { voice: choice.server } : {}),
      }),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`speech ${res.status}`);
    const decode = pcmDecoder();
    const reader = res.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        yield decode(value);
      }
    } finally {
      reader.cancel().catch(() => undefined);
    }
  }

  const reply: TextToSpeech['reply'] = (handlers = {}) => {
    current?.stop();
    const server = output === 'server' && context !== null;
    if (server && context !== sinkFor) {
      sink = context ? webAudioSink(context) : null;
      sinkFor = context;
    }
    const out: SpeechOutput = {
      ...(server && sink ? sink : NO_SINK),
      ...(server ? { fetch: fromServer } : {}),
      speakLocally,
    };
    const queue = createSpeechQueue(out, handlers);
    if (output === 'none') queue.close();
    current = queue;
    return queue;
  };

  return {
    reply,
    stop() {
      current?.stop();
      current = null;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    },
    speak(text, language, handlers = {}) {
      if (!text.trim()) {
        current?.stop();
        return Promise.resolve();
      }
      const queue = reply(handlers);
      queue.add(text, language);
      queue.close();
      return queue.done;
    },
  };
}
