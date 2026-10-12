'use client';

import { useEffect, useState } from 'react';
import { brand } from '@/brand';

const NOTICE_KEY = 'dear-steven:first-visit-notice';
const NOTICE_VERSION = 'v1';

const TermsLink = () => (
  <a
    href="/terms"
    className="text-ivory-1 underline decoration-ink-4 underline-offset-2 hover:text-ivory-0 hover:decoration-ember-0"
  >
    {brand.copy.terms.link}
  </a>
);

/** The AI-persona disclosure with the terms one click away — under every composer (P6-12). */
export function Disclosure({ className }: { className?: string }) {
  return (
    <p className={className}>
      {brand.disclosure} <TermsLink />
    </p>
  );
}

function seen(): boolean {
  try {
    return localStorage.getItem(NOTICE_KEY) === NOTICE_VERSION;
  } catch {
    return false;
  }
}

/**
 * The first visit says what this is before anything else (P6-12): an AI persona, not professional
 * advice, the terms one click away. Shown once per browser — remembered locally, with nothing sent
 * anywhere — and never as a modal, so it can't stand between someone and the question they came
 * with. Until the browser has been checked (after hydration), the plain disclosure shows.
 */
export function FirstVisitDisclosure({ className }: { className?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(!seen()), []);

  if (!show) return <Disclosure className={className} />;
  const dismiss = () => {
    try {
      localStorage.setItem(NOTICE_KEY, NOTICE_VERSION);
    } catch {
      // Storage blocked: it closes for this visit and may show again next time.
    }
    setShow(false);
  };
  return (
    <section
      aria-label={brand.copy.terms.noticeLabel}
      className="flex max-w-[30rem] flex-col items-center gap-2.5 rounded-[var(--radius-card)] border border-ink-3 bg-ink-1/80 px-4 py-3 text-[12.5px] leading-relaxed text-ivory-1 backdrop-blur"
    >
      <p>{brand.copy.terms.notice}</p>
      <div className="flex items-center gap-3">
        <TermsLink />
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full border border-ink-3 px-3 py-1 font-mono text-[11px] text-ivory-0 transition-colors hover:border-ink-4 hover:bg-ink-2"
        >
          {brand.copy.terms.dismiss}
        </button>
      </div>
    </section>
  );
}
