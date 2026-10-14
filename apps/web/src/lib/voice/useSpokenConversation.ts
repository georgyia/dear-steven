'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import type { StageEvent } from '@/lib/stage-machine';
import { ListenError, listenForTurn, type TurnListener } from './listen';
import { unlockAudio } from './speaker';
import {
  type ConversationState,
  conversationOff,
  conversationReducer,
} from './spoken-conversation';
import type { TurnTiming } from './turn-taking';
import type { VoiceApi } from './useVoice';

/** What happens after a turn: carry on, pause (it failed), or end (it can't go on). */
export type TurnOutcome = 'next' | 'pause' | 'end';

interface Options {
  voice: VoiceApi;
  timing: TurnTiming;
  /** Sends what you said. Resolves once the reply is written; its voice may still be playing. */
  onTurn: (text: string) => Promise<TurnOutcome>;
  /** Dear Steven speaks first (the interview reads its question). Called at the start. */
  onBegin?: () => void;
  /** Interrupting while he is still writing stops the reply. */
  onInterrupt?: () => void;
  onEnd?: () => void;
  send: (event: StageEvent) => void;
  notify: (title: string, description?: string) => void;
}

export interface SpokenConversation {
  state: ConversationState;
  /** The mic's level, 0 to 1, while listening on the recorder path; read it on animation frames. */
  level: { current: number };
  /** From a click or key press. */
  start: () => void;
  /** Carry on after a pause, from a click or key press. */
  resume: () => void;
  /** Stop him (speaking, or still writing), and it's your turn. */
  interrupt: () => void;
  /** Send what you've said now, without waiting for the pause. */
  finishTurn: () => void;
  end: () => void;
}

/**
 * A spoken conversation (P9-02): you talk, your turn ends when you pause, the reply is read aloud,
 * and then it's your turn again, until you end it. The mic is open only on your turn (SR-10): it
 * closes while he speaks, when the tab is hidden, after the idle time, and when it ends.
 */
export function useSpokenConversation(options: Options): SpokenConversation {
  const [state, dispatch] = useReducer(conversationReducer, conversationOff);
  const level = useRef(0);
  const session = useRef<AbortController | null>(null);
  const listener = useRef<TurnListener | null>(null);
  const hidden = useRef(false);
  const latest = useRef(options);
  latest.current = options;
  const { t } = useI18n();
  const copy = useRef(t);
  copy.current = t;

  const close = useCallback(() => {
    session.current?.abort();
    session.current = null;
    listener.current?.cancel();
    listener.current = null;
    level.current = 0;
  }, []);

  const end = useCallback(() => {
    const wasOn = session.current !== null;
    close();
    latest.current.voice.stopSpeaking();
    dispatch({ type: 'end' });
    if (wasOn) latest.current.onEnd?.();
  }, [close]);

  const pause = useCallback(
    (reason: 'idle' | 'hidden' | 'failed') => {
      close();
      dispatch({ type: 'pause', reason });
    },
    [close],
  );

  const run = useCallback(
    async (signal: AbortSignal) => {
      for (;;) {
        await latest.current.voice.whenQuiet();
        if (signal.aborted) return;
        if (document.visibilityState === 'hidden') return pause('hidden');
        dispatch({ type: 'replied' });
        const { voice, timing, send, notify } = latest.current;
        if (voice.input === 'none') {
          notify(copy.current.errors.micUnsupported);
          return end();
        }
        send({ type: 'MIC_REQUESTED' });
        const turn = listenForTurn({
          input: voice.input,
          lang: voice.listening.lang,
          processLocally: voice.listening.processLocally,
          timing,
          onOpen: () => latest.current.send({ type: 'MIC_GRANTED' }),
          onWords: (text) => dispatch({ type: 'words', text }),
          onLevel: (value) => {
            level.current = value;
          },
        });
        listener.current = turn;
        let said: string | null;
        try {
          said = await turn.heard;
        } catch (error) {
          listener.current = null;
          send({ type: 'LISTEN_CANCELLED' });
          if (signal.aborted) return;
          const kind = error instanceof ListenError ? error.kind : 'failed';
          const { errors, voiceErrors } = copy.current;
          if (kind === 'denied' || kind === 'unsupported') {
            notify(kind === 'denied' ? errors.micDenied : errors.micUnsupported);
            return end();
          }
          notify(
            voiceErrors.unclear,
            kind === 'network' ? voiceErrors.stopped : voiceErrors.recording,
          );
          return pause('failed');
        }
        listener.current = null;
        level.current = 0;
        if (signal.aborted) {
          send({ type: 'LISTEN_CANCELLED' });
          return;
        }
        if (said === null) {
          send({ type: 'LISTEN_CANCELLED' });
          const reason = hidden.current ? 'hidden' : 'idle';
          hidden.current = false;
          return pause(reason);
        }
        send({ type: 'LISTEN_STOPPED' });
        send({ type: 'TRANSCRIBED' });
        if (!said) {
          notify(copy.current.voiceErrors.noSpeech, copy.current.voiceErrors.noSpeechHint);
          continue;
        }
        dispatch({ type: 'sent' });
        const next = await latest.current.onTurn(said);
        if (signal.aborted) return;
        if (next === 'end') return end();
        if (next === 'pause') return pause('failed');
      }
    },
    [end, pause],
  );

  const begin = useCallback(
    (first: 'yours' | 'his', resuming: boolean) => {
      if (session.current) return;
      unlockAudio();
      const ctrl = new AbortController();
      session.current = ctrl;
      hidden.current = false;
      if (resuming) dispatch({ type: 'resume' });
      else dispatch({ type: 'start', first });
      if (first === 'his' && !resuming) latest.current.onBegin?.();
      void run(ctrl.signal);
    },
    [run],
  );

  const start = useCallback(() => begin(latest.current.onBegin ? 'his' : 'yours', false), [begin]);
  const resume = useCallback(() => begin('yours', true), [begin]);

  const interrupt = useCallback(() => {
    if (state.phase !== 'his') return;
    latest.current.voice.stopSpeaking();
    latest.current.onInterrupt?.();
  }, [state.phase]);

  const finishTurn = useCallback(() => listener.current?.finish(), []);

  // A hidden tab closes the mic; a reply already playing finishes, then the conversation pauses.
  useEffect(() => {
    const onChange = () => {
      if (document.visibilityState !== 'hidden' || !listener.current) return;
      hidden.current = true;
      listener.current.cancel();
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  useEffect(() => close, [close]);

  return { state, level, start, resume, interrupt, finishTurn, end };
}
