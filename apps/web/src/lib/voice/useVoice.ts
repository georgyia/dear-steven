'use client';

import {
  createContext,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { brand } from '@/brand';
import type {
  VoicePillHandle,
  VoicePillStopReason,
} from '@/components/vendor/react-bits/VoicePill';
import type { StageEvent } from '@/lib/stage-machine';
import {
  chooseVoiceInput,
  chooseVoiceOutput,
  detectEnvironment,
  type VoiceEnvironment,
  type VoiceInput,
  type VoiceOutput,
} from './capabilities';
import { createRecognizer, type Recognizer } from './recognition';
import { MicDeniedError, type Recording, startRecording, transcribe } from './recorder';
import { createSpeaker, unlockAudio } from './speaker';

export interface VoiceApi {
  input: VoiceInput;
  output: VoiceOutput;
  permission: PermissionState | 'unknown';
  pillRef: RefObject<VoicePillHandle | null>;
  onPillStart: () => void;
  onPillStop: (info: { reason: VoicePillStopReason }) => void;
  /** Must be called from a user gesture (or after one already unlocked audio). */
  speak: (turnId: string, text: string) => void;
  stopSpeaking: () => void;
  speakingTurnId: string | null;
}

interface UseVoiceOptions {
  /** Live mode: /api/transcribe and /api/speech are available. */
  serverVoice: boolean;
  send: (event: StageEvent) => void;
  /** Interim transcript while listening, shown in the composer. */
  setDraft: (text: string) => void;
  onTranscript: (text: string) => void;
  notify: (title: string, description?: string) => void;
}

type Session =
  | { kind: 'browser'; recognizer: Recognizer }
  | { kind: 'server'; recording: Promise<Recording> };

/**
 * Voice orchestration (plan Phase 4): push-to-talk or tap-to-toggle through the VoicePill, Web
 * Speech where the browser has it, MediaRecorder + server STT where it doesn't, and spoken replies
 * that only ever start from a user gesture. Typing keeps working whatever happens here.
 */
export function useVoice({
  serverVoice,
  send,
  setDraft,
  onTranscript,
  notify,
}: UseVoiceOptions): VoiceApi {
  const [env, setEnv] = useState<VoiceEnvironment | null>(null);
  const [browserFailed, setBrowserFailed] = useState(false);
  const [permission, setPermission] = useState<PermissionState | 'unknown'>('unknown');
  const [speakingTurnId, setSpeakingTurnId] = useState<string | null>(null);
  const pillRef = useRef<VoicePillHandle | null>(null);
  const session = useRef<Session | null>(null);
  const cancelled = useRef(false);
  const latest = useRef({ send, setDraft, onTranscript, notify });
  latest.current = { send, setDraft, onTranscript, notify };

  useEffect(
    () => setEnv(detectEnvironment(serverVoice, browserFailed)),
    [serverVoice, browserFailed],
  );

  useEffect(() => {
    let status: PermissionStatus | null = null;
    const update = () => status && setPermission(status.state);
    navigator.permissions
      ?.query({ name: 'microphone' as PermissionName })
      .then((s) => {
        status = s;
        update();
        s.addEventListener('change', update);
      })
      .catch(() => setPermission('unknown'));
    return () => status?.removeEventListener('change', update);
  }, []);

  const input = env ? chooseVoiceInput(env) : 'none';
  const output = env ? chooseVoiceOutput(env) : 'none';
  const speaker = useMemo(() => createSpeaker(output), [output]);
  useEffect(() => () => speaker.stop(), [speaker]);

  const { errors } = brand.copy;

  const fail = useCallback(
    (kind: 'micDenied' | 'micUnsupported', detail?: string) => {
      session.current = null;
      latest.current.send({ type: 'MIC_FAILED', error: kind });
      latest.current.notify(
        kind === 'micDenied' ? errors.micDenied : errors.micUnsupported,
        detail,
      );
      pillRef.current?.cancel();
    },
    [errors],
  );

  const finish = useCallback((text: string) => {
    session.current = null;
    if (cancelled.current) return;
    latest.current.send({ type: 'TRANSCRIBED' });
    const clean = text.trim();
    if (clean) latest.current.onTranscript(clean);
    else {
      latest.current.setDraft('');
      latest.current.notify(
        'I didn’t catch that.',
        'Try again a little closer to the mic — or type instead.',
      );
    }
  }, []);

  const transcribeFailed = useCallback((detail: string) => {
    session.current = null;
    latest.current.send({ type: 'TRANSCRIBE_FAILED' });
    latest.current.notify('I couldn’t make that out.', detail);
  }, []);

  const onPillStart = useCallback(() => {
    unlockAudio();
    speaker.stop();
    setSpeakingTurnId(null);
    cancelled.current = false;
    latest.current.send({ type: 'MIC_REQUESTED' });

    if (input === 'browser') {
      const recognizer = createRecognizer({
        onAudioStart: () => latest.current.send({ type: 'MIC_GRANTED' }),
        onPartial: (t) => latest.current.setDraft(t),
        onFinal: finish,
        onError: (e) => {
          if (e === 'denied') fail('micDenied');
          else if (e === 'no-speech') {
            pillRef.current?.cancel();
            finish('');
          } else if (e === 'network' && serverVoice) {
            setBrowserFailed(true);
            pillRef.current?.cancel();
            transcribeFailed(
              'Your browser’s speech service is unreachable, so I’ve switched to server transcription. Try once more.',
            );
          } else {
            pillRef.current?.cancel();
            transcribeFailed('Speech recognition stopped unexpectedly.');
          }
        },
      });
      if (!recognizer) return fail('micUnsupported');
      session.current = { kind: 'browser', recognizer };
      recognizer.start();
      return;
    }

    if (input === 'server') {
      const recording = startRecording();
      session.current = { kind: 'server', recording };
      recording.then(
        () => latest.current.send({ type: 'MIC_GRANTED' }),
        (error: unknown) => fail(error instanceof MicDeniedError ? 'micDenied' : 'micUnsupported'),
      );
      return;
    }

    fail('micUnsupported');
  }, [input, serverVoice, speaker, finish, fail, transcribeFailed]);

  const onPillStop = useCallback(
    ({ reason }: { reason: VoicePillStopReason }) => {
      const s = session.current;
      if (reason === 'mic-denied') {
        if (s?.kind === 'browser') s.recognizer.abort();
        if (s?.kind === 'server')
          s.recording.then(
            (r) => r.cancel(),
            () => undefined,
          );
        if (s) fail('micDenied');
        return;
      }
      if (!s) return;
      if (reason === 'release' || reason === 'tap' || reason === 'key') {
        latest.current.send({ type: 'LISTEN_STOPPED' });
        if (s.kind === 'browser') s.recognizer.stop();
        else {
          s.recording
            .then((r) => r.stop())
            .then((blob) => (blob.size > 0 ? transcribe(blob) : ''))
            .then(finish, () => transcribeFailed('The recording couldn’t be transcribed.'));
        }
        return;
      }
      // escape, cancel (slide), blur, disabled, unmount
      cancelled.current = true;
      session.current = null;
      if (s.kind === 'browser') s.recognizer.abort();
      else
        s.recording.then(
          (r) => r.cancel(),
          () => undefined,
        );
      latest.current.send({ type: 'LISTEN_CANCELLED' });
      latest.current.setDraft('');
    },
    [fail, finish, transcribeFailed],
  );

  const speak = useCallback(
    (turnId: string, text: string) => {
      void speaker.speak(text, {
        onStart: () => {
          setSpeakingTurnId(turnId);
          latest.current.send({ type: 'SPEAK_STARTED' });
        },
        onEnd: () => {
          setSpeakingTurnId((current) => (current === turnId ? null : current));
          latest.current.send({ type: 'SPEAK_ENDED' });
        },
      });
    },
    [speaker],
  );

  const stopSpeaking = useCallback(() => {
    speaker.stop();
    setSpeakingTurnId(null);
    latest.current.send({ type: 'SPEAK_ENDED' });
  }, [speaker]);

  return {
    input,
    output,
    permission,
    pillRef,
    onPillStart,
    onPillStop,
    speak,
    stopSpeaking,
    speakingTurnId,
  };
}

export const VoiceContext = createContext<VoiceApi | null>(null);
export const useVoiceContext = () => useContext(VoiceContext);
