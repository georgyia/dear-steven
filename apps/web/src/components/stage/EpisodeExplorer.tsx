'use client';

import { formatDate } from '@dear-steven/core/format';
import type { EpisodePage, EpisodeSummary } from '@dear-steven/core/schema';
import { Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useId, useRef, useState } from 'react';
import { brand } from '@/brand';
import { Dialog } from '@/components/ui/Dialog';
import { NoVideo, YouTubeLink } from '@/components/ui/YouTubeLink';
import { fetchEpisodes } from '@/lib/api';

interface EpisodeExplorerProps {
  open: boolean;
  onClose: () => void;
}

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; page: EpisodePage };

/**
 * "The conversations I know": every indexed episode, newest first, searchable by title or guest.
 * Metadata only — the speaker and video states tell you what kind of citations to expect.
 */
export function EpisodeExplorer({ open, onClose }: EpisodeExplorerProps) {
  const [query, setQuery] = useState('');
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [more, setMore] = useState<EpisodeSummary[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoad({ state: 'loading' });
      setMore([]);
      fetchEpisodes(query, 0, ctrl.signal)
        .then((page) => setLoad({ state: 'ready', page }))
        .catch(() => !ctrl.signal.aborted && setLoad({ state: 'error' }));
    }, 180);
    return () => {
      clearTimeout(t);
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
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="Knowledge base"
      title="The conversations I know"
      width="lg"
    >
      <label htmlFor={inputId} className="sr-only">
        Search by guest or title
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
          placeholder="Search by guest or title"
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
            aria-label="Clear search"
            className="-mr-2 grid h-8 w-8 flex-none place-items-center rounded-full text-ivory-2 transition-colors hover:bg-ink-3 hover:text-ivory-0"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} />
          </button>
        ) : null}
      </div>
      <p className="mt-3 font-mono text-[11.5px] text-steel" aria-live="polite">
        {load.state === 'ready'
          ? query.trim()
            ? `${total.toLocaleString('en-GB')} match${total === 1 ? '' : 'es'}`
            : `${total.toLocaleString('en-GB')} conversation${total === 1 ? '' : 's'} indexed`
          : load.state === 'loading'
            ? 'Looking…'
            : ''}
      </p>

      {load.state === 'error' ? (
        <p className="mt-4 text-[14px] text-oxblood-1">I couldn’t load the list just now.</p>
      ) : null}

      {load.state === 'ready' && shown.length === 0 ? (
        <p className="mt-6 text-[14.5px] leading-relaxed text-ivory-1">
          {query.trim()
            ? `No conversation matches “${query.trim()}”.`
            : brand.copy.empty.noKnowledge}
        </p>
      ) : null}

      <ul className="mt-3 flex flex-col divide-y divide-ink-3">
        {shown.map((e) => (
          <EpisodeRow key={e.id} episode={e} />
        ))}
      </ul>

      {shown.length > 0 && shown.length < total ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-4 rounded-full border border-ink-3 px-4 py-2 text-[13px] text-ivory-1 transition-colors hover:border-ink-4 hover:text-ivory-0 disabled:opacity-50"
        >
          {loadingMore
            ? 'Loading…'
            : `Show more (${(total - shown.length).toLocaleString('en-GB')} left)`}
        </button>
      ) : null}
    </Dialog>
  );
}

function EpisodeRow({ episode }: { episode: EpisodeSummary }) {
  return (
    <li className="flex flex-col gap-1.5 py-4 sm:flex-row sm:items-start sm:gap-5">
      <span className="w-24 flex-none pt-0.5 font-mono text-[11.5px] text-steel">
        {formatDate(episode.publishedAt)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[17px] leading-snug text-ivory-0">{episode.title}</p>
        <p className="mt-0.5 text-[13px] text-ivory-2">
          {episode.guestNames.join(', ') || 'Guest not named'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <span className="text-steel">{episode.passages} passages</span>
          {episode.speakers === 'verified' ? (
            <span className="rounded-full bg-ember-tint px-2 py-0.5 text-ember-1">
              speakers verified
            </span>
          ) : (
            <span className="rounded-full border border-dashed border-steel/60 px-2 py-0.5 text-steel">
              speakers not verified
            </span>
          )}
          {episode.youtubeUrl ? (
            <YouTubeLink href={episode.youtubeUrl} />
          ) : (
            <NoVideo demo={episode.demo} />
          )}
        </div>
      </div>
    </li>
  );
}
