'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { FirstVisitDisclosure, type FirstVisitNotice } from './Disclosure';
import { HeroWordmark } from './Wordmark';

interface HomeViewProps {
  composer: ReactNode;
  footerStart: ReactNode;
  footerEnd: ReactNode;
  notice: FirstVisitNotice;
  onExample: (question: string) => void;
}

const ease = [0.23, 1, 0.32, 1] as const;

/** The first screen: wordmark, one line of voice, one input, three ways in. Nothing else. */
export function HomeView({ composer, footerStart, footerEnd, notice, onExample }: HomeViewProps) {
  const reduce = useReducedMotion();
  const { t } = useI18n();
  // The server can't know the visitor's motion setting, so it renders the full entrance's first
  // frame. Both variants therefore bring every property back to rest; with reduced motion the blur
  // and the offset go at once and only a short fade remains (P7-10).
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 14, filter: 'blur(6px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: reduce
      ? { duration: 0.3, delay, y: { duration: 0 }, filter: { duration: 0 } }
      : { duration: 0.8, delay, ease },
  });

  return (
    <>
      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[52rem] flex-col items-center justify-center px-4 pt-14 pb-32 text-center">
        <HeroWordmark />
        <motion.p
          {...rise(0.55)}
          className="mt-6 max-w-[33rem] text-[17px] leading-relaxed text-balance text-ivory-1 sm:text-[18px]"
        >
          {t.home.intro}
        </motion.p>

        <motion.div {...rise(0.75)} className="mt-10 w-full max-w-[40rem]">
          <motion.div
            layoutId="composer"
            transition={{ type: 'spring', duration: 0.7, bounce: 0.12 }}
          >
            {composer}
          </motion.div>
        </motion.div>

        <motion.ul
          {...rise(0.95)}
          aria-label={t.home.examplesLabel}
          className="mt-5 flex max-w-[44rem] flex-wrap justify-center gap-2"
        >
          {t.home.examples.map((q) => (
            <li key={q}>
              <button
                type="button"
                onClick={() => onExample(q)}
                className="rounded-full border border-ink-3 bg-ink-1/70 px-3.5 py-2 text-left text-[13.5px] leading-snug text-ivory-1 backdrop-blur transition-colors duration-200 hover:border-ink-4 hover:bg-ink-2 hover:text-ivory-0"
              >
                {q}
              </button>
            </li>
          ))}
        </motion.ul>

        <motion.div
          {...rise(1.1)}
          className="mt-8 flex max-w-[30rem] flex-col items-center gap-1.5 text-[12px] leading-relaxed text-ivory-2 [text-shadow:0_0_14px_var(--ink-0),0_0_4px_var(--ink-0)]"
        >
          <FirstVisitDisclosure notice={notice} />
          <ul
            aria-label={t.home.shortcutsLabel}
            className="hidden flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[11px] text-steel lg:flex"
          >
            {t.home.shortcuts.map((s) => (
              <li key={s.keys} className="flex items-center gap-1.5">
                <kbd className="rounded border border-ink-3 bg-ink-1/70 px-1.5 py-px text-[10.5px] text-ivory-1">
                  {s.keys}
                </kbd>
                {s.action}
              </li>
            ))}
          </ul>
        </motion.div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] sm:px-6 sm:pb-6">
        {footerStart}
        {footerEnd}
      </footer>
    </>
  );
}
