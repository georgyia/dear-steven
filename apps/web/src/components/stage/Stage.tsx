'use client';

import { detectLanguage } from '@dear-steven/core/language';
import { LIMITS } from '@dear-steven/core/limits';
import type { Citation, KnowledgeStatus, SetupState } from '@dear-steven/core/schema';
import { speakable } from '@dear-steven/core/speech';
import { InformationCircleIcon, VoiceIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { LayoutGroup, MotionConfig } from 'motion/react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { TalkTurn } from '@/components/answer/TalkTurn';
import { TurnView } from '@/components/answer/TurnView';
import { Composer } from '@/components/composer/Composer';
import { ModeSwitch } from '@/components/composer/ModeSwitch';
import { EvidenceDrawer, type EvidenceTarget } from '@/components/evidence/EvidenceDrawer';
import { InterviewView } from '@/components/interview/InterviewView';
import { ToastProvider, ToastViewport, useToast } from '@/components/ui/Toasts';
import { ConversationBar, StartTalking } from '@/components/voice/ConversationBar';
import { VoiceControl } from '@/components/voice/VoiceControl';
import { VoiceSettings } from '@/components/voice/VoiceSettings';
import { useI18n } from '@/i18n/I18nProvider';
import { AskError, askStream, type ClientErrorCode, fetchStatus, openShared } from '@/lib/api';
import {
  citationOrder,
  conversationReducer,
  groupTurns,
  historyFor,
  initialConversation,
} from '@/lib/conversation';
import { isTypingTarget, useKeydown } from '@/lib/hooks';
import type { InterviewAction, InterviewQuestion, InterviewState } from '@/lib/interview';
import { restoredTurns } from '@/lib/memory';
import { useStageMode } from '@/lib/mode';
import { fetchSetup, forgetSetupToken, takeSetupToken } from '@/lib/setup';
import { sharedToken } from '@/lib/share';
import {
  ambientLevel,
  initialStage,
  isBusy,
  type StageErrorKind,
  transition,
} from '@/lib/stage-machine';
import { useAboutYou } from '@/lib/useAboutYou';
import { useConversationMemory } from '@/lib/useConversationMemory';
import { useInterview } from '@/lib/useInterview';
import { useVoicePreferences } from '@/lib/voice/preferences';
import { unlockAudio } from '@/lib/voice/speaker';
import type { SpeechQueue } from '@/lib/voice/speech-queue';
import { TURN_TIMING } from '@/lib/voice/turn-taking';
import { type TurnOutcome, useSpokenConversation } from '@/lib/voice/useSpokenConversation';
import { useVoice, VoiceContext } from '@/lib/voice/useVoice';
import { AboutDialog } from './AboutDialog';
import { AboutYouControl } from './AboutYouControl';
import { AmbientLayer } from './AmbientLayer';
import { ConversationView } from './ConversationView';
import { useFirstVisitNotice } from './Disclosure';
import { EpisodeExplorer } from './EpisodeExplorer';
import { HomeView } from './HomeView';
import { MemoryControl } from './MemoryControl';
import { SetupDialog } from './SetupDialog';
import { StatusPill } from './StatusPill';
import { CompactWordmark } from './Wordmark';

const STAGE_ERROR: Record<ClientErrorCode, StageErrorKind> = {
  network: 'network',
  rate_limited: 'rateLimited',
  upstream: 'upstream',
  not_configured: 'upstream',
  bad_request: 'generic',
  internal: 'generic',
  locked: 'generic',
  needs_key: 'generic',
  cross_site: 'generic',
};

export function Stage({ initialStatus }: { initialStatus: KnowledgeStatus }) {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <StageInner initialStatus={initialStatus} />
      </ToastProvider>
    </MotionConfig>
  );
}

/** How a question ended, for a spoken conversation to know whether to carry on (P9-02). */
type AskOutcome = 'answered' | 'stopped' | 'failed' | 'needsKey' | 'skipped';
type Ask = (question: string, options?: { voice?: boolean }) => Promise<AskOutcome>;

/** A key press on a button, link or field belongs to it, not to a shortcut. */
const onControl = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest(
    'button, a, input, select, textarea, [role="radio"], [role="switch"], [role="tab"]',
  ) !== null;

/** Sticky user activation: has this visit had a click, tap or key press yet? */
const hasBeenActive = () =>
  (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
    ?.hasBeenActive ?? true;

function StageInner({ initialStatus }: { initialStatus: KnowledgeStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [stage, send] = useReducer(transition, initialStage);
  const [conversation, dispatch] = useReducer(conversationReducer, initialConversation);
  const [draft, setDraft] = useState('');
  /** A citation of an answer, or one of a summary's moments (P8-04), stepping through its list. */
  const [drawer, setDrawer] = useState<
    { turnId: string; citationId: string } | { summary: Citation[]; index: number } | null
  >(null);
  const [dialog, setDialog] = useState<'setup' | 'about' | 'episodes' | 'voice' | null>(null);
  /** The setup panel was opened to add a key (P8-02): its key field takes the focus. */
  const [focusKey, setFocusKey] = useState(false);
  const [guided, setGuided] = useState<{ token: string; state: SetupState } | null>(null);
  const { prefs, update: updatePrefs, persisted } = useVoicePreferences();
  const [mode, setMode] = useStageMode();
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const { toast, dismiss } = useToast();
  const notice = useFirstVisitNotice();
  const { t, locale } = useI18n();
  const i18nRef = useRef({ t, locale });
  i18nRef.current = { t, locale };

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seq = useRef(0);
  /**
   * Turns whose answer is read aloud: spoken questions, every question with "always speak", and
   * talk-mode messages unless "read talk replies aloud" is off (P7-05).
   */
  const spokenTurns = useRef(new Set<string>());
  const askRef = useRef<Ask>(async () => 'skipped');
  /** The question being answered right now, if any. */
  const composingTurn = useRef<string | null>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const turnsRef = useRef(conversation.turns);
  turnsRef.current = conversation.turns;

  const turns = conversation.turns;
  const inConversation = turns.length > 0;
  const busy = isBusy(stage);

  const voice = useVoice({
    // On free questions (P8-02) server voice isn't offered; the browser's own voice is.
    serverVoice: status.mode === 'live' && status.free === null,
    send,
    setDraft,
    onTranscript: (text) => void askRef.current(text, { voice: true }),
    notify: (title, description) => toast({ title, description, tone: 'error', duration: 5200 }),
    preferences: prefs,
  });
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  /**
   * Talk out loud (P9-02): one tap, then you speak, your words go when you pause, the reply is read
   * as it is checked, and it's your turn again. Interrupting while he's still writing stops it;
   * ending stops it being read.
   */
  const startTalking = useRef<HTMLButtonElement>(null);
  const spoken = useSpokenConversation({
    voice,
    timing: TURN_TIMING.talk,
    onTurn: async (text) => {
      const outcome = await askRef.current(text, { voice: true });
      return outcome === 'needsKey' ? 'end' : outcome === 'failed' ? 'pause' : 'next';
    },
    onInterrupt: () => abortRef.current?.abort(),
    onEnd: () => {
      if (composingTurn.current) spokenTurns.current.delete(composingTurn.current);
    },
    send,
    notify: (title, description) => toast({ title, description, tone: 'error', duration: 5200 }),
  });
  const talkingAloud = spoken.state.phase !== 'off';
  const endTalking = useCallback(() => {
    spoken.end();
    requestAnimationFrame(() => startTalking.current?.focus());
  }, [spoken.end]);
  // Leaving Talk ends the conversation, and with it the microphone.
  useEffect(() => {
    if (mode !== 'talk' && talkingAloud) spoken.end();
  }, [mode, talkingAloud, spoken.end]);

  const interview = useInterview(locale);
  const interviewPhase = interview.state.phase;
  /** What the visitor chose to keep about themselves (P7-08): sent with questions, exactly. */
  const aboutYou = useAboutYou();
  const aboutRef = useRef(aboutYou.text);
  aboutRef.current = aboutYou.text;
  const interviewRef = useRef(interview.dispatch);
  interviewRef.current = interview.dispatch;
  const interviewState = useRef(interview.state);
  interviewState.current = interview.state;

  /** Resolves the next time the interview has moved on from waiting for a step (P9-03). */
  const interviewMoved = useRef<((state: InterviewState) => void) | null>(null);
  useEffect(() => {
    if (interview.state.phase === 'waiting' || !interviewMoved.current) return;
    const resolve = interviewMoved.current;
    interviewMoved.current = null;
    resolve(interview.state);
  }, [interview.state]);

  const askAloud = useCallback(
    (q: InterviewQuestion) =>
      voiceRef.current.speak(`interview-${q.index}`, q.question, q.language),
    [],
  );
  /** One step of the interview taken out loud: the next question is read, or the interview is over. */
  const interviewStepAloud = useCallback(
    async (action: InterviewAction): Promise<TurnOutcome> => {
      const from = interviewState.current.phase;
      if (from !== (action.type === 'retry' ? 'error' : 'asking')) return 'end';
      const moved = new Promise<InterviewState>((resolve) => {
        interviewMoved.current = resolve;
      });
      interviewRef.current(action);
      const next = await moved;
      if (next.phase === 'asking' && next.current) {
        askAloud(next.current);
        return 'next';
      }
      if (next.phase === 'error') return next.errorCode === 'needs_key' ? 'end' : 'pause';
      return 'end';
    },
    [askAloud],
  );

  /**
   * The interview, spoken (P9-03): the question is read, your answer is heard, and when you've
   * finished (a longer pause than in Talk) the next question is read, until the interview ends.
   */
  const startInterviewTalking = useRef<HTMLButtonElement>(null);
  const spokenInterview = useSpokenConversation({
    voice,
    timing: TURN_TIMING.interview,
    onBegin: () => {
      const { phase, current } = interviewState.current;
      if (phase === 'asking' && current) askAloud(current);
    },
    onTurn: (text) => interviewStepAloud({ type: 'answer', text }),
    send,
    notify: (title, description) => toast({ title, description, tone: 'error', duration: 5200 }),
  });
  const interviewAloud = spokenInterview.state.phase !== 'off';
  const interviewAloudRef = useRef(interviewAloud);
  interviewAloudRef.current = interviewAloud;
  const endInterviewAloud = useCallback(() => {
    spokenInterview.end();
    requestAnimationFrame(() => startInterviewTalking.current?.focus());
  }, [spokenInterview.end]);
  // Leaving the interview, or reaching its end, ends the conversation and with it the microphone.
  useEffect(() => {
    const over =
      interviewPhase !== 'asking' && interviewPhase !== 'waiting' && interviewPhase !== 'error';
    if (interviewAloud && (mode !== 'interview' || over)) spokenInterview.end();
  }, [mode, interviewPhase, interviewAloud, spokenInterview.end]);
  /** Skip, End and Retry in a spoken interview are his turn: the mic closes first. */
  const interviewDispatch = useCallback(
    (action: InterviewAction) => {
      const spokenStep =
        action.type === 'skip' || action.type === 'finish' || action.type === 'retry';
      if (spokenStep && spokenInterview.act(() => interviewStepAloud(action))) return;
      interview.dispatch(action);
    },
    [spokenInterview.act, interviewStepAloud, interview.dispatch],
  );

  const question = interview.state.current;
  // biome-ignore lint/correctness/useExhaustiveDependencies: speak each new question once
  useEffect(() => {
    if (!question || interview.state.phase !== 'asking') return;
    // A spoken interview reads its questions itself, in turn.
    if (!interviewAloudRef.current && prefsRef.current.alwaysSpeak) askAloud(question);
  }, [question]);

  const memory = useConversationMemory(conversation.turns, {
    restore: (restored) => dispatch({ type: 'restore', turns: restored }),
    onRestored: () =>
      toast({
        id: 'restored',
        title: i18nRef.current.t.stage.restoredTitle,
        description: i18nRef.current.t.stage.restoredBody,
        duration: 6000,
      }),
  });

  const refreshStatus = useCallback(
    (signal?: AbortSignal) =>
      fetchStatus(signal)
        .then(setStatus)
        .catch(() => undefined),
    [],
  );
  /** On free questions (P8-02), the count is asked for again after every question. */
  const onFreeQuestions = useRef(status.free !== null);
  onFreeQuestions.current = status.free !== null;
  useEffect(() => {
    if (onFreeQuestions.current && interviewPhase !== 'waiting') void refreshStatus();
  }, [interviewPhase, refreshStatus]);

  // Status: rendered on the server without the visitor's own key, so asked again at once (with
  // it), and whenever the tab regains focus (e.g. after an ingest run).
  useEffect(() => {
    const ctrl = new AbortController();
    const refresh = () => refreshStatus(ctrl.signal);
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      ctrl.abort();
      window.removeEventListener('focus', refresh);
    };
  }, [refreshStatus]);

  // Demo mode is announced, never implied. Each answer also carries its own "demo fixture" tag.
  // One message at a time (P7-04): while the first-visit notice is on the home screen, the demo
  // notice waits — on a phone it would otherwise sit on top of it. The status pill says "demo".
  const noticeShowing = notice.pending !== false && !inConversation && mode !== 'interview';
  useEffect(() => {
    if (status.mode !== 'demo' || noticeShowing) {
      dismiss('demo');
      return;
    }
    if (dialog === null) {
      toast({
        id: 'demo',
        title: t.demoNotice.title,
        description: t.demoNotice.description,
        actionLabel: t.demoNotice.action,
        onAction: () => setDialog('setup'),
        duration: 0,
        tone: 'ember',
      });
    }
  }, [status.mode, noticeShowing, dialog, toast, dismiss, t]);

  // A share link (P6-17) opens once a remembered conversation has had its chance to restore, so the
  // shared answer joins it instead of being replaced by it. The fragment is cleared first: a reload
  // shouldn't open it twice, and the question shouldn't linger in the address bar.
  useEffect(() => {
    if (!memory.loaded) return;
    const open = () => {
      const token = sharedToken(window.location.hash);
      if (token === null) return;
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      const { share } = i18nRef.current.t;
      openShared(token)
        .then(({ question, answer }) => {
          const id = `s${Date.now().toString(36)}`;
          const [turn] = restoredTurns([
            { id, question, steps: [], sources: null, final: { ...answer, share: token } },
          ]);
          if (turn) dispatch({ type: 'append', turn: { ...turn, shared: true } });
          toast({
            id: 'shared',
            title: share.openedTitle,
            description: share.openedBody,
            duration: 7000,
          });
        })
        .catch((error: unknown) =>
          toast({
            id: 'shared',
            title: share.failedTitle,
            description: error instanceof Error ? error.message : undefined,
            tone: 'error',
            duration: 7000,
          }),
        );
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, [memory.loaded, toast]);

  // Guided setup (P6-04): the link `pnpm dev:setup` printed opens the setup panel with it. A token the
  // server doesn't accept (a restarted server, a production one) is forgotten without a word. Taken
  // once per mount: the fragment is gone by the time an effect runs again.
  const setupLink = useRef<ReturnType<typeof takeSetupToken> | undefined>(undefined);
  useEffect(() => {
    if (setupLink.current === undefined) setupLink.current = takeSetupToken();
    const taken = setupLink.current;
    if (!taken) return;
    const ctrl = new AbortController();
    fetchSetup(taken.token, ctrl.signal)
      .then((state) => {
        if (!state) {
          forgetSetupToken();
          return;
        }
        setGuided({ token: taken.token, state });
        if (taken.fromLink) setDialog('setup');
      })
      .catch(() => undefined);
    return () => ctrl.abort();
  }, []);

  const ask = useCallback<Ask>(
    async (raw, options = {}) => {
      const question = raw.trim().slice(0, LIMITS.questionChars);
      // Only an answer already in flight blocks a new question. (A voice transcript arrives in the same
      // tick as TRANSCRIBED, before stageRef catches up; the reducer applies both in order.)
      if (!question || stageRef.current.kind === 'composing') return 'skipped';
      if (voiceRef.current.speakingTurnId) voiceRef.current.stopSpeaking();
      seq.current += 1;
      const id = `t${Date.now().toString(36)}${seq.current}`;
      const mode = modeRef.current === 'talk' ? 'talk' : 'ask';
      const aloud = prefsRef.current.alwaysSpeak || (mode === 'talk' && prefsRef.current.talkAloud);
      if (options.voice) spokenTurns.current.add(id);
      else if (aloud && hasBeenActive()) {
        // A typed question: this key press or click is the gesture that lets the reply play later.
        unlockAudio();
        spokenTurns.current.add(id);
      }
      const history = historyFor(turnsRef.current);
      setDraft('');
      setDrawer(null);
      dispatch({ type: 'turn.start', id, question, at: performance.now(), mode });
      send({ type: 'ASK' });

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      composingTurn.current = id;
      let settled = false;
      let outcome: AskOutcome = 'failed';
      // Talk is read aloud block by block, each one as soon as it has passed its checks (P9-01),
      // for as long as the turn is still to be read (ending a spoken conversation stops it).
      const replyLanguage = detectLanguage(question);
      let reading: SpeechQueue | null = null;
      try {
        for await (const event of askStream(
          {
            question,
            history,
            uiLocale: i18nRef.current.locale,
            mode,
            ...(aboutRef.current ? { about: aboutRef.current } : {}),
          },
          ctrl.signal,
        )) {
          dispatch({ type: 'turn.event', id, event, at: performance.now() });
          if (event.type === 'sources' || (event.type === 'status' && event.step === 'found')) {
            send({ type: 'FOUND' });
          } else if (
            event.type === 'block.start' ||
            (event.type === 'status' && event.step === 'writing')
          ) {
            send({ type: 'WRITING' });
          } else if (
            event.type === 'block.done' &&
            mode === 'talk' &&
            spokenTurns.current.has(id)
          ) {
            reading ??= voiceRef.current.reply(id);
            reading.add(speakable(event.block), replyLanguage);
          } else if (event.type === 'final') {
            settled = true;
            outcome = 'answered';
            send({ type: 'ANSWERED', insufficient: event.answer.mode === 'insufficient' });
            // Spoken replies follow a spoken question, or any question with "always speak" on — both
            // start from a gesture that unlocked audio. Talk has been reading its blocks already.
            if (reading) {
              reading.close();
              // Still talking once the answer is complete (it may already have finished).
              if (reading.playing) send({ type: 'SPEAK_STARTED' });
            } else if (spokenTurns.current.has(id) && event.answer.spoken) {
              voiceRef.current.speak(id, event.answer.spoken, event.answer.language);
            }
          } else if (event.type === 'error') {
            settled = true;
            outcome = event.code === 'needs_key' ? 'needsKey' : 'failed';
            send({ type: 'FAILED', error: STAGE_ERROR[event.code] });
          }
        }
        if (!settled) {
          if (ctrl.signal.aborted) {
            outcome = 'stopped';
            dispatch({ type: 'turn.stopped', id, at: performance.now() });
            send({ type: 'STOPPED' });
          } else {
            dispatch({
              type: 'turn.failed',
              id,
              code: 'upstream',
              message: i18nRef.current.t.stage.endedEarly,
              at: performance.now(),
            });
            send({ type: 'FAILED', error: 'upstream' });
          }
        }
      } catch (error) {
        if (ctrl.signal.aborted) {
          outcome = 'stopped';
          dispatch({ type: 'turn.stopped', id, at: performance.now() });
          send({ type: 'STOPPED' });
        } else {
          const code = error instanceof AskError ? error.code : 'network';
          outcome = code === 'needs_key' ? 'needsKey' : 'failed';
          dispatch({
            type: 'turn.failed',
            id,
            code,
            // The server's sentence, as written: not "Error: …".
            message: error instanceof Error ? error.message : String(error),
            at: performance.now(),
          });
          send({ type: 'FAILED', error: STAGE_ERROR[code] });
        }
      } finally {
        // Stopped: silence. Failed part way: what was checked is still said.
        if (ctrl.signal.aborted) reading?.stop();
        else reading?.close();
        if (abortRef.current === ctrl) abortRef.current = null;
        if (composingTurn.current === id) composingTurn.current = null;
        if (onFreeQuestions.current) void refreshStatus();
      }
      return outcome;
    },
    [refreshStatus],
  );
  askRef.current = ask;

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    voiceRef.current.stopSpeaking();
    dispatch({ type: 'reset' });
    send({ type: 'RESET' });
    setDrawer(null);
    setDraft('');
    window.scrollTo({ top: 0 });
  }, []);

  // Bring each new question to the top of the reading area.
  const lastTurnId = turns[turns.length - 1]?.id;
  useEffect(() => {
    if (!lastTurnId) return;
    const el = document.getElementById(`turn-${lastTurnId}`);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() =>
      el?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }),
    );
  }, [lastTurnId]);

  const target = useMemo<(EvidenceTarget & { order: string[]; turnId: string }) | null>(() => {
    if (!drawer) return null;
    if ('summary' in drawer) {
      const citation = drawer.summary[drawer.index];
      if (!citation) return null;
      const order = drawer.summary.map((c) => c.id);
      return { citation, index: drawer.index, total: order.length, order, turnId: '' };
    }
    const turn = turns.find((t) => t.id === drawer.turnId);
    if (!turn) return null;
    const order = citationOrder(turn);
    const index = order.indexOf(drawer.citationId);
    const citation = turn.citations[drawer.citationId];
    if (!citation || index < 0) return null;
    return { citation, index, total: order.length, order, turnId: turn.id };
  }, [drawer, turns]);

  const stepCitation = useCallback(
    (dir: 1 | -1) => {
      if (!target) return;
      if (drawer && 'summary' in drawer) {
        setDrawer({ ...drawer, index: (target.index + dir + target.total) % target.total });
        return;
      }
      const next = target.order[(target.index + dir + target.total) % target.total];
      if (!next) return;
      setDrawer({ turnId: target.turnId, citationId: next });
      const chip = document.querySelector(`#turn-${target.turnId} [data-citation="${next}"]`);
      chip?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
    [target, drawer],
  );

  /** Closing a moment a summary opened goes back to that summary. */
  const closeDrawer = useCallback(() => {
    if (drawer && 'summary' in drawer) setDialog('episodes');
    setDrawer(null);
  }, [drawer]);

  useKeydown((e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || dialog) return;
    const mic = voice.pillRef.current;
    if (e.key === 'Escape') {
      if (mic?.isListening()) {
        e.preventDefault();
        mic.cancel();
      } else if (drawer) {
        e.preventDefault();
        closeDrawer();
      } else if (talkingAloud) {
        e.preventDefault();
        endTalking();
      } else if (interviewAloud) {
        e.preventDefault();
        endInterviewAloud();
      } else if (voice.speakingTurnId) {
        voice.stopSpeaking();
      }
      return;
    }
    if (isTypingTarget(e.target)) return;
    // In a spoken conversation, Space is "your turn" (P9-02), unless it is pressing a control.
    const live = talkingAloud ? spoken : interviewAloud ? spokenInterview : null;
    if (e.key === ' ' && live && !onControl(e.target) && !e.repeat) {
      e.preventDefault();
      if (live.state.phase === 'his') live.interrupt();
      else if (live.state.phase === 'paused') live.resume();
      else live.finishTurn();
      return;
    }
    if (e.key === '/') {
      e.preventDefault();
      inputRef.current?.focus();
    } else if ((e.key === 'm' || e.key === 'M') && voice.input !== 'none' && !e.repeat) {
      e.preventDefault();
      if (mode === 'talk') {
        if (talkingAloud) endTalking();
        else if (!busy) spoken.start();
      } else if (mode === 'interview') {
        if (interviewAloud) endInterviewAloud();
        else if (interviewPhase === 'asking') spokenInterview.start();
      } else if (mic?.isListening()) mic.stop();
      else if (!busy) mic?.start();
    } else if (e.key === ']') {
      e.preventDefault();
      if (target) stepCitation(1);
      else {
        const latest = [...turns].reverse().find((t) => citationOrder(t).length > 0);
        const first = latest ? citationOrder(latest)[0] : undefined;
        if (latest && first) setDrawer({ turnId: latest.id, citationId: first });
      }
    } else if (e.key === '[' && target) {
      e.preventDefault();
      stepCitation(-1);
    }
  });

  const listening = stage.kind === 'listening' || stage.kind === 'requestingMic';
  // Free questions (P8-02): said quietly once the first is used, until none are left.
  const freeLeft = status.free && status.free.used > 0 ? status.free.remaining : 0;
  const talking = mode === 'talk';
  const composer = (
    <div className="flex flex-col gap-2">
      <ModeSwitch mode={mode} onChange={setMode} />
      {talking && talkingAloud ? (
        <ConversationBar
          conversation={spoken}
          speaking={voice.speakingTurnId !== null}
          onEnd={endTalking}
        />
      ) : (
        <Composer
          value={draft}
          onValueChange={setDraft}
          onSend={(q) => void ask(q)}
          onStop={stop}
          busy={busy}
          placeholder={
            listening
              ? t.composer.listening
              : talking
                ? inConversation
                  ? t.composer.talkFollowUp
                  : t.composer.talkPlaceholder
                : inConversation
                  ? t.composer.followUp
                  : t.composer.placeholder
          }
          inputRef={inputRef}
          voice={
            talking && voice.input !== 'none' ? (
              <StartTalking ref={startTalking} onStart={spoken.start} disabled={busy} />
            ) : (
              <VoiceControl
                voice={voice}
                disabled={busy}
                onUnavailable={() =>
                  toast({ id: 'no-voice', title: t.errors.micUnsupported, duration: 4000 })
                }
              />
            )
          }
        />
      )}
      {freeLeft ? (
        <p className="px-4 text-[12.5px] text-ivory-2" data-testid="free-left">
          {t.free.left(freeLeft)}
        </p>
      ) : null}
    </div>
  );

  const modeSwitch = <ModeSwitch mode={mode} onChange={setMode} />;
  const interviewing =
    interview.state.current !== null &&
    (interview.state.phase === 'asking' ||
      interview.state.phase === 'waiting' ||
      interview.state.phase === 'error');
  const interviewDock = interviewing ? (
    <div className="flex flex-col gap-2">
      {modeSwitch}
      {interviewAloud ? (
        <ConversationBar
          conversation={spokenInterview}
          speaking={voice.speakingTurnId !== null}
          onEnd={endInterviewAloud}
        />
      ) : (
        <Composer
          value={draft}
          onValueChange={setDraft}
          onSend={(text) => {
            setDraft('');
            interview.dispatch({ type: 'answer', text });
          }}
          onStop={() => undefined}
          busy={interview.state.phase !== 'asking'}
          placeholder={t.interview.placeholder}
          label={t.interview.answerLabel}
          inputRef={inputRef}
          voice={
            voice.input !== 'none' ? (
              <StartTalking
                ref={startInterviewTalking}
                onStart={spokenInterview.start}
                disabled={interview.state.phase !== 'asking'}
              />
            ) : (
              <VoiceControl
                voice={voice}
                disabled
                onUnavailable={() =>
                  toast({ id: 'no-voice', title: t.errors.micUnsupported, duration: 4000 })
                }
              />
            )
          }
        />
      )}
    </div>
  ) : (
    modeSwitch
  );

  const pill = <StatusPill status={status} onOpen={() => setDialog('setup')} />;
  const useOwnKey = () => {
    setFocusKey(true);
    setDialog('setup');
  };
  const voiceSettings = (
    <button
      type="button"
      onClick={() => setDialog('voice')}
      aria-label={t.stage.voiceSettings}
      className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] whitespace-nowrap text-ivory-2 transition-colors hover:bg-ink-2 hover:text-ivory-0"
    >
      <HugeiconsIcon icon={VoiceIcon} size={15} strokeWidth={1.8} />
      <span className="hidden sm:inline">{t.stage.voice}</span>
    </button>
  );
  const about = (
    <button
      type="button"
      onClick={() => setDialog('about')}
      className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] whitespace-nowrap text-ivory-2 transition-colors hover:bg-ink-2 hover:text-ivory-0"
    >
      <HugeiconsIcon icon={InformationCircleIcon} size={15} strokeWidth={1.8} />
      <span className="sm:hidden">{t.stage.about}</span>
      <span className="hidden sm:inline">{t.stage.howItWorks}</span>
    </button>
  );

  return (
    <VoiceContext.Provider value={voice}>
      <AmbientLayer
        level={ambientLevel(stage, inConversation || mode === 'interview')}
        active={stage.kind === 'composing' || interview.state.phase === 'waiting'}
      />
      <LayoutGroup>
        {mode === 'interview' ? (
          <InterviewView
            state={interview.state}
            dispatch={interviewDispatch}
            dock={interviewDock}
            demo={status.mode === 'demo'}
            onBack={() => setMode('ask')}
            about={aboutYou}
            onUseOwnKey={useOwnKey}
            header={
              <>
                <CompactWordmark
                  onClick={() => {
                    setMode('ask');
                    reset();
                  }}
                />
                <div className="flex items-center gap-1">
                  {voiceSettings}
                  {about}
                  {pill}
                </div>
              </>
            }
          />
        ) : inConversation ? (
          <ConversationView
            drawerOpen={target !== null}
            composer={composer}
            header={
              <>
                <CompactWordmark onClick={reset} />
                <div className="flex items-center gap-1">
                  {voiceSettings}
                  {about}
                  {pill}
                </div>
              </>
            }
          >
            {groupTurns(turns).map((group) =>
              group.kind === 'ask' ? (
                <TurnView
                  key={group.turn.id}
                  turn={group.turn}
                  activeCitationId={target?.turnId === group.turn.id ? target.citation.id : null}
                  onOpenCitation={(turnId, citationId) => setDrawer({ turnId, citationId })}
                  onRetry={(q) => void ask(q)}
                  onUseOwnKey={useOwnKey}
                />
              ) : (
                <section
                  key={group.turns[0]?.id}
                  aria-label={t.talk.label}
                  className="flex flex-col gap-8"
                >
                  <p className="font-mono text-[10.5px] tracking-[0.16em] text-steel uppercase">
                    {t.talk.eyebrow}
                  </p>
                  {group.turns.map((turn) => (
                    <TalkTurn
                      key={turn.id}
                      turn={turn}
                      activeCitationId={target?.turnId === turn.id ? target.citation.id : null}
                      onOpenCitation={(turnId, citationId) => setDrawer({ turnId, citationId })}
                      onRetry={(q) => void ask(q)}
                      onUseOwnKey={useOwnKey}
                    />
                  ))}
                </section>
              ),
            )}
            <MemoryControl
              remember={memory.remember}
              supported={memory.supported}
              saveFailed={memory.saveFailed}
              onChange={memory.setRemember}
              onForget={() => void memory.forget()}
              onUndo={() => memory.setRemember(true)}
            />
            {aboutYou.text || aboutYou.undo ? (
              <AboutYouControl
                text={aboutYou.text ?? aboutYou.undo ?? ''}
                failed={aboutYou.failed}
                demo={status.mode === 'demo'}
                onKeep={aboutYou.keep}
                onForget={() => void aboutYou.forget()}
              />
            ) : null}
          </ConversationView>
        ) : (
          <HomeView
            composer={composer}
            footerStart={pill}
            notice={notice}
            footerEnd={
              <div className="flex items-center gap-1">
                {voiceSettings}
                {about}
              </div>
            }
            onExample={(q) => void ask(q)}
          />
        )}
      </LayoutGroup>

      <EvidenceDrawer
        target={target}
        onPrev={() => stepCitation(-1)}
        onNext={() => stepCitation(1)}
        onClose={closeDrawer}
      />
      <ToastViewport
        className={
          inConversation || mode === 'interview'
            ? `right-4 bottom-[calc(env(safe-area-inset-bottom)+10.25rem)] sm:right-6 ${target ? 'lg:right-[calc(var(--drawer)+24px)]' : ''}`
            : 'right-4 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] sm:right-6 sm:bottom-20'
        }
      />
      <SetupDialog
        open={dialog === 'setup'}
        onClose={() => {
          setDialog(null);
          setFocusKey(false);
        }}
        status={status}
        focusKey={focusKey}
        onBrowse={() => setDialog('episodes')}
        onKeyChange={() => void refreshStatus()}
        guided={
          guided && {
            ...guided,
            onState: (state) => setGuided((current) => current && { ...current, state }),
          }
        }
      />
      <EpisodeExplorer
        open={dialog === 'episodes'}
        onClose={() => setDialog(null)}
        onOpenMoment={(summary, index) => {
          setDialog(null);
          setDrawer({ summary, index });
        }}
      />
      <AboutDialog open={dialog === 'about'} onClose={() => setDialog(null)} />
      <VoiceSettings
        open={dialog === 'voice'}
        onClose={() => setDialog(null)}
        prefs={prefs}
        update={updatePrefs}
        persisted={persisted}
        voice={voice}
      />
    </VoiceContext.Provider>
  );
}
