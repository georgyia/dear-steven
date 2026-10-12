'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';

const NOTICE_KEY = 'dear-steven:first-visit-notice';
const NOTICE_VERSION = 'v1';

function TermsLink() {
  const { t } = useI18n();
  return (
    <a
      href="/terms"
      className="text-ivory-1 underline decoration-ink-4 underline-offset-2 hover:text-ivory-0 hover:decoration-ember-0"
    >
      {t.terms.link}
    </a>
  );
}

/** The AI-persona disclosure with the terms one click away — under every composer (P6-12). */
export function Disclosure({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p className={className}>
      {t.disclosure} <TermsLink />
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

export interface FirstVisitNotice {
  /** `null` until this browser has been checked (after hydration). */
  pending: boolean | null;
  dismiss: () => void;
}

/**
 * Whether the first-visit notice is still waiting to be read (P6-12). Owned by the stage, so the
 * demo toast can wait its turn (P7-04): one message at a time, never one on top of the other.
 */
export function useFirstVisitNotice(): FirstVisitNotice {
  const [pending, setPending] = useState<boolean | null>(null);
  useEffect(() => setPending(!seen()), []);
  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(NOTICE_KEY, NOTICE_VERSION);
    } catch {
      // Storage blocked: it closes for this visit and may show again next time.
    }
    setPending(false);
  }, []);
  return { pending, dismiss };
}

/**
 * The first visit says what this is before anything else (P6-12): an AI persona, not professional
 * advice, the terms one click away. Shown once per browser — remembered locally, with nothing sent
 * anywhere — and never as a modal, so it can't stand between someone and the question they came
 * with. Until the browser has been checked (after hydration), the plain disclosure shows.
 */
export function FirstVisitDisclosure({
  notice,
  className,
}: {
  notice: FirstVisitNotice;
  className?: string;
}) {
  const { t } = useI18n();
  if (!notice.pending) return <Disclosure className={className} />;
  return (
    <section
      aria-label={t.terms.noticeLabel}
      className="flex max-w-[30rem] flex-col items-center gap-2.5 rounded-[var(--radius-card)] border border-ink-3 bg-ink-1/80 px-4 py-3 text-[12.5px] leading-relaxed text-ivory-1 backdrop-blur"
    >
      <p>{t.terms.notice}</p>
      <div className="flex items-center gap-3">
        <TermsLink />
        <button
          type="button"
          onClick={notice.dismiss}
          className="rounded-full border border-ink-3 px-3 py-1 font-mono text-[11px] text-ivory-0 transition-colors hover:border-ink-4 hover:bg-ink-2"
        >
          {t.terms.dismiss}
        </button>
      </div>
    </section>
  );
}
