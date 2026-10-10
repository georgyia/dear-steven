'use client';

import { formatDate } from '@dear-steven/core/format';
import type { AnswerEpisode } from '@dear-steven/core/schema';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties } from 'react';
import SpotlightCard from '@/components/vendor/react-bits/SpotlightCard';

const CARD_VARS = {
  '--spotlight-card-surface': 'var(--ink-2)',
  '--spotlight-card-border': 'var(--ink-3)',
  '--spotlight-card-shadow': '0 18px 40px -24px rgb(0 0 0 / 0.8)',
} as CSSProperties;

interface EpisodeCardsProps {
  episodes: AnswerEpisode[];
  onOpen: (citationId: string) => void;
}

/** The conversations this answer drew on, closing the answer like a reading list. */
export function EpisodeCards({ episodes, onOpen }: EpisodeCardsProps) {
  const reduce = useReducedMotion();
  if (episodes.length === 0) return null;
  return (
    <section aria-label="Conversations cited" className="mt-2">
      <h3 className="mb-3 font-mono text-[11px] tracking-[0.16em] text-steel uppercase">
        From{' '}
        {episodes.length === 1 ? 'this conversation' : `these ${episodes.length} conversations`}
      </h3>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
        {episodes.map((episode, i) => (
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
              className="h-full rounded-[var(--radius-card)] p-0!"
              style={CARD_VARS}
            >
              <button
                type="button"
                onClick={() => {
                  const first = episode.citationIds[0];
                  if (first) onOpen(first);
                }}
                className="group flex h-full w-full flex-col gap-2 p-4 text-left"
              >
                <span className="flex items-center justify-between font-mono text-[11px] text-steel">
                  <span>{formatDate(episode.publishedAt)}</span>
                  <span>
                    {episode.citationIds.length} moment{episode.citationIds.length === 1 ? '' : 's'}
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
            </SpotlightCard>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
