'use client';

import { useState } from 'react';
import { brand } from '@/brand';
import type { Turn } from '@/lib/conversation';
import { AnswerBlocks } from './AnswerBlocks';
import { EpisodeCards } from './EpisodeCards';
import { type AnswerView, SpokenControls } from './SpokenControls';
import { ThoughtTrace } from './ThoughtTrace';

interface TurnViewProps {
  turn: Turn;
  activeCitationId: string | null;
  onOpenCitation: (turnId: string, citationId: string) => void;
  onRetry: (question: string) => void;
}

const ERROR_COPY = {
  network: brand.copy.errors.network,
  rate_limited: brand.copy.errors.rateLimited,
  upstream: brand.copy.errors.upstream,
  not_configured: brand.copy.errors.notConfigured,
  bad_request: brand.copy.errors.generic,
  internal: brand.copy.errors.generic,
  locked: brand.copy.errors.locked,
} as const;

/** One exchange: the question as an editorial heading, the thinking, then the answer. */
export function TurnView({ turn, activeCitationId, onOpenCitation, onRetry }: TurnViewProps) {
  const open = (citationId: string) => onOpenCitation(turn.id, citationId);
  const demo = turn.final?.demo ?? Object.values(turn.citations).some((c) => c.episode.demo);
  const headingId = `q-${turn.id}`;
  const [view, setView] = useState<AnswerView>('written');
  const spoken = turn.final?.spoken ?? '';

  return (
    <article id={`turn-${turn.id}`} aria-labelledby={headingId} className="scroll-mt-28">
      {demo ? (
        <p className="mb-3 font-mono text-[10.5px] tracking-[0.14em] text-ember-0 uppercase">
          Demo fixture · not AI-generated or source-verified
        </p>
      ) : null}
      <h2
        id={headingId}
        className="font-display text-[27px] leading-[1.18] text-balance text-ivory-0 sm:text-[34px]"
        style={{ fontVariationSettings: '"opsz" 96' }}
      >
        {turn.question}
      </h2>

      <div className="mt-4">
        <ThoughtTrace turn={turn} />
      </div>

      <div className="mt-6">
        {view === 'spoken' && spoken ? (
          <div>
            <p className="mb-3 font-mono text-[11px] tracking-[0.16em] text-steel uppercase">
              What I’d say out loud
            </p>
            <p className="font-display text-[21px] leading-[1.55] text-ivory-0 italic sm:text-[23px]">
              {spoken}
            </p>
            <p className="mt-3 text-[13px] text-ivory-2">The written answer carries the sources.</p>
          </div>
        ) : (
          <AnswerBlocks
            blocks={turn.blocks}
            citations={turn.citations}
            activeCitationId={activeCitationId}
            onOpenCitation={open}
          />
        )}
        {turn.status === 'streaming' && turn.writingIndex !== null ? <WritingPlaceholder /> : null}
      </div>

      {turn.final && spoken ? (
        <SpokenControls turnId={turn.id} spoken={spoken} view={view} onView={setView} />
      ) : null}

      {turn.final && turn.final.caveats.length > 0 ? (
        <ul className="mt-6 flex flex-col gap-1.5 border-l border-ink-3 pl-4 text-[14px] leading-relaxed text-ivory-2">
          {turn.final.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}

      {turn.final ? (
        <div className="mt-8">
          <EpisodeCards episodes={turn.final.episodes} citations={turn.citations} onOpen={open} />
        </div>
      ) : null}

      {turn.status === 'stopped' ? (
        <p className="mt-6 text-[14px] text-ivory-2">You stopped me there. Ask again any time.</p>
      ) : null}

      {turn.status === 'error' && turn.error ? (
        <div
          role="alert"
          className="mt-6 flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-oxblood/50 bg-oxblood-tint px-4 py-3 text-[15px] text-oxblood-1"
        >
          <span>
            {ERROR_COPY[turn.error.code]}
            {(turn.error.code === 'not_configured' || turn.error.code === 'upstream') &&
            turn.error.message ? (
              <span className="mt-0.5 block text-[13px] text-ivory-2">{turn.error.message}</span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => onRetry(turn.question)}
            className="rounded-full border border-oxblood-1/50 px-3 py-1 text-[13px] text-ivory-0 transition-colors hover:bg-oxblood/30"
          >
            Try again
          </button>
        </div>
      ) : null}

      <p className="sr-only" role="status">
        {turn.status === 'done' ? 'Answer complete.' : ''}
      </p>
    </article>
  );
}

function WritingPlaceholder() {
  return (
    <div aria-hidden="true" className="mt-6 flex flex-col gap-3">
      {['92%', '78%', '54%'].map((w) => (
        <span
          key={w}
          className="block h-3 rounded-full bg-[linear-gradient(90deg,var(--ink-2)_0%,var(--ink-3)_40%,var(--ink-2)_80%)] bg-[length:200%_100%] animate-[ds-shimmer_1.6s_linear_infinite] motion-reduce:animate-none"
          style={{ width: w }}
        />
      ))}
    </div>
  );
}
