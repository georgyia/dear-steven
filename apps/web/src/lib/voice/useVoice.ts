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
import type {
  VoicePillHandle,
  VoicePillStopReason,
} from '@/components/vendor/react-bits/VoicePill';
import { useI18n } from '@/i18n/I18nProvider';
import type { StageEvent } from '@/lib/stage-machine';
import {
  chooseVoiceInput,
  chooseVoiceOutput,
  detectEnvironment,
  type VoiceEnvironment,
  type VoiceInput,
  type VoiceOutput,
} from './capabilities';
import type { VoicePreferences } from './preferences';
import {
  createRecognizer,
  installOnDevice,
  type OnDeviceStatus,
  onDeviceStatus,
  type Recognizer,
  recognitionLang,
} from './recognition';
import { MicDeniedError, type Recording, startRecording, transcribe } from './recorder';
import { createSpeaker, unlockAudio } from './speaker';
import type { SpeechQueue } from './speech-queue';

export interface VoiceApi {
  input: VoiceInput;
  output: VoiceOutput;
  permission: PermissionState | 'unknown';
  pillRef: RefObject<VoicePillHandle | null>;
  onPillStart: () => void;
  onPillStop: (info: { reason: VoicePillStopReason }) => void;
  /** Must be called from a user gesture (or after one already unlocked audio). */
  speak: (turnId: string, text: string, language: string) => void;
  /**
   * A reply read aloud part by part, each part as soon as it arrives (P9-01). Like `speak`, only
   * after a gesture in this visit. Stops whatever was playing.
   */
  reply: (turnId: string) => SpeechQueue;
  /** Resolves once nothing is being read aloud, whatever starts reading meanwhile (P9-02). */
  whenQuiet: () => Promise<void>;
  /** How to listen in a spoken conversation (P9-02): the language, and on the device or not. */
  listening: { lang: string; processLocally: boolean };
  stopSpeaking: () => void;
  speakingTurnId: string | null;
  /** Chrome on-device recognition for this browser; `unknown` until checked. */
  onDevice: OnDeviceStatus | 'unknown';
  /** Look up on-device support (once). Called when the settings open. */
  checkOnDevice: () => void;
  /** Download the on-device model; resolves to whether it is now available. */
  installOnDevice: () => Promise<boolean>;
  /** Say a sample line, in the interface language, in the chosen voice. Call from a click. */
  preview: (text: string) => void;
}

interface UseVoiceOptions {
  /** Live mode: /api/transcribe and /api/speech are available. */
  serverVoice: boolean;
  send: (event: StageEvent) => void;
  /** Interim transcript while listening, shown in the composer. */
  setDraft: (text: string) => void;
  onTranscript: (text: string) => void;
  notify: (title: string, description?: string) => void;
  preferences: VoicePreferences;
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
  preferences,
}: UseVoiceOptions): VoiceApi {
  const [env, setEnv] = useState<VoiceEnvironment | null>(null);
  const [browserFailed, setBrowserFailed] = useState(false);
  const [permission, setPermission] = useState<PermissionState | 'unknown'>('unknown');
  const [speakingTurnId, setSpeakingTurnId] = useState<string | null>(null);
  const pillRef = useRef<VoicePillHandle | null>(null);
  const session = useRef<Session | null>(null);
  const cancelled = useRef(false);
  /** Which reading aloud is the current one: a stopped one ending late changes nothing. */
  const reading = useRef(0);
  /** When the current reading is over. */
  const readingDone = useRef<Promise<void>>(Promise.resolve());
  const { t, locale } = useI18n();
  const listenFor = recognitionLang(locale);
  const latest = useRef({ send, setDraft, onTranscript, notify, t });
  latest.current = { send, setDraft, onTranscript, notify, t };

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
  const { serverVoice: chosenServer, browserVoice: chosenBrowser } = preferences;
  const speaker = useMemo(
    () => createSpeaker(output, { server: chosenServer, browser: chosenBrowser }),
    [output, chosenServer, chosenBrowser],
  );
  useEffect(() => () => speaker.stop(), [speaker]);

  // Probed lazily — when the settings open, or when the user already opted in — never just because
  // the page loaded (see onDeviceProbeAllowed).
  const [onDevice, setOnDevice] = useState<OnDeviceStatus | 'unknown'>('unknown');
  const [probe, setProbe] = useState(false);
  const wantOnDevice = preferences.onDevice;
  useEffect(() => {
    if (input !== 'browser' || !(probe || wantOnDevice)) return;
    let live = true;
    void onDeviceStatus(listenFor).then((s) => live && setOnDevice(s));
    return () => {
      live = false;
    };
  }, [input, probe, wantOnDevice, listenFor]);
  const checkOnDevice = useCallback(() => setProbe(true), []);
  const processLocally = preferences.onDevice && onDevice === 'available';

  const fail = useCallback((kind: 'micDenied' | 'micUnsupported', detail?: string) => {
    session.current = null;
    latest.current.send({ type: 'MIC_FAILED', error: kind });
    latest.current.notify(latest.current.t.errors[kind], detail);
    pillRef.current?.cancel();
  }, []);

  const finish = useCallback((text: string) => {
    session.current = null;
    if (cancelled.current) return;
    latest.current.send({ type: 'TRANSCRIBED' });
    const clean = text.trim();
    if (clean) latest.current.onTranscript(clean);
    else {
      latest.current.setDraft('');
      const { voiceErrors } = latest.current.t;
      latest.current.notify(voiceErrors.noSpeech, voiceErrors.noSpeechHint);
    }
  }, []);

  const transcribeFailed = useCallback((detail: string) => {
    session.current = null;
    latest.current.send({ type: 'TRANSCRIBE_FAILED' });
    latest.current.notify(latest.current.t.voiceErrors.unclear, detail);
  }, []);

  const onPillStart = useCallback(() => {
    unlockAudio();
    reading.current += 1;
    speaker.stop();
    setSpeakingTurnId(null);
    cancelled.current = false;
    latest.current.send({ type: 'MIC_REQUESTED' });

    if (input === 'browser') {
      const recognizer = createRecognizer(
        {
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
              transcribeFailed(latest.current.t.voiceErrors.serviceDown);
            } else {
              pillRef.current?.cancel();
              transcribeFailed(latest.current.t.voiceErrors.stopped);
            }
          },
        },
        // Until you let go or tap again, however often the browser stops by itself (P10-14).
        { lang: listenFor, processLocally, keepListening: true },
      );
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
  }, [input, serverVoice, speaker, listenFor, processLocally, finish, fail, transcribeFailed]);

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
            .then(finish, () => transcribeFailed(latest.current.t.voiceErrors.recording));
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

  const handlersFor = useCallback((turnId: string) => {
    reading.current += 1;
    const mine = reading.current;
    return {
      onStart: () => {
        if (mine !== reading.current) return;
        setSpeakingTurnId(turnId);
        latest.current.send({ type: 'SPEAK_STARTED' });
      },
      onEnd: () => {
        if (mine !== reading.current) return;
        setSpeakingTurnId((current) => (current === turnId ? null : current));
        latest.current.send({ type: 'SPEAK_ENDED' });
      },
    };
  }, []);

  const speak = useCallback(
    (turnId: string, text: string, language: string) => {
      readingDone.current = speaker.speak(text, language, handlersFor(turnId));
    },
    [speaker, handlersFor],
  );

  const reply = useCallback(
    (turnId: string) => {
      const queue = speaker.reply(handlersFor(turnId));
      readingDone.current = queue.done;
      return queue;
    },
    [speaker, handlersFor],
  );

  const listening = useMemo(
    () => ({ lang: listenFor, processLocally }),
    [listenFor, processLocally],
  );

  const whenQuiet = useCallback(async () => {
    let current: Promise<void>;
    do {
      current = readingDone.current;
      await current;
    } while (current !== readingDone.current);
  }, []);

  const preview = useCallback(
    (text: string) => {
      unlockAudio();
      reading.current += 1;
      setSpeakingTurnId(null);
      void speaker.speak(text, locale);
    },
    [speaker, locale],
  );

  const install = useCallback(async () => {
    const ok = await installOnDevice(listenFor);
    const status = await onDeviceStatus(listenFor);
    setOnDevice(status);
    return ok && status === 'available';
  }, [listenFor]);

  const stopSpeaking = useCallback(() => {
    reading.current += 1;
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
    reply,
    whenQuiet,
    listening,
    stopSpeaking,
    speakingTurnId,
    onDevice,
    checkOnDevice,
    installOnDevice: install,
    preview,
  };
}

export const VoiceContext = createContext<VoiceApi | null>(null);
export const useVoiceContext = () => useContext(VoiceContext);
