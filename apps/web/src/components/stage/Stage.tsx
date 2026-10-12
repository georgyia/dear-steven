'use client';

import { LIMITS } from '@dear-steven/core/limits';
import type { AskErrorCode, KnowledgeStatus, SetupState } from '@dear-steven/core/schema';
import { InformationCircleIcon, VoiceIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { LayoutGroup, MotionConfig } from 'motion/react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { TurnView } from '@/components/answer/TurnView';
import { Composer } from '@/components/composer/Composer';
import { EvidenceDrawer, type EvidenceTarget } from '@/components/evidence/EvidenceDrawer';
import { ToastProvider, ToastViewport, useToast } from '@/components/ui/Toasts';
import { VoiceControl } from '@/components/voice/VoiceControl';
import { VoiceSettings } from '@/components/voice/VoiceSettings';
import { useI18n } from '@/i18n/I18nProvider';
import { AskError, askStream, fetchStatus, openShared } from '@/lib/api';
import {
  citationOrder,
  conversationReducer,
  historyFor,
  initialConversation,
} from '@/lib/conversation';
import { isTypingTarget, useKeydown } from '@/lib/hooks';
import { restoredTurns } from '@/lib/memory';
import { fetchSetup, forgetSetupToken, takeSetupToken } from '@/lib/setup';
import { sharedToken } from '@/lib/share';
import {
  ambientLevel,
  initialStage,
  isBusy,
  type StageErrorKind,
  transition,
} from '@/lib/stage-machine';
import { useConversationMemory } from '@/lib/useConversationMemory';
import { useVoicePreferences } from '@/lib/voice/preferences';
import { unlockAudio } from '@/lib/voice/speaker';
import { useVoice, VoiceContext } from '@/lib/voice/useVoice';
import { AboutDialog } from './AboutDialog';
import { AmbientLayer } from './AmbientLayer';
import { ConversationView } from './ConversationView';
import { useFirstVisitNotice } from './Disclosure';
import { EpisodeExplorer } from './EpisodeExplorer';
import { HomeView } from './HomeView';
import { MemoryControl } from './MemoryControl';
import { SetupDialog } from './SetupDialog';
import { StatusPill } from './StatusPill';
import { CompactWordmark } from './Wordmark';

const STAGE_ERROR: Record<AskErrorCode | 'network', StageErrorKind> = {
  network: 'network',
  rate_limited: 'rateLimited',
  upstream: 'upstream',
  not_configured: 'upstream',
  bad_request: 'generic',
  internal: 'generic',
  locked: 'generic',
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

type Ask = (question: string, options?: { voice?: boolean }) => Promise<void>;

/** Sticky user activation: has this visit had a click, tap or key press yet? */
const hasBeenActive = () =>
  (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
    ?.hasBeenActive ?? true;

function StageInner({ initialStatus }: { initialStatus: KnowledgeStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [stage, send] = useReducer(transition, initialStage);
  const [conversation, dispatch] = useReducer(conversationReducer, initialConversation);
  const [draft, setDraft] = useState('');
  const [drawer, setDrawer] = useState<{ turnId: string; citationId: string } | null>(null);
  const [dialog, setDialog] = useState<'setup' | 'about' | 'episodes' | 'voice' | null>(null);
  const [guided, setGuided] = useState<{ token: string; state: SetupState } | null>(null);
  const { prefs, update: updatePrefs, persisted } = useVoicePreferences();
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
  /** Turns whose answer is read aloud: spoken questions, and every question with "always speak". */
  const spokenTurns = useRef(new Set<string>());
  const askRef = useRef<Ask>(async () => undefined);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const turnsRef = useRef(conversation.turns);
  turnsRef.current = conversation.turns;

  const turns = conversation.turns;
  const inConversation = turns.length > 0;
  const busy = isBusy(stage);

  const voice = useVoice({
    serverVoice: status.mode === 'live',
    send,
    setDraft,
    onTranscript: (text) => void askRef.current(text, { voice: true }),
    notify: (title, description) => toast({ title, description, tone: 'error', duration: 5200 }),
    preferences: prefs,
  });
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

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
  const noticeShowing = notice.pending !== false && !inConversation;
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

  const ask = useCallback<Ask>(async (raw, options = {}) => {
    const question = raw.trim().slice(0, LIMITS.questionChars);
    // Only an answer already in flight blocks a new question. (A voice transcript arrives in the same
    // tick as TRANSCRIBED, before stageRef catches up; the reducer applies both in order.)
    if (!question || stageRef.current.kind === 'composing') return;
    if (voiceRef.current.speakingTurnId) voiceRef.current.stopSpeaking();
    seq.current += 1;
    const id = `t${Date.now().toString(36)}${seq.current}`;
    if (options.voice) spokenTurns.current.add(id);
    else if (prefsRef.current.alwaysSpeak && hasBeenActive()) {
      // A typed question: this key press or click is the gesture that lets the reply play later.
      unlockAudio();
      spokenTurns.current.add(id);
    }
    const history = historyFor(turnsRef.current);
    setDraft('');
    setDrawer(null);
    dispatch({ type: 'turn.start', id, question, at: performance.now() });
    send({ type: 'ASK' });

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let settled = false;
    try {
      for await (const event of askStream(
        { question, history, uiLocale: i18nRef.current.locale },
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
        } else if (event.type === 'final') {
          settled = true;
          send({ type: 'ANSWERED', insufficient: event.answer.mode === 'insufficient' });
          // Spoken replies follow a spoken question, or any question with "always speak" on — both
          // start from a gesture that unlocked audio.
          if (spokenTurns.current.has(id) && event.answer.spoken) {
            voiceRef.current.speak(id, event.answer.spoken, event.answer.language);
          }
        } else if (event.type === 'error') {
          settled = true;
          send({ type: 'FAILED', error: STAGE_ERROR[event.code] });
        }
      }
      if (!settled) {
        if (ctrl.signal.aborted) {
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
        dispatch({ type: 'turn.stopped', id, at: performance.now() });
        send({ type: 'STOPPED' });
      } else {
        const code = error instanceof AskError ? error.code : 'network';
        dispatch({ type: 'turn.failed', id, code, message: String(error), at: performance.now() });
        send({ type: 'FAILED', error: STAGE_ERROR[code] });
      }
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }, []);
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
      const next = target.order[(target.index + dir + target.total) % target.total];
      if (!next) return;
      setDrawer({ turnId: target.turnId, citationId: next });
      const chip = document.querySelector(`#turn-${target.turnId} [data-citation="${next}"]`);
      chip?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
    [target],
  );

  useKeydown((e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || dialog) return;
    const mic = voice.pillRef.current;
    if (e.key === 'Escape') {
      if (mic?.isListening()) {
        e.preventDefault();
        mic.cancel();
      } else if (voice.speakingTurnId) {
        voice.stopSpeaking();
      } else if (drawer) {
        e.preventDefault();
        setDrawer(null);
      }
      return;
    }
    if (isTypingTarget(e.target)) return;
    if (e.key === '/') {
      e.preventDefault();
      inputRef.current?.focus();
    } else if ((e.key === 'm' || e.key === 'M') && voice.input !== 'none' && !e.repeat) {
      e.preventDefault();
      if (mic?.isListening()) mic.stop();
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
  const composer = (
    <Composer
      value={draft}
      onValueChange={setDraft}
      onSend={(q) => void ask(q)}
      onStop={stop}
      busy={busy}
      placeholder={
        listening
          ? t.composer.listening
          : inConversation
            ? t.composer.followUp
            : t.composer.placeholder
      }
      inputRef={inputRef}
      voice={
        <VoiceControl
          voice={voice}
          disabled={busy}
          onUnavailable={() =>
            toast({ id: 'no-voice', title: t.errors.micUnsupported, duration: 4000 })
          }
        />
      }
    />
  );

  const pill = <StatusPill status={status} onOpen={() => setDialog('setup')} />;
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
        level={ambientLevel(stage, inConversation)}
        active={stage.kind === 'composing'}
      />
      <LayoutGroup>
        {inConversation ? (
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
            {turns.map((turn) => (
              <TurnView
                key={turn.id}
                turn={turn}
                activeCitationId={target?.turnId === turn.id ? target.citation.id : null}
                onOpenCitation={(turnId, citationId) => setDrawer({ turnId, citationId })}
                onRetry={(q) => void ask(q)}
              />
            ))}
            <MemoryControl
              remember={memory.remember}
              supported={memory.supported}
              saveFailed={memory.saveFailed}
              onChange={memory.setRemember}
              onForget={() => void memory.forget()}
              onUndo={() => memory.setRemember(true)}
            />
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
        onClose={() => setDrawer(null)}
      />
      <ToastViewport
        className={
          inConversation
            ? `right-4 bottom-[calc(env(safe-area-inset-bottom)+7.75rem)] sm:right-6 ${target ? 'lg:right-[calc(var(--drawer)+24px)]' : ''}`
            : 'right-4 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] sm:right-6 sm:bottom-20'
        }
      />
      <SetupDialog
        open={dialog === 'setup'}
        onClose={() => setDialog(null)}
        status={status}
        onBrowse={() => setDialog('episodes')}
        onKeyChange={() => void refreshStatus()}
        guided={
          guided && {
            ...guided,
            onState: (state) => setGuided((current) => current && { ...current, state }),
          }
        }
      />
      <EpisodeExplorer open={dialog === 'episodes'} onClose={() => setDialog(null)} />
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
