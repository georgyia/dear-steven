import type { ReactNode } from 'react';
import { brand } from '@/brand';
import type { Messages } from '@/i18n';

const action = {
  primary:
    'rounded-full bg-ember-0 px-4 py-2 text-[14px] font-medium text-ink-0 transition-colors hover:bg-ember-1',
  secondary:
    'rounded-full border border-ink-3 px-4 py-2 text-[14px] text-ivory-1 transition-colors hover:border-ink-4 hover:text-ivory-0',
};

interface FallbackPageProps {
  t: Messages;
  /** A mono label above the title: what kind of page this is. */
  eyebrow: string;
  title: string;
  body: string;
  /** The ways on. */
  children: ReactNode;
}

/**
 * A page for when the stage can't be shown (P10-09): an unknown address, or a crash. The wordmark
 * leads home, one serif line says what happened, the ways on follow, and the disclosure sits at
 * the foot as on every screen. No hooks and no state, so the not-found page renders it on the
 * server and the error pages on the client; no error detail is ever passed in. Plain links rather
 * than client navigation: after a crash, a fresh page load is the surest way back.
 */
export function FallbackPage({ t, eyebrow, title, body, children }: FallbackPageProps) {
  return (
    <div className="relative z-10 flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-[44rem] px-4 pt-6">
        <a
          href="/"
          className="rounded-md font-display text-[20px] whitespace-nowrap tracking-[-0.01em] text-ivory-0 transition-colors hover:text-ember-1 [font-variation-settings:'opsz'_48,'SOFT'_100]"
        >
          {brand.name}
          <span className="sr-only">{t.stage.newConversationSr}</span>
        </a>
      </header>
      <main className="mx-auto flex w-full max-w-[44rem] flex-1 flex-col justify-center px-4 py-16 motion-safe:animate-[ds-dialog-in_420ms_var(--ease-out)_both]">
        <p className="font-mono text-[11px] tracking-[0.16em] text-steel uppercase">{eyebrow}</p>
        <h1
          className="mt-4 font-display text-[34px] leading-[1.12] text-balance text-ivory-0 sm:text-[48px]"
          style={{ fontVariationSettings: '"opsz" 96' }}
        >
          {title}
        </h1>
        <p className="mt-4 max-w-[34rem] text-[16px] leading-relaxed text-pretty text-ivory-1">
          {body}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">{children}</div>
      </main>
      <footer className="mx-auto w-full max-w-[44rem] px-4 pb-6 text-[12.5px] leading-snug text-ivory-2">
        {t.disclosure}{' '}
        <a
          href="/terms"
          className="text-ivory-1 underline decoration-ink-4 underline-offset-2 hover:text-ivory-0 hover:decoration-ember-0"
        >
          {t.terms.link}
        </a>
      </footer>
    </div>
  );
}

/** An unknown address: the way home. */
export function NotFoundPage({ t }: { t: Messages }) {
  const copy = t.fallback.notFound;
  return (
    <FallbackPage t={t} eyebrow={copy.eyebrow} title={copy.title} body={copy.body}>
      <a href="/" className={action.primary}>
        {copy.home}
      </a>
    </FallbackPage>
  );
}

/** A crash: render the page again, or start over. */
export function CrashPage({ t, retry }: { t: Messages; retry: () => void }) {
  const copy = t.fallback.crash;
  return (
    <FallbackPage t={t} eyebrow={copy.eyebrow} title={copy.title} body={copy.body}>
      <button type="button" onClick={() => retry()} className={action.primary}>
        {t.turn.retry}
      </button>
      <a href="/" className={action.secondary}>
        {t.stage.newConversation}
      </a>
    </FallbackPage>
  );
}
