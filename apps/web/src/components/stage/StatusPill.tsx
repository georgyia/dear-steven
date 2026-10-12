'use client';

import type { KnowledgeStatus } from '@dear-steven/core/schema';
import LatticeLoader from '@/components/vendor/react-bits/LatticeLoader';
import type { Messages } from '@/i18n';
import { useI18n } from '@/i18n/I18nProvider';

export type KnowledgeState = 'ready' | 'demo' | 'empty' | 'partial' | 'broken';

export function knowledgeState(s: KnowledgeStatus): KnowledgeState {
  if (s.mode === 'demo') return 'demo';
  if (s.storeError) return 'broken';
  if (s.passages === 0) return 'empty';
  if (s.embeddedPassages < s.passages) return 'partial';
  return 'ready';
}

export function statusText(s: KnowledgeStatus, status: Messages['status']): string {
  switch (knowledgeState(s)) {
    case 'demo':
      return status.demo;
    case 'broken':
      return status.broken;
    case 'empty':
      return status.empty;
    case 'partial':
      return status.partial(s.episodes);
    case 'ready':
      return status.ready(s.episodes);
  }
}

function shortText(s: KnowledgeStatus, status: Messages['status']): string {
  const state = knowledgeState(s);
  if (state !== 'ready') return status.short[state];
  return s.setup.visitorKey ? status.short.yourKey(s.episodes) : status.short.ready(s.episodes);
}

/** Running on the visitor's own key (P6-03) is always said, not only in the setup panel. */
function longText(s: KnowledgeStatus, status: Messages['status']): string {
  const text = statusText(s, status);
  return s.setup.visitorKey ? status.onYourKey(text) : text;
}

const DOT: Record<KnowledgeState, string> = {
  ready: 'bg-ember-0 shadow-[0_0_10px_var(--ember-glow)]',
  demo: 'bg-steel',
  empty: 'bg-steel',
  partial: 'bg-ember-0',
  broken: 'bg-oxblood',
};

/** The restrained readiness indicator. Opens the setup panel. */
export function StatusPill({ status, onOpen }: { status: KnowledgeStatus; onOpen: () => void }) {
  const state = knowledgeState(status);
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onOpen}
      data-state={state}
      data-testid="status-pill"
      className="inline-flex h-8 items-center gap-2 rounded-full whitespace-nowrap border border-ink-3 bg-ink-1/80 px-3 font-mono text-[11.5px] text-ivory-1 backdrop-blur transition-colors hover:border-ink-4 hover:text-ivory-0"
    >
      {state === 'partial' ? (
        <LatticeLoader
          label=""
          showTimer={false}
          cellSize={3}
          gap={1.5}
          fontSize={11}
          color="var(--ember-0)"
          pattern="orbit"
        />
      ) : (
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DOT[state]}`} />
      )}
      <span className="sm:hidden">{shortText(status, t.status)}</span>
      <span className="hidden sm:inline">{longText(status, t.status)}</span>
      <span className="sr-only">{t.status.open}</span>
    </button>
  );
}
