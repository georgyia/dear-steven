'use client';

import { formatDate, isNewEpisode } from '@dear-steven/core/format';
import type { Citation, EpisodePage, EpisodeSummary } from '@dear-steven/core/schema';
import { Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useId, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { NoVideo, YouTubeLink } from '@/components/ui/YouTubeLink';
import { useI18n } from '@/i18n/I18nProvider';
import { fetchEpisodes } from '@/lib/api';
import { SummaryView } from './SummaryView';

interface EpisodeExplorerProps {
  open: boolean;
  onClose: () => void;
  /** Opens the evidence drawer at a summary's moment (P8-04). */
  onOpenMoment: (citations: Citation[], index: number) => void;
}

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; page: EpisodePage };

/**
 * "The conversations I know": every indexed episode, newest first, searchable by title or guest.
 * Metadata only — the speaker and video states tell you what kind of citations to expect. Each
 * conversation opens its summary (P8-04); the explorer remembers which, so closing the drawer a
 * moment opened brings it back.
 */
export function EpisodeExplorer({ open, onClose, onOpenMoment }: EpisodeExplorerProps) {
  const [query, setQuery] = useState('');
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [more, setMore] = useState<EpisodeSummary[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<EpisodeSummary | null>(null);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  const copy = t.explorer;

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setLoad({ state: 'loading' });
      setMore([]);
      fetchEpisodes(query, 0, ctrl.signal)
        .then((page) => setLoad({ state: 'ready', page }))
        .catch(() => !ctrl.signal.aborted && setLoad({ state: 'error' }));
    }, 180);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [open, query]);

  const shown = load.state === 'ready' ? [...load.page.episodes, ...more] : [];
  const total = load.state === 'ready' ? load.page.total : 0;

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await fetchEpisodes(query, shown.length);
      setMore((m) => [...m, ...page.episodes]);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} eyebrow={copy.eyebrow} title={copy.title} width="lg">
      {selected ? (
        <SummaryView episode={selected} onBack={() => setSelected(null)} onOpen={onOpenMoment} />
      ) : (
        <>
          <label htmlFor={inputId} className="sr-only">
            {copy.search}
          </label>
          <div className="flex items-center gap-2 rounded-[var(--radius-field)] border border-ink-3 bg-ink-2 px-4 focus-within:border-ember-0/60">
            <HugeiconsIcon
              icon={Search01Icon}
              size={16}
              strokeWidth={1.8}
              className="flex-none text-ivory-2"
            />
            <input
              ref={inputRef}
              id={inputId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={copy.search}
              maxLength={100}
              className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-ivory-0 outline-none placeholder:text-ivory-2 [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                aria-label={copy.clear}
                className="-mr-2 grid h-8 w-8 flex-none place-items-center rounded-full text-ivory-2 transition-colors hover:bg-ink-3 hover:text-ivory-0"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} />
              </button>
            ) : null}
          </div>
          <p className="mt-3 font-mono text-[11.5px] text-steel" aria-live="polite">
            {load.state === 'ready'
              ? query.trim()
                ? copy.matches(total)
                : copy.indexed(total)
              : load.state === 'loading'
                ? copy.looking
                : ''}
          </p>

          {load.state === 'error' ? (
            <p className="mt-4 text-[14px] text-oxblood-1">{copy.loadError}</p>
          ) : null}

          {load.state === 'ready' && shown.length === 0 ? (
            <p className="mt-6 text-[14.5px] leading-relaxed text-ivory-1">
              {query.trim() ? copy.noMatch(query.trim()) : t.empty.noKnowledge}
            </p>
          ) : null}

          <ul className="mt-3 flex flex-col divide-y divide-ink-3">
            {shown.map((e) => (
              <EpisodeRow key={e.id} episode={e} onSummary={() => setSelected(e)} />
            ))}
          </ul>

          {shown.length > 0 && shown.length < total ? (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-4 rounded-full border border-ink-3 px-4 py-2 text-[13px] text-ivory-1 transition-colors hover:border-ink-4 hover:text-ivory-0 disabled:opacity-50"
            >
              {loadingMore ? copy.loading : copy.more(total - shown.length)}
            </button>
          ) : null}
        </>
      )}
    </Dialog>
  );
}

function EpisodeRow({ episode, onSummary }: { episode: EpisodeSummary; onSummary: () => void }) {
  const { t, locale } = useI18n();
  const copy = t.explorer;
  return (
    <li className="flex flex-col gap-1.5 py-4 sm:flex-row sm:items-start sm:gap-5">
      <span className="flex w-24 flex-none items-center gap-2 pt-0.5 font-mono text-[11.5px] text-steel sm:flex-col sm:items-start sm:gap-1.5">
        {formatDate(episode.publishedAt, locale)}
        {isNewEpisode(episode.publishedAt) ? (
          <span className="rounded-full bg-ember-0 px-2 py-0.5 text-[10.5px] font-medium text-ink-0">
            {copy.isNew}
          </span>
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <p lang="en" className="font-display text-[17px] leading-snug text-ivory-0">
          {episode.title}
        </p>
        <p className="mt-0.5 text-[13px] text-ivory-2">
          {episode.guestNames.join(', ') || copy.guestNotNamed}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <span className="text-steel">{copy.passages(episode.passages)}</span>
          {episode.speakers === 'verified' ? (
            <span className="rounded-full bg-ember-tint px-2 py-0.5 text-ember-1">
              {copy.verified}
            </span>
          ) : (
            <span className="rounded-full border border-dashed border-steel/60 px-2 py-0.5 text-steel">
              {copy.notVerified}
            </span>
          )}
          {episode.youtubeUrl ? (
            <YouTubeLink href={episode.youtubeUrl} />
          ) : (
            <NoVideo demo={episode.demo} />
          )}
          <button
            type="button"
            onClick={onSummary}
            aria-label={copy.summary.openLabel(episode.title)}
            className="rounded-full border border-ink-3 px-2.5 py-0.5 text-ivory-1 transition-colors hover:border-ember-0/60 hover:text-ivory-0"
          >
            {copy.summary.open}
          </button>
        </div>
      </div>
    </li>
  );
}
