'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import GradualBlur from '@/components/vendor/react-bits/GradualBlur';
import { Disclosure } from './Disclosure';

interface ConversationViewProps {
  header: ReactNode;
  children: ReactNode;
  composer: ReactNode;
  /** The evidence drawer is open on desktop: the column and composer make room for it. */
  drawerOpen: boolean;
}

/**
 * The conversation: questions as editorial headings in a 44rem column, the composer docked at
 * the bottom under a soft scroll-edge blur. No sidebar — the conversation is the page.
 */
export function ConversationView({
  header,
  children,
  composer,
  drawerOpen,
}: ConversationViewProps) {
  const shift = `transition-[padding] duration-300 ease-[var(--ease-out)] ${drawerOpen ? 'lg:pr-[var(--drawer)]' : ''}`;
  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-30 ${shift}`}>
        <div className="flex h-16 items-center justify-between gap-3 bg-[linear-gradient(180deg,var(--ink-0)_0%,rgb(10_9_8/0.82)_55%,transparent)] px-4 sm:px-6">
          {header}
        </div>
      </header>

      <main className={`relative z-10 ${shift}`}>
        <div className="mx-auto flex w-full max-w-[var(--column)] flex-col gap-20 px-5 pt-28 pb-[calc(var(--composer-h)+10rem)] sm:px-6">
          {children}
        </div>
      </main>

      <div className={`fixed inset-x-0 bottom-0 z-30 ${shift}`}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[10rem] bg-[linear-gradient(0deg,var(--ink-0)_0%,rgb(10_9_8/0.86)_45%,transparent)]"
        />
        <GradualBlur
          position="bottom"
          height="10rem"
          strength={1.6}
          divCount={6}
          curve="bezier"
          zIndex={0}
        />
        <div className="relative z-10 mx-auto w-full max-w-[calc(var(--column)+2rem)] px-4 pb-[calc(env(safe-area-inset-bottom)+10px)]">
          <motion.div
            layoutId="composer"
            transition={{ type: 'spring', duration: 0.7, bounce: 0.12 }}
          >
            {composer}
          </motion.div>
          <Disclosure className="mt-2 text-center text-[11.5px] leading-snug text-ivory-2" />
        </div>
      </div>
    </>
  );
}
