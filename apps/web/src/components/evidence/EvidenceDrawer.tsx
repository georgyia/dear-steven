'use client';

import type { Citation } from '@dear-steven/core/schema';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { useIsDesktop } from '@/lib/hooks';
import { EvidenceSheet } from './EvidenceSheet';
import { PassageView } from './PassageView';

export interface EvidenceTarget {
  citation: Citation;
  index: number;
  total: number;
}

interface EvidenceDrawerProps {
  target: EvidenceTarget | null;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

/**
 * The source inspector. At ≥1024px a 420px panel beside the conversation (the column shifts left,
 * it is never covered); below that, a bottom sheet. Opening moves focus to the passage heading;
 * closing returns it to whatever opened the drawer.
 */
export function EvidenceDrawer({ target, onPrev, onNext, onClose }: EvidenceDrawerProps) {
  const desktop = useIsDesktop();
  const reduce = useReducedMotion();
  const { t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const open = target !== null;

  useEffect(() => {
    if (open) {
      if (!returnFocus.current && document.activeElement instanceof HTMLElement) {
        returnFocus.current = document.activeElement;
      }
      requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    } else if (returnFocus.current) {
      returnFocus.current.focus({ preventScroll: true });
      returnFocus.current = null;
    }
  }, [open]);

  if (!desktop) {
    return (
      <EvidenceSheet open={open} onClose={onClose}>
        {target ? (
          <PassageView
            citation={target.citation}
            position={target}
            onPrev={onPrev}
            onNext={onNext}
            onClose={onClose}
            headingRef={headingRef}
          />
        ) : null}
      </EvidenceSheet>
    );
  }

  return (
    <AnimatePresence>
      {target ? (
        <motion.aside
          key="evidence"
          role="dialog"
          aria-modal="false"
          aria-label={t.inspector.label}
          className="fixed top-0 right-0 bottom-0 z-40 w-[var(--drawer)] border-l border-ink-3 bg-[rgb(14_12_10/0.94)] shadow-[-40px_0_80px_-40px_rgb(0_0_0/0.9)]"
          initial={reduce ? { opacity: 0 } : { x: '100%' }}
          animate={reduce ? { opacity: 1 } : { x: 0 }}
          exit={reduce ? { opacity: 0 } : { x: '100%' }}
          transition={{ type: 'spring', duration: 0.45, bounce: 0 }}
        >
          <PassageView
            citation={target.citation}
            position={target}
            onPrev={onPrev}
            onNext={onNext}
            onClose={onClose}
            headingRef={headingRef}
          />
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
