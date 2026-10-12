'use client';

import { formatTimestamp } from '@dear-steven/core/format';
import type { Citation } from '@dear-steven/core/schema';
import { useI18n } from '@/i18n/I18nProvider';
import { speakerLabel } from './speaker';

interface PullQuoteProps {
  citation: Citation;
  /** The stored transcript span — never model text. */
  text: string;
  /** Model-written, in the answer's language (P6-01): labelled, and never inside the marks. */
  translation: string | null;
  lead: string | null;
  active: boolean;
  onOpen: (citationId: string) => void;
}

/**
 * The memorable moment: a verbatim line set large in Fraunces italic, with an ember hairline that
 * draws down beside it. The attribution says plainly who said it — or that we don't know.
 */
export function PullQuote({ citation, text, translation, lead, active, onOpen }: PullQuoteProps) {
  const { t } = useI18n();
  const who = speakerLabel(citation, t.speaker);
  const attribution =
    citation.speaker === 'unverified'
      ? t.answer.fromMyConversation(who.short)
      : citation.speaker === 'host'
        ? t.answer.onTheShow(who.short)
        : who.short;

  return (
    <figure className="relative my-2 pl-6 sm:pl-8">
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-0 w-[2px] origin-top rounded-full bg-[linear-gradient(180deg,var(--ember-1),var(--ember-0)_60%,transparent)] animate-[ds-hairline-grow_900ms_var(--ease-out)_both] motion-reduce:animate-none"
      />
      {lead ? <p className="mb-3 text-[15px] text-ivory-2">{lead}</p> : null}
      <blockquote>
        <button
          type="button"
          onClick={() => onOpen(citation.id)}
          aria-pressed={active}
          className={`group block w-full text-left font-display text-[24px] leading-[1.35] text-ivory-0 italic transition-colors sm:text-[28px] ${active ? 'text-ember-1' : 'hover:text-ember-1'}`}
          style={{ fontVariationSettings: '"opsz" 72, "SOFT" 50' }}
        >
          <span aria-hidden="true" className="mr-0.5 text-ember-0">
            “
          </span>
          <span lang="en">{text}</span>
          <span aria-hidden="true" className="ml-0.5 text-ember-0">
            ”
          </span>
          <span className="sr-only">{t.answer.openSource}</span>
        </button>
      </blockquote>
      {translation ? (
        <p className="mt-3 text-[15px] leading-relaxed text-ivory-1">
          <span className="mr-2 font-mono text-[11px] tracking-[0.16em] text-steel uppercase">
            {t.answer.translation}
          </span>
          {translation}
        </p>
      ) : null}
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-steel">
        <span className="text-ivory-1">— {attribution}</span>
        <span className="tabular">{formatTimestamp(citation.startMs)}</span>
        <span>{t.answer.verbatim}</span>
        {citation.speaker === 'unverified' ? (
          <span className="rounded-full border border-dashed border-steel/60 px-2 py-0.5 text-[10.5px]">
            {t.answer.notVerified}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
