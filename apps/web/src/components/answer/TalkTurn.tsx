'use client';

import type { ReactNode } from 'react';
import { ThinkingDots } from '@/components/ui/ThinkingDots';
import { useI18n } from '@/i18n/I18nProvider';
import type { Turn } from '@/lib/conversation';
import { AnswerBlocks } from './AnswerBlocks';
import { ListenButton } from './SpokenControls';
import { TurnProblems } from './TurnView';

interface TalkTurnProps {
  turn: Turn;
  activeCitationId: string | null;
  onOpenCitation: (turnId: string, citationId: string) => void;
  onRetry: (question: string) => void;
}

/**
 * One exchange in talk mode (P7-05), set like a transcript rather than chat bubbles: who is
 * speaking, then the line. Steven's line keeps its citation chips; the full answer furniture (pull
 * quotes, takeaway, conversation cards) stays with Ask.
 */
export function TalkTurn({ turn, activeCitationId, onOpenCitation, onRetry }: TalkTurnProps) {
  const { t } = useI18n();
  const headingId = `q-${turn.id}`;
  const demo = turn.final?.demo ?? Object.values(turn.citations).some((c) => c.episode.demo);
  const waiting = turn.status === 'streaming' && !turn.blocks.some(Boolean);

  return (
    <article
      id={`turn-${turn.id}`}
      aria-labelledby={headingId}
      className="flex scroll-mt-28 flex-col gap-4"
    >
      <Line who={t.talk.you}>
        <h2 id={headingId} className="text-[16.5px] leading-relaxed text-pretty text-ivory-1">
          {turn.question}
        </h2>
      </Line>
      <Line who={t.talk.steven} steven>
        {waiting ? (
          <ThinkingDots label={t.talk.thinking} />
        ) : (
          <AnswerBlocks
            variant="talk"
            blocks={turn.blocks}
            citations={turn.citations}
            language={turn.final?.language}
            activeCitationId={activeCitationId}
            onOpenCitation={(citationId) => onOpenCitation(turn.id, citationId)}
          />
        )}
        {turn.final && turn.final.caveats.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1 text-[13px] leading-relaxed text-ivory-2">
            {turn.final.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : null}
        {turn.final ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <ListenButton
              turnId={turn.id}
              spoken={turn.final.spoken}
              language={turn.final.language}
            />
            {demo ? (
              <span className="font-mono text-[10.5px] tracking-[0.14em] text-ember-0 uppercase">
                {t.turn.demoTag}
              </span>
            ) : null}
          </div>
        ) : null}
        <TurnProblems turn={turn} onRetry={onRetry} />
      </Line>
    </article>
  );
}

/** A speaker and their line: stacked on a phone, side by side from `sm`. */
function Line({ who, steven, children }: { who: string; steven?: boolean; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[6.75rem_minmax(0,1fr)] sm:gap-4">
      <p
        className={`font-mono text-[10.5px] tracking-[0.16em] uppercase sm:pt-[0.55rem] ${steven ? 'text-ivory-1' : 'text-steel'}`}
      >
        {who}
      </p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
