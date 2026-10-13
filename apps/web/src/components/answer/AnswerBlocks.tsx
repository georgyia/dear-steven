'use client';

import type { Citation, ResolvedBlock, ResolvedSegment } from '@dear-steven/core/schema';
import { Fragment } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { CitationChip } from './CitationChip';
import { PullQuote } from './PullQuote';
import { Reveal } from './Reveal';

interface BlocksProps {
  blocks: ResolvedBlock[];
  citations: Record<string, Citation>;
  /** The answer's language, once known: its prose is marked with it for screen readers. */
  language?: string;
  activeCitationId: string | null;
  onOpenCitation: (citationId: string) => void;
  /** `talk` (P7-05): spoken-style lines with their chips, no pull quote or takeaway panel. */
  variant?: 'answer' | 'talk';
}

/**
 * Renders validated answer blocks. Synthesis is set a shade softer than evidence-backed prose, so
 * the reader can tell interpretation from sourced statement without reading a legend.
 */
export function AnswerBlocks({
  blocks,
  citations,
  language,
  activeCitationId,
  onOpenCitation,
  variant = 'answer',
}: BlocksProps) {
  return (
    <div className={`flex flex-col ${variant === 'talk' ? 'gap-3' : 'gap-6'}`}>
      {blocks.map((block, i) =>
        block ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: blocks are append-only and positional
          <Reveal key={i}>
            <Block
              block={block}
              citations={citations}
              language={language}
              activeCitationId={activeCitationId}
              onOpenCitation={onOpenCitation}
              variant={variant}
            />
          </Reveal>
        ) : null,
      )}
    </div>
  );
}

function Block({
  block,
  citations,
  language,
  activeCitationId,
  onOpenCitation,
  variant,
}: Omit<BlocksProps, 'blocks'> & { block: ResolvedBlock }) {
  const { t } = useI18n();
  const talk = variant === 'talk';
  if (block.kind === 'quote') {
    const citation = citations[block.citationId];
    if (!citation) return null;
    if (talk) {
      return (
        <p className="font-display text-[18px] leading-[1.5] text-ivory-0 italic sm:text-[19px]">
          <span lang="en">“{block.text}”</span>
          <CitationChip
            citation={citation}
            active={activeCitationId === citation.id}
            onOpen={onOpenCitation}
          />
          {block.translation ? (
            <span lang={language} className="mt-1 block text-[14px] text-ivory-2 not-italic">
              {block.translation}
            </span>
          ) : null}
        </p>
      );
    }
    return (
      <PullQuote
        citation={citation}
        text={block.text}
        translation={block.translation}
        lead={block.lead}
        active={activeCitationId === citation.id}
        onOpen={onOpenCitation}
      />
    );
  }

  const prose = (
    <p
      lang={language}
      className={
        talk
          ? 'font-display text-[19px] leading-[1.5] text-pretty sm:text-[21px]'
          : 'text-[17px] leading-[1.7] text-pretty sm:text-[18px]'
      }
    >
      {block.segments.map((segment, j) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: segments are fixed once a block is validated
        <Fragment key={j}>
          {j > 0 ? ' ' : null}
          <Segment
            segment={segment}
            citations={citations}
            activeCitationId={activeCitationId}
            onOpenCitation={onOpenCitation}
          />
        </Fragment>
      ))}
    </p>
  );

  if (block.kind === 'takeaway' && !talk) {
    return (
      <aside className="relative rounded-[var(--radius-card)] border border-ink-3 bg-[linear-gradient(180deg,rgb(26_23_20/0.9),rgb(18_16_14/0.6))] px-5 pt-4 pb-5 sm:px-6">
        <p className="mb-2 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-ember-0 uppercase">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ember-0" />
          {t.answer.takeaway}
        </p>
        {prose}
      </aside>
    );
  }
  return prose;
}

function Segment({
  segment,
  citations,
  activeCitationId,
  onOpenCitation,
}: Omit<BlocksProps, 'blocks'> & { segment: ResolvedSegment }) {
  const resolved = segment.citationIds
    .map((id) => citations[id])
    .filter((c): c is Citation => Boolean(c));
  const isSynthesis = segment.attribution === 'synthesis' || resolved.length === 0;
  return (
    <span
      data-attribution={segment.attribution}
      className={isSynthesis ? 'text-ivory-1' : 'text-ivory-0'}
    >
      {segment.text}
      {resolved.map((c) => (
        <CitationChip
          key={c.id}
          citation={c}
          active={activeCitationId === c.id}
          onOpen={onOpenCitation}
        />
      ))}
    </span>
  );
}
