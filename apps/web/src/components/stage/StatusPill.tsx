'use client';

import type { KnowledgeStatus } from '@dear-steven/core/schema';
import { brand } from '@/brand';
import LatticeLoader from '@/components/vendor/react-bits/LatticeLoader';

export type KnowledgeState = 'ready' | 'demo' | 'empty' | 'partial' | 'broken';

export function knowledgeState(s: KnowledgeStatus): KnowledgeState {
  if (s.mode === 'demo') return 'demo';
  if (s.storeError) return 'broken';
  if (s.passages === 0) return 'empty';
  if (s.embeddedPassages < s.passages) return 'partial';
  return 'ready';
}

export function statusText(s: KnowledgeStatus): string {
  const { status } = brand.copy;
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

const SHORT: Record<KnowledgeState, (s: KnowledgeStatus) => string> = {
  ready: (s) => `${s.episodes.toLocaleString('en-GB')} · ready`,
  demo: () => 'Demo mode',
  empty: () => 'Not indexed',
  partial: () => 'Indexing',
  broken: () => 'Offline',
};

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
      <span className="sm:hidden">{SHORT[state](status)}</span>
      <span className="hidden sm:inline">{statusText(status)}</span>
      <span className="sr-only">. Open setup and knowledge base details.</span>
    </button>
  );
}
