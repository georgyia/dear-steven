'use client';

import { motion } from 'motion/react';
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { AnswerBlocks } from '@/components/answer/AnswerBlocks';
import { ListenButton } from '@/components/answer/SpokenControls';
import { ThinkingDots } from '@/components/ui/ThinkingDots';
import GradualBlur from '@/components/vendor/react-bits/GradualBlur';
import { useI18n } from '@/i18n/I18nProvider';
import type { InterviewAction, InterviewState } from '@/lib/interview';

interface InterviewViewProps {
  state: InterviewState;
  dispatch: (action: InterviewAction) => void;
  header: ReactNode;
  /** The mode switch, always; with the answer composer while a question is open. */
  dock: ReactNode;
  demo: boolean;
  onBack: () => void;
}

const button =
  'rounded-full border border-ink-3 px-3.5 py-1.5 text-[13px] text-ivory-1 transition-colors hover:border-ink-4 hover:text-ivory-0 disabled:opacity-50';
const primary =
  'rounded-full bg-ember-0 px-4 py-2 text-[14px] font-medium text-ink-0 transition-colors hover:bg-ember-1';
const field =
  'w-full rounded-full border border-ink-3 bg-ink-1 px-4 py-2.5 text-[15px] text-ivory-0 placeholder:text-steel focus:border-ember-0/60 focus:outline-none';
const eyebrow = 'font-mono text-[11px] tracking-[0.16em] text-steel uppercase';
const display = { fontVariationSettings: '"opsz" 96' };

/**
 * Interview mode (P7-06): Dear Steven asks, one question at a time, in the display serif; the
 * visitor answers in the composer, by typing or voice. At the end, "What I learned about you":
 * each line with the visitor's own words beneath it, quoted exactly.
 */
export function InterviewView({ state, dispatch, header, dock, demo, onBack }: InterviewViewProps) {
  const { t } = useI18n();
  const copy = t.interview;
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30">
        <div className="flex h-16 items-center justify-between gap-3 bg-[linear-gradient(180deg,var(--ink-0)_0%,rgb(10_9_8/0.82)_55%,transparent)] px-4 sm:px-6">
          {header}
        </div>
      </header>

      <main className="relative z-10">
        <section
          aria-label={copy.label}
          className="mx-auto flex min-h-dvh w-full max-w-[var(--column)] flex-col justify-center px-5 pt-28 pb-[calc(var(--composer-h)+14rem)] sm:px-6"
        >
          {state.phase === 'setup' ? <Setup dispatch={dispatch} demo={demo} /> : null}
          {state.phase === 'waiting' || state.phase === 'asking' || state.phase === 'error' ? (
            <Question state={state} dispatch={dispatch} />
          ) : null}
          {state.phase === 'learned' ? (
            <Learned state={state} dispatch={dispatch} onBack={onBack} />
          ) : null}
          {state.phase === 'ended' && state.ended ? (
            <div className="flex flex-col gap-6">
              <AnswerBlocks
                blocks={state.ended.blocks}
                citations={{}}
                activeCitationId={null}
                onOpenCitation={() => undefined}
              />
              <div>
                <button type="button" onClick={onBack} className={button}>
                  {copy.back}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[10rem] bg-[linear-gradient(0deg,var(--ink-0)_0%,rgb(10_9_8/0.86)_45%,transparent)]"
        />
        <GradualBlur
          position="bottom"
          height="10rem"
          strength={1.6}
          divCount={6}
          curve="bezier"
          zIndex={0}
        />
        <div className="relative z-10 mx-auto w-full max-w-[calc(var(--column)+2rem)] px-4 pb-[calc(env(safe-area-inset-bottom)+14px)]">
          <motion.div
            layoutId="composer"
            transition={{ type: 'spring', duration: 0.7, bounce: 0.12 }}
          >
            {dock}
          </motion.div>
        </div>
      </div>
    </>
  );
}

function Setup({ dispatch, demo }: Pick<InterviewViewProps, 'dispatch' | 'demo'>) {
  const { t } = useI18n();
  const copy = t.interview;
  const id = useId();
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const start = (event: FormEvent) => {
    event.preventDefault();
    dispatch({ type: 'start', setup: { name, about } });
  };
  return (
    <form onSubmit={start} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className={eyebrow}>{copy.eyebrow}</p>
        <h2
          className="font-display text-[30px] leading-[1.15] text-balance text-ivory-0 sm:text-[38px]"
          style={display}
        >
          {copy.title}
        </h2>
        <p className="max-w-[34rem] text-[16px] leading-relaxed text-ivory-1">{copy.intro}</p>
      </div>
      <div className="flex max-w-[30rem] flex-col gap-4">
        <label htmlFor={`${id}-name`} className="flex flex-col gap-1.5 text-[13.5px] text-ivory-1">
          <span>
            {copy.name} <span className="text-steel">({copy.optional})</span>
          </span>
          <input
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoComplete="given-name"
            className={field}
          />
        </label>
        <label htmlFor={`${id}-about`} className="flex flex-col gap-1.5 text-[13.5px] text-ivory-1">
          <span>
            {copy.about} <span className="text-steel">({copy.optional})</span>
          </span>
          <input
            id={`${id}-about`}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            maxLength={240}
            className={field}
          />
        </label>
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <button type="submit" className={primary}>
            {copy.start}
          </button>
        </div>
        <p className="text-[12.5px] leading-relaxed text-ivory-2">
          {demo ? copy.privacyDemo : copy.privacy}
        </p>
      </div>
    </form>
  );
}

function Question({ state, dispatch }: Pick<InterviewViewProps, 'state' | 'dispatch'>) {
  const { t } = useI18n();
  const copy = t.interview;
  const q = state.current;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const waiting = state.phase === 'waiting';
  const last = state.turns.at(-1);

  // Each new question is announced and takes focus's place in the reading order.
  useEffect(() => {
    if (q && state.phase === 'asking') headingRef.current?.focus({ preventScroll: true });
  }, [q, state.phase]);

  if (!q) {
    return (
      <div className="flex flex-col gap-4">
        <p className={eyebrow}>{copy.eyebrow}</p>
        {state.phase === 'error' ? (
          <Problem state={state} dispatch={dispatch} />
        ) : (
          <ThinkingDots className="h-8" label={copy.starting} />
        )}
      </div>
    );
  }
  const progress = Math.round(((q.index + 1) / q.total) * 100);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className={eyebrow}>{copy.progress(q.index + 1, q.total)}</p>
          {q.demo ? (
            <span className="font-mono text-[10.5px] tracking-[0.14em] text-ember-0 uppercase">
              {t.turn.demoTag}
            </span>
          ) : null}
        </div>
        <div
          role="progressbar"
          aria-label={copy.progress(q.index + 1, q.total)}
          aria-valuemin={1}
          aria-valuemax={q.total}
          aria-valuenow={q.index + 1}
          className="h-px w-full max-w-[16rem] bg-ink-3"
        >
          <div
            className="h-px bg-ember-0 transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {last?.answer && q.index === state.turns.length ? (
        <p className="max-w-[36rem] border-l border-ink-3 pl-4 text-[14px] leading-relaxed text-ivory-2">
          <span className="sr-only">{copy.lastAnswer}: </span>“{clip(last.answer, 180)}”
        </p>
      ) : null}

      <h2
        ref={headingRef}
        tabIndex={-1}
        lang={q.language}
        aria-live="polite"
        className={`font-display text-[27px] leading-[1.2] text-balance text-ivory-0 outline-none transition-opacity duration-300 sm:text-[34px] ${waiting ? 'opacity-40' : ''}`}
        style={display}
      >
        {q.question}
      </h2>

      {waiting ? <ThinkingDots className="h-8" label={t.talk.thinking} /> : null}
      {state.phase === 'error' ? <Problem state={state} dispatch={dispatch} /> : null}
      {state.phase === 'asking' ? (
        <div className="flex flex-wrap items-center gap-3">
          <ListenButton turnId={`interview-${q.index}`} spoken={q.question} language={q.language} />
          <button type="button" onClick={() => dispatch({ type: 'skip' })} className={button}>
            {copy.skip}
          </button>
          <button type="button" onClick={() => dispatch({ type: 'finish' })} className={button}>
            {copy.end}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Learned({
  state,
  dispatch,
  onBack,
}: Pick<InterviewViewProps, 'state' | 'dispatch' | 'onBack'>) {
  const { t } = useI18n();
  const copy = t.interview;
  const learned = state.learned;
  if (!learned) return null;
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className={eyebrow}>{copy.learnedEyebrow}</p>
          {learned.demo ? (
            <span className="font-mono text-[10.5px] tracking-[0.14em] text-ember-0 uppercase">
              {t.turn.demoTag}
            </span>
          ) : null}
        </div>
        <h2
          className="font-display text-[30px] leading-[1.15] text-ivory-0 sm:text-[38px]"
          style={display}
        >
          {copy.learnedTitle(state.setup.name ?? null)}
        </h2>
        {learned.lines.length ? (
          <p className="text-[13.5px] text-ivory-2">{copy.learnedNote}</p>
        ) : null}
      </div>

      {learned.lines.length ? (
        <ol className="flex flex-col gap-7">
          {learned.lines.map((line) => (
            <li key={`${line.turn}-${line.evidence}`} className="flex flex-col gap-2.5">
              <p
                lang={learned.language}
                className="font-display text-[21px] leading-[1.4] text-ivory-0"
                style={display}
              >
                {line.text}
              </p>
              <figure className="border-l border-ember-0/70 pl-4">
                <blockquote className="text-[15px] leading-relaxed text-ivory-1 italic">
                  “{line.evidence}”
                </blockquote>
                <figcaption className="mt-1 font-mono text-[11px] text-steel">
                  {copy.evidence(line.turn + 1)}
                </figcaption>
              </figure>
            </li>
          ))}
        </ol>
      ) : (
        <p className="max-w-[34rem] text-[16px] leading-relaxed text-ivory-1">
          {copy.learnedEmpty}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => dispatch({ type: 'reset' })} className={primary}>
          {copy.again}
        </button>
        <button type="button" onClick={onBack} className={button}>
          {copy.back}
        </button>
      </div>
    </div>
  );
}

function Problem({ state, dispatch }: Pick<InterviewViewProps, 'state' | 'dispatch'>) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-oxblood/50 bg-oxblood-tint px-4 py-3 text-[15px] text-oxblood-1"
    >
      <span>{state.error}</span>
      <button
        type="button"
        onClick={() => dispatch({ type: 'retry' })}
        className="rounded-full border border-oxblood-1/50 px-3 py-1 text-[13px] text-ivory-0 transition-colors hover:bg-oxblood/30"
      >
        {t.interview.retry}
      </button>
    </div>
  );
}

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
