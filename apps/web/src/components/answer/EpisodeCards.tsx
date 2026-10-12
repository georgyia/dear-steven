'use client';

import { formatDate, formatMoment } from '@dear-steven/core/format';
import type { AnswerEpisode, Citation } from '@dear-steven/core/schema';
import { SHOW_CHANNEL_URL } from '@dear-steven/core/youtube';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties } from 'react';
import { brand } from '@/brand';
import { NoVideo, YouTubeLink } from '@/components/ui/YouTubeLink';
import SpotlightCard from '@/components/vendor/react-bits/SpotlightCard';

const CARD_VARS = {
  '--spotlight-card-surface': 'var(--ink-2)',
  '--spotlight-card-border': 'var(--ink-3)',
  '--spotlight-card-shadow': '0 18px 40px -24px rgb(0 0 0 / 0.8)',
} as CSSProperties;

interface EpisodeCardsProps {
  episodes: AnswerEpisode[];
  citations: Record<string, Citation>;
  onOpen: (citationId: string) => void;
}

/** The video at the first moment this answer cites from the episode; the URL is core's. */
function firstMoment(episode: AnswerEpisode, citations: Record<string, Citation>) {
  const first = episode.citationIds.map((id) => citations[id]).find((c) => c?.youtubeUrl);
  if (!first?.youtubeUrl) return null;
  const moment = formatMoment(first.timestamp.ms, first.timestamp.state);
  return {
    href: first.youtubeUrl,
    label: moment ? brand.copy.youtube.watchFrom(moment) : brand.copy.youtube.watch,
  };
}

/**
 * The conversations this answer drew on, closing the answer like a reading list — each with its
 * video, and an invitation to watch the originals (P6-14).
 */
export function EpisodeCards({ episodes, citations, onOpen }: EpisodeCardsProps) {
  const reduce = useReducedMotion();
  if (episodes.length === 0) return null;
  return (
    <section aria-label="Conversations cited" className="mt-2">
      <h3 className="mb-3 font-mono text-[11px] tracking-[0.16em] text-steel uppercase">
        From{' '}
        {episodes.length === 1 ? 'this conversation' : `these ${episodes.length} conversations`}
      </h3>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
        {episodes.map((episode, i) => {
          const video = firstMoment(episode, citations);
          return (
            <motion.li
              key={episode.id}
              className="w-[78%] flex-none snap-start sm:w-auto"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 * i, ease: [0.23, 1, 0.32, 1] }}
            >
              <SpotlightCard
                spotlightColor="var(--ember-0)"
                intensity={0.12}
                borderGlow={0.5}
                spotlightSize={220}
                grain={0.25}
                className="flex h-full flex-col rounded-[var(--radius-card)] p-0!"
                style={CARD_VARS}
              >
                <button
                  type="button"
                  onClick={() => {
                    const first = episode.citationIds[0];
                    if (first) onOpen(first);
                  }}
                  className="group flex w-full flex-1 flex-col gap-2 p-4 pb-2 text-left"
                >
                  <span className="flex items-center justify-between font-mono text-[11px] text-steel">
                    <span>{formatDate(episode.publishedAt)}</span>
                    <span>
                      {episode.citationIds.length} moment
                      {episode.citationIds.length === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="line-clamp-3 font-display text-[17px] leading-snug text-ivory-0">
                    {episode.title}
                  </span>
                  <span className="mt-auto flex items-center justify-between pt-1 text-[13px] text-ivory-2">
                    <span className="truncate">
                      {episode.guestNames.join(', ') || 'The Diary Of A CEO'}
                    </span>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      size={15}
                      strokeWidth={2}
                      className="flex-none text-ember-0 transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </span>
                </button>
                <div className="px-4 pb-4">
                  {video ? (
                    <YouTubeLink href={video.href}>{video.label}</YouTubeLink>
                  ) : (
                    <NoVideo demo={episode.demo} />
                  )}
                </div>
              </SpotlightCard>
            </motion.li>
          );
        })}
      </ul>
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13.5px] leading-relaxed text-ivory-2">
        <span>{brand.copy.youtube.invitation}</span>
        <YouTubeLink href={SHOW_CHANNEL_URL} variant="inline">
          {brand.copy.youtube.channel}
        </YouTubeLink>
      </p>
    </section>
  );
}
