'use client';

import { LIMITS } from '@dear-steven/core/limits';
import type { AskErrorCode, KnowledgeStatus } from '@dear-steven/core/schema';
import { InformationCircleIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { LayoutGroup, MotionConfig } from 'motion/react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { brand } from '@/brand';
import { TurnView } from '@/components/answer/TurnView';
import { Composer } from '@/components/composer/Composer';
import { EvidenceDrawer, type EvidenceTarget } from '@/components/evidence/EvidenceDrawer';
import { ToastProvider, ToastViewport, useToast } from '@/components/ui/Toasts';
import { VoiceControl } from '@/components/voice/VoiceControl';
import { AskError, askStream, fetchStatus } from '@/lib/api';
import {
  citationOrder,
  conversationReducer,
  historyFor,
  initialConversation,
} from '@/lib/conversation';
import { isTypingTarget, useKeydown } from '@/lib/hooks';
import {
  ambientLevel,
  initialStage,
  isBusy,
  type StageErrorKind,
  transition,
} from '@/lib/stage-machine';
import { useVoice, VoiceContext } from '@/lib/voice/useVoice';
import { AboutDialog } from './AboutDialog';
import { AmbientLayer } from './AmbientLayer';
import { ConversationView } from './ConversationView';
import { EpisodeExplorer } from './EpisodeExplorer';
import { HomeView } from './HomeView';
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

function StageInner({ initialStatus }: { initialStatus: KnowledgeStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [stage, send] = useReducer(transition, initialStage);
  const [conversation, dispatch] = useReducer(conversationReducer, initialConversation);
  const [draft, setDraft] = useState('');
  const [drawer, setDrawer] = useState<{ turnId: string; citationId: string } | null>(null);
  const [dialog, setDialog] = useState<'setup' | 'about' | 'episodes' | null>(null);
  const { toast, dismiss } = useToast();

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seq = useRef(0);
  const voiceTurns = useRef(new Set<string>());
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
  });
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  // Status: rendered on the server, refreshed when the tab regains focus (e.g. after an ingest run).
  useEffect(() => {
    const ctrl = new AbortController();
    const refresh = () =>
      fetchStatus(ctrl.signal)
        .then(setStatus)
        .catch(() => undefined);
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      ctrl.abort();
      window.removeEventListener('focus', refresh);
    };
  }, []);

  // Demo mode is announced, never implied. Each answer also carries its own "demo fixture" tag.
  useEffect(() => {
    if (status.mode !== 'demo') {
      dismiss('demo');
      return;
    }
    if (dialog === null) {
      toast({
        id: 'demo',
        title: brand.copy.demoNotice.title,
        description: brand.copy.demoNotice.description,
        actionLabel: brand.copy.demoNotice.action,
        onAction: () => setDialog('setup'),
        duration: 0,
        tone: 'ember',
      });
    }
  }, [status.mode, dialog, toast, dismiss]);

  const ask = useCallback<Ask>(async (raw, options = {}) => {
    const question = raw.trim().slice(0, LIMITS.questionChars);
    // Only an answer already in flight blocks a new question. (A voice transcript arrives in the same
    // tick as TRANSCRIBED, before stageRef catches up; the reducer applies both in order.)
    if (!question || stageRef.current.kind === 'composing') return;
    if (voiceRef.current.speakingTurnId) voiceRef.current.stopSpeaking();
    seq.current += 1;
    const id = `t${Date.now().toString(36)}${seq.current}`;
    if (options.voice) voiceTurns.current.add(id);
    const history = historyFor(turnsRef.current);
    setDraft('');
    setDrawer(null);
    dispatch({ type: 'turn.start', id, question, at: performance.now() });
    send({ type: 'ASK' });

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let settled = false;
    try {
      for await (const event of askStream({ question, history }, ctrl.signal)) {
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
          // Spoken replies only follow a spoken question: that press is the gesture that unlocked audio.
          if (voiceTurns.current.has(id) && event.answer.spoken) {
            voiceRef.current.speak(id, event.answer.spoken);
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
            message: 'The answer ended early.',
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
        listening ? 'Listening…' : inConversation ? brand.followUpPlaceholder : brand.placeholder
      }
      inputRef={inputRef}
      voice={
        <VoiceControl
          voice={voice}
          disabled={busy}
          onUnavailable={() =>
            toast({ id: 'no-voice', title: brand.copy.errors.micUnsupported, duration: 4000 })
          }
        />
      }
    />
  );

  const pill = <StatusPill status={status} onOpen={() => setDialog('setup')} />;
  const about = (
    <button
      type="button"
      onClick={() => setDialog('about')}
      className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] whitespace-nowrap text-ivory-2 transition-colors hover:bg-ink-2 hover:text-ivory-0"
    >
      <HugeiconsIcon icon={InformationCircleIcon} size={15} strokeWidth={1.8} />
      <span className="sm:hidden">About</span>
      <span className="hidden sm:inline">How this works</span>
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
          </ConversationView>
        ) : (
          <HomeView
            composer={composer}
            footerStart={pill}
            footerEnd={about}
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
      />
      <EpisodeExplorer open={dialog === 'episodes'} onClose={() => setDialog(null)} />
      <AboutDialog open={dialog === 'about'} onClose={() => setDialog(null)} />
    </VoiceContext.Provider>
  );
}
