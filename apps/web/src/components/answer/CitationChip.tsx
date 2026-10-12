'use client';

import { formatTimestamp, spokenTimestamp } from '@dear-steven/core/format';
import type { Citation } from '@dear-steven/core/schema';
import WarmTooltip from '@/components/vendor/react-bits/WarmTooltip';
import { useI18n } from '@/i18n/I18nProvider';
import { initials, speakerLabel } from './speaker';

interface CitationChipProps {
  citation: Citation;
  active: boolean;
  onOpen: (citationId: string) => void;
}

const preview = (text: string) => (text.length > 120 ? `${text.slice(0, 118).trimEnd()}…` : text);

/**
 * The inline evidence chip. Colour carries meaning (docs/DESIGN.md §2): ember = verified host,
 * ivory with an initial = verified guest, dashed steel = real passage, speaker unverified.
 */
export function CitationChip({ citation, active, onOpen }: CitationChipProps) {
  const { t, locale } = useI18n();
  const who = speakerLabel(citation, t.speaker);
  const time = formatTimestamp(citation.startMs);
  const tone =
    citation.speaker === 'host'
      ? 'border-transparent bg-ember-tint text-ember-1 hover:bg-[rgb(227_168_87/0.24)]'
      : citation.speaker === 'guest'
        ? 'border-transparent bg-ink-3 text-ivory-0 hover:bg-ink-4'
        : 'border-dashed border-steel/60 bg-transparent text-steel hover:border-steel hover:text-ivory-1';

  return (
    <WarmTooltip
      wrap
      side="top"
      surfaceColor="var(--ivory-0)"
      inkColor="var(--ink-0)"
      size="md"
      content={
        <span className="flex flex-col gap-1">
          <span className="font-mono text-[10.5px] tracking-[0.08em] uppercase opacity-70">
            {who.long}
          </span>
          <span className="font-normal" lang="en">
            “{preview(citation.excerpt)}”
          </span>
        </span>
      }
    >
      <button
        type="button"
        data-citation={citation.id}
        data-speaker={citation.speaker}
        aria-pressed={active}
        aria-label={t.chip.label(
          who.short,
          time,
          t.chip[citation.speaker],
          spokenTimestamp(citation.startMs, locale),
        )}
        onClick={() => onOpen(citation.id)}
        className={`mx-0.5 inline-flex h-[22px] translate-y-[-1px] items-center gap-1.5 rounded-full border px-2 align-middle font-mono text-[11.5px] leading-none whitespace-nowrap transition-[background-color,color,border-color,box-shadow] duration-150 ${tone} ${active ? 'shadow-[0_0_0_1.5px_var(--ember-0)]' : ''}`}
      >
        {citation.speaker === 'guest' ? (
          <span
            aria-hidden="true"
            className="-ml-1 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-ivory-0 px-[3px] text-[8.5px] font-semibold text-ink-0"
          >
            {initials(who.short)}
          </span>
        ) : null}
        {citation.speaker === 'host' ? (
          <span aria-hidden="true" className="-ml-0.5 h-1.5 w-1.5 rounded-full bg-ember-0" />
        ) : null}
        <span className="max-w-[11rem] truncate">{who.short}</span>
        <span aria-hidden="true" className="opacity-50">
          ·
        </span>
        <span className="tabular">{time}</span>
      </button>
    </WarmTooltip>
  );
}
