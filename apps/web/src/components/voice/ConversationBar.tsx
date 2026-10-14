'use client';

import { Mic01Icon, MicOff01Icon, VolumeHighIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useReducedMotion } from 'motion/react';
import { forwardRef, useEffect, useRef } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { TURN_TIMING } from '@/lib/voice/turn-taking';
import type { SpokenConversation } from '@/lib/voice/useSpokenConversation';

/** What the bar shows: his turn splits into thinking and speaking. */
type Shown = 'yours' | 'thinking' | 'speaking' | 'paused';

/**
 * A spoken conversation in the composer's place (P9-02): who has the turn, your words as you say
 * them, one action for the moment (Send, Interrupt, Keep talking) and End. The transcript keeps
 * building above it, with its sources. One primary button whose label changes, so focus never
 * drops when the turn does.
 */
export function ConversationBar({
  conversation,
  speaking,
  onEnd,
}: {
  conversation: SpokenConversation;
  /** Dear Steven's voice is playing. */
  speaking: boolean;
  onEnd: () => void;
}) {
  const { t } = useI18n();
  const c = t.conversation;
  const { state } = conversation;
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => primary.current?.focus(), []);

  const shown: Shown =
    state.phase === 'his'
      ? speaking
        ? 'speaking'
        : 'thinking'
      : state.phase === 'paused'
        ? 'paused'
        : 'yours';
  const words = state.phase === 'yours' ? state.words : '';

  const status = { yours: c.yours, thinking: c.thinking, speaking: c.speaking, paused: c.paused }[
    shown
  ];
  const hint =
    shown === 'yours'
      ? words
        ? words.length > 160
          ? `…${words.slice(-160)}`
          : words
        : c.listeningHint
      : shown === 'thinking'
        ? c.thinkingHint
        : shown === 'speaking'
          ? c.speakingHint
          : state.phase === 'paused' && state.reason === 'idle'
            ? c.pausedIdle(Math.round(TURN_TIMING.talk.idleMs / 1000))
            : state.phase === 'paused' && state.reason === 'hidden'
              ? c.pausedHidden
              : c.pausedFailed;
  const announce = {
    yours: c.announce.yours,
    thinking: c.announce.thinking,
    speaking: c.announce.speaking,
    paused: c.announce.paused,
  }[shown];

  const action =
    shown === 'paused'
      ? { label: c.resume, run: conversation.resume, ready: true }
      : shown === 'yours'
        ? { label: c.send, run: conversation.finishTurn, ready: words.length > 0 }
        : { label: c.interrupt, run: conversation.interrupt, ready: true };

  return (
    <section
      aria-label={c.label}
      className="composer-shell w-full rounded-[var(--radius-field)] border border-ink-3 bg-ink-2 px-3 py-3 text-left shadow-[0_24px_60px_-28px_rgb(0_0_0/0.85)] sm:px-4"
      data-testid="conversation-bar"
      data-turn={shown}
    >
      <p role="status" className="sr-only">
        {announce}
      </p>
      {/* On a phone the actions take their own row, so the line above them is never cut short. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <Orb shown={shown} level={conversation.level} />
        <div className="min-w-0 flex-1 basis-48">
          <p
            aria-hidden="true"
            className={`font-mono text-[10.5px] tracking-[0.16em] uppercase ${shown === 'paused' ? 'text-steel' : 'text-ember-1'}`}
          >
            {status}
          </p>
          <p
            className={`mt-0.5 text-[14.5px] leading-snug text-pretty ${words ? 'line-clamp-2 text-ivory-0' : 'text-ivory-2'}`}
            data-testid="conversation-words"
          >
            {hint}
          </p>
        </div>
        <div className="ml-auto flex flex-none items-center gap-1.5">
          <PrimaryButton
            ref={primary}
            label={action.label}
            ready={action.ready}
            onClick={() => (action.ready ? action.run() : undefined)}
          />
          <button
            type="button"
            onClick={onEnd}
            className="inline-flex h-9 items-center rounded-full px-3 text-[13px] text-ivory-2 transition-colors hover:bg-ink-3 hover:text-ivory-0"
          >
            {c.end}
          </button>
        </div>
      </div>
    </section>
  );
}

const PrimaryButton = forwardRef<
  HTMLButtonElement,
  { label: string; ready: boolean; onClick: () => void }
>(function PrimaryButton({ label, ready, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-disabled={!ready}
      className={`inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] whitespace-nowrap transition-colors ${ready ? 'border-ivory-1/70 text-ivory-0 hover:bg-ivory-0 hover:text-ink-0' : 'border-ink-3 text-ivory-2'}`}
    >
      {label}
    </button>
  );
});

/** Who has the turn, at a glance: an ember ring that moves with your voice, his voice, or rest. */
function Orb({ shown, level }: { shown: Shown; level: { current: number } }) {
  const ring = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (shown !== 'yours' || reduce) return;
    let frame = 0;
    const draw = () => {
      ring.current?.style.setProperty('--level', String(level.current));
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [shown, level, reduce]);

  const icon =
    shown === 'paused' ? MicOff01Icon : shown === 'speaking' ? VolumeHighIcon : Mic01Icon;
  return (
    <span aria-hidden="true" className="relative grid h-11 w-11 flex-none place-items-center">
      <span
        ref={ring}
        className={`absolute inset-0 rounded-full border ${
          shown === 'paused'
            ? 'border-steel/60'
            : shown === 'speaking'
              ? 'border-ember-0 bg-ember-tint animate-[ds-breathe_1.6s_ease-in-out_infinite] motion-reduce:animate-none'
              : 'border-ember-0/80'
        }`}
        style={
          shown === 'yours' && !reduce
            ? {
                transform: 'scale(calc(1 + var(--level, 0) * 0.35))',
                transition: 'transform 80ms linear',
              }
            : undefined
        }
      />
      {shown === 'thinking' ? (
        <span className="flex items-center gap-1">
          {[0, 180, 360].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 rounded-full bg-ember-1 animate-[ds-breathe_1.2s_ease-in-out_infinite] motion-reduce:animate-none"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      ) : (
        <HugeiconsIcon
          icon={icon}
          size={18}
          strokeWidth={1.8}
          className={shown === 'paused' ? 'text-steel' : 'text-ember-1'}
        />
      )}
    </span>
  );
}

/** Starts a spoken conversation, in the composer where the mic would be; not while one is answered. */
export const StartTalking = forwardRef<
  HTMLButtonElement,
  { onStart: () => void; disabled: boolean }
>(function StartTalking({ onStart, disabled }, ref) {
  const { t } = useI18n();
  return (
    <button
      ref={ref}
      type="button"
      onClick={onStart}
      disabled={disabled}
      aria-label={t.conversation.start}
      title={t.conversation.start}
      className="grid h-9 w-9 flex-none place-items-center rounded-full bg-ink-3 text-ivory-1 transition-colors hover:bg-ink-4 hover:text-ivory-0 disabled:opacity-50"
    >
      <HugeiconsIcon icon={Mic01Icon} size={17} strokeWidth={1.8} />
    </button>
  );
});
