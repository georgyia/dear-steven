'use client';

import { formatDate, formatMoment, formatTimestamp } from '@dear-steven/core/format';
import type { PassageCitation, RelatedMoments as Related } from '@dear-steven/core/schema';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useId, useState } from 'react';
import { speakerLabel } from '@/components/answer/speaker';
import { YouTubeLink } from '@/components/ui/YouTubeLink';
import { useI18n } from '@/i18n/I18nProvider';
import { fetchRelated } from '@/lib/api';

const cache = new Map<string, Related>();

function useRelated(passageId: string): Related | null {
  const [state, setState] = useState<{ id: string; data: Related | null }>(() => ({
    id: passageId,
    data: cache.get(passageId) ?? null,
  }));
  useEffect(() => {
    const hit = cache.get(passageId);
    if (hit) {
      setState({ id: passageId, data: hit });
      return;
    }
    const ctrl = new AbortController();
    fetchRelated(passageId, ctrl.signal)
      .then((data) => {
        cache.set(passageId, data);
        setState({ id: passageId, data });
      })
      // Related moments are an extra: on failure the section simply stays hidden.
      .catch(() => {});
    return () => ctrl.abort();
  }, [passageId]);
  return state.id === passageId ? state.data : null;
}

/**
 * "Related moments" (P5-04): passages from other conversations close to the cited one. Styled
 * apart from citations — no ember, a dashed edge — and labelled as related, never as support.
 * Hidden while loading, on error, and when there is nothing (e.g. no embeddings yet).
 */
export function RelatedMoments({ passageId }: { passageId: string }) {
  const related = useRelated(passageId);
  const headingId = useId();
  const { related: copy } = useI18n().t;
  if (!related || related.passages.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="border-t border-ink-3 pt-5">
      <h3 id={headingId} className="font-mono text-[10.5px] tracking-[0.14em] text-steel uppercase">
        {copy.heading}
      </h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ivory-2">{copy.note}</p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {related.passages.map((p) => (
          <RelatedItem key={p.passageId} passage={p} />
        ))}
      </ul>
    </section>
  );
}

function RelatedItem({ passage: p }: { passage: PassageCitation }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { t, locale } = useI18n();
  const who = speakerLabel(p, t.speaker);
  return (
    <li className="rounded-[var(--radius-card)] border border-dashed border-ink-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 rounded-[var(--radius-card)] px-4 pt-3 pb-2 text-left transition-colors hover:bg-ink-2/60"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[11px] text-steel">
            {formatDate(p.episode.publishedAt, locale)} · {formatTimestamp(p.startMs)} ·{' '}
            {p.speaker === 'unverified' ? t.answer.notVerified : who.short}
          </span>
          <span
            lang="en"
            className="mt-1 block font-display text-[15.5px] leading-snug text-ivory-0"
          >
            {p.episode.title}
          </span>
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={16}
          strokeWidth={2}
          aria-hidden="true"
          className={`mt-0.5 flex-none text-ivory-2 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div id={panelId} className="px-4 pb-3.5">
        <p lang="en" className="text-[14px] leading-relaxed text-ivory-1">
          {open ? p.text : p.excerpt}
        </p>
        {open ? (
          <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-steel">
            <span>
              {p.speaker === 'unverified'
                ? t.inspector.fromConversation(who.short)
                : t.inspector.saidBy(who.short)}{' '}
              · {t.inspector.inPodcast(formatTimestamp(p.startMs))}
            </span>
            {p.youtubeUrl ? (
              <YouTubeLink href={p.youtubeUrl} variant="inline">
                {p.timestamp.state === 'unknown'
                  ? t.youtube.watch
                  : t.youtube.watchFrom(formatMoment(p.timestamp.ms, p.timestamp.state))}
              </YouTubeLink>
            ) : null}
          </p>
        ) : null}
      </div>
    </li>
  );
}
