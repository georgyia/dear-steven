'use client';

import type { Citation, ResolvedBlock, ResolvedSegment } from '@dear-steven/core/schema';
import { Fragment } from 'react';
import { CitationChip } from './CitationChip';
import { PullQuote } from './PullQuote';
import { Reveal } from './Reveal';

interface BlocksProps {
  blocks: ResolvedBlock[];
  citations: Record<string, Citation>;
  activeCitationId: string | null;
  onOpenCitation: (citationId: string) => void;
}

/**
 * Renders validated answer blocks. Synthesis is set a shade softer than evidence-backed prose, so
 * the reader can tell interpretation from sourced statement without reading a legend.
 */
export function AnswerBlocks({ blocks, citations, activeCitationId, onOpenCitation }: BlocksProps) {
  return (
    <div className="flex flex-col gap-6">
      {blocks.map((block, i) =>
        block ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: blocks are append-only and positional
          <Reveal key={i}>
            <Block
              block={block}
              citations={citations}
              activeCitationId={activeCitationId}
              onOpenCitation={onOpenCitation}
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
  activeCitationId,
  onOpenCitation,
}: Omit<BlocksProps, 'blocks'> & { block: ResolvedBlock }) {
  if (block.kind === 'quote') {
    const citation = citations[block.citationId];
    if (!citation) return null;
    return (
      <PullQuote
        citation={citation}
        text={block.text}
        lead={block.lead}
        active={activeCitationId === citation.id}
        onOpen={onOpenCitation}
      />
    );
  }

  const prose = (
    <p className="text-[17px] leading-[1.7] text-pretty sm:text-[18px]">
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

  if (block.kind === 'takeaway') {
    return (
      <aside className="relative rounded-[var(--radius-card)] border border-ink-3 bg-[linear-gradient(180deg,rgb(26_23_20/0.9),rgb(18_16_14/0.6))] px-5 pt-4 pb-5 sm:px-6">
        <p className="mb-2 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-ember-0 uppercase">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ember-0" />
          If I were you
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
