'use client';

import { formatDate, formatTimestamp } from '@dear-steven/core/format';
import type { Citation, ConversationSummaryView, EpisodeSummary } from '@dear-steven/core/schema';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { fetchSummary } from '@/lib/api';

interface SummaryViewProps {
  episode: EpisodeSummary;
  onBack: () => void;
  /** Opens the evidence drawer at `citations[index]`, stepping through all of them. */
  onOpen: (citations: Citation[], index: number) => void;
}

type Load =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; view: ConversationSummaryView };

/**
 * A conversation's summary in the explorer (P8-04): what it's about (machine-written, and said so),
 * its topics, its most interesting moments and its best questions and answers. Every quote is the
 * stored transcript, in English; every item opens the evidence drawer at the moment it starts.
 */
export function SummaryView({ episode, onBack, onOpen }: SummaryViewProps) {
  const { t, locale } = useI18n();
  const copy = t.explorer.summary;
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoad({ state: 'loading' });
    fetchSummary(episode.id, ctrl.signal)
      .then((view) => setLoad({ state: 'ready', view }))
      .catch(() => !ctrl.signal.aborted && setLoad({ state: 'error' }));
    return () => ctrl.abort();
  }, [episode.id]);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const summary = load.state === 'ready' ? load.view.summary : null;
  // The drawer steps through every item in reading order.
  const all: Citation[] = summary
    ? [
        ...summary.topics.map((x) => x.citation),
        ...summary.moments.map((x) => x.citation),
        ...summary.exchanges.flatMap((x) => [x.question, x.answer]),
      ]
    : [];
  const open = (c: Citation) => onOpen(all, all.indexOf(c));

  return (
    <section aria-labelledby="summary-title" className="flex flex-col gap-7">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] text-ivory-2 transition-colors hover:bg-ink-2 hover:text-ivory-0"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={2} />
          {copy.back}
        </button>
        <h3
          id="summary-title"
          ref={heading}
          tabIndex={-1}
          lang="en"
          className="mt-3 font-display text-[22px] leading-snug text-ivory-0 outline-none"
        >
          {episode.title}
        </h3>
        <p className="mt-1 font-mono text-[11.5px] text-steel">
          {formatDate(episode.publishedAt, locale)}
          {episode.guestNames.length ? `, ${episode.guestNames.join(', ')}` : ''}
        </p>
      </div>

      {load.state === 'loading' ? (
        <p className="text-[14px] text-ivory-2" role="status">
          {copy.loading}
        </p>
      ) : null}
      {load.state === 'error' ? (
        <p className="text-[14px] text-oxblood-1">{copy.loadError}</p>
      ) : null}
      {load.state === 'ready' && !summary ? (
        <p className="text-[14.5px] leading-relaxed text-ivory-1">{copy.none}</p>
      ) : null}

      {summary ? (
        <>
          {summary.about ? (
            <div>
              <SectionHeading label={copy.about} tag={copy.machine} />
              <p lang="en" className="mt-2 text-[15.5px] leading-relaxed text-ivory-1">
                {summary.about}
              </p>
            </div>
          ) : null}

          {summary.topics.length ? (
            <div>
              <SectionHeading label={copy.topics} tag={copy.machine} />
              <ol className="mt-2 flex flex-col">
                {summary.topics.map(({ title, citation }) => (
                  <li key={citation.id}>
                    <button
                      type="button"
                      onClick={() => open(citation)}
                      aria-label={`${title}. ${copy.at(formatTimestamp(citation.startMs))}`}
                      className="group flex w-full items-baseline gap-4 rounded-[var(--radius-field)] px-2 py-1.5 text-left transition-colors hover:bg-ink-2"
                    >
                      <span className="w-14 flex-none font-mono text-[12px] text-steel tabular group-hover:text-ember-1">
                        {formatTimestamp(citation.startMs)}
                      </span>
                      <span lang="en" className="text-[15px] text-ivory-0">
                        {title}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {summary.moments.length ? (
            <div>
              <SectionHeading
                label={copy.moments}
                tag={summary.speakers === 'unverified' ? copy.unverified : undefined}
                dashed
              />
              <ul className="mt-3 flex flex-col gap-6">
                {summary.moments.map(({ label, citation }) => (
                  <li key={citation.id}>
                    <Quote citation={citation} label={label} labelInEnglish onOpen={open} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {summary.exchanges.length ? (
            <div>
              <SectionHeading
                label={copy.exchanges}
                tag={summary.speakers === 'unverified' ? copy.unverified : undefined}
                dashed
              />
              <ul className="mt-3 flex flex-col gap-6">
                {summary.exchanges.map(({ question, answer }) => (
                  <li key={question.id} className="flex flex-col gap-3">
                    <Quote citation={question} label={copy.question} onOpen={open} small />
                    <Quote citation={answer} label={copy.answer} onOpen={open} small />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-[12.5px] text-steel">{copy.original}</p>
        </>
      ) : null}
    </section>
  );
}

function SectionHeading({ label, tag, dashed }: { label: string; tag?: string; dashed?: boolean }) {
  return (
    <h4 className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-steel uppercase">
      {label}
      {tag ? (
        <span
          className={`rounded-full px-2 py-0.5 text-[10.5px] tracking-normal normal-case ${dashed ? 'border border-dashed border-steel/60' : 'bg-ink-3 text-ivory-2'}`}
        >
          {tag}
        </span>
      ) : null}
    </h4>
  );
}

/** A quoted span, set like the pull quotes: the ember hairline, the display serif, its time. */
function Quote({
  citation,
  label,
  onOpen,
  small = false,
  labelInEnglish = false,
}: {
  citation: Citation;
  label: string;
  onOpen: (c: Citation) => void;
  small?: boolean;
  /** A machine-written label, in English like the summary; otherwise interface copy. */
  labelInEnglish?: boolean;
}) {
  const { t } = useI18n();
  const time = formatTimestamp(citation.startMs);
  return (
    <figure className="relative pl-5">
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-0 w-[2px] rounded-full bg-[linear-gradient(180deg,var(--ember-1),var(--ember-0)_60%,transparent)]"
      />
      <figcaption
        lang={labelInEnglish ? 'en' : undefined}
        className="mb-1.5 text-[13px] text-ivory-2"
      >
        {label}
      </figcaption>
      <blockquote>
        <button
          type="button"
          onClick={() => onOpen(citation)}
          className={`block w-full text-left font-display text-ivory-0 italic transition-colors hover:text-ember-1 ${small ? 'text-[17px] leading-[1.45]' : 'text-[19px] leading-[1.4]'}`}
        >
          <span aria-hidden="true" className="mr-0.5 text-ember-0">
            “
          </span>
          <span lang="en">{citation.excerpt}</span>
          <span aria-hidden="true" className="ml-0.5 text-ember-0">
            ”
          </span>
          <span className="mt-1.5 block font-mono text-[11.5px] text-steel not-italic tabular">
            {time}
            <span className="sr-only"> {t.explorer.summary.at(time)}</span>
          </span>
        </button>
      </blockquote>
    </figure>
  );
}
