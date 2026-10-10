'use client';

import type { KnowledgeStatus } from '@dear-steven/core/schema';
import type { ReactNode } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import StatusMark, { type StatusMarkStatus } from '@/components/vendor/react-bits/StatusMark';

interface SetupDialogProps {
  open: boolean;
  onClose: () => void;
  status: KnowledgeStatus;
}

interface Item {
  key: string;
  status: StatusMarkStatus;
  title: string;
  detail: ReactNode;
  optional?: boolean;
}

const n = (x: number) => x.toLocaleString('en-GB');

function items(s: KnowledgeStatus): Item[] {
  const demo = s.mode === 'demo';
  return [
    {
      key: 'openai',
      status: s.setup.openaiKey ? 'done' : 'failed',
      title: 'OpenAI API key',
      detail: s.setup.openaiKey ? (
        s.demoReason === 'forced' ? (
          'Found, but DEAR_STEVEN_DEMO=1 is forcing demo mode.'
        ) : (
          'Found on the server. It never reaches the browser.'
        )
      ) : (
        <>
          Missing — answers are demo fixtures until you add <Code>OPENAI_API_KEY</Code> to{' '}
          <Code>.env</Code> at the repository root and restart.
        </>
      ),
    },
    {
      key: 'kb',
      status: s.storeError
        ? 'failed'
        : !s.setup.database || (!demo && s.passages === 0)
          ? 'pending'
          : 'done',
      title: 'Knowledge base',
      detail: s.storeError ? (
        `The database could not be opened: ${s.storeError}`
      ) : !s.setup.database ? (
        <>
          No database yet. Start with <Code>pnpm ingest discover</Code>, then{' '}
          <Code>pnpm ingest transcribe --from vtt --limit 20</Code>.
        </>
      ) : (
        `${n(s.episodes)} episodes · ${n(s.passages)} passages indexed${s.lastIndexedAt ? ` · last run ${s.lastIndexedAt.slice(0, 10)}` : ''}.`
      ),
    },
    {
      key: 'embeddings',
      status: s.passages === 0 ? 'pending' : s.embeddedPassages >= s.passages ? 'done' : 'running',
      title: 'Semantic search',
      detail:
        s.passages === 0 ? (
          'Waiting for passages.'
        ) : s.embeddedPassages >= s.passages ? (
          'Every passage has an embedding; search is hybrid (meaning + keywords).'
        ) : (
          <>
            {n(s.embeddedPassages)} of {n(s.passages)} passages embedded — keyword search covers the
            rest. Run <Code>pnpm ingest index</Code>.
          </>
        ),
    },
    {
      key: 'youtube',
      optional: true,
      status: s.youtubeLinkedEpisodes > 0 ? 'done' : 'pending',
      title: 'YouTube moments',
      detail:
        s.youtubeLinkedEpisodes > 0 ? (
          `${n(s.youtubeLinkedEpisodes)} episodes linked to their videos.`
        ) : (
          <>
            Optional. Add <Code>YOUTUBE_API_KEY</Code> and run{' '}
            <Code>pnpm ingest match-youtube</Code> so citations open the video at the right moment.
          </>
        ),
    },
    {
      key: 'speakers',
      optional: true,
      status: s.diarizedEpisodes > 0 ? 'done' : 'pending',
      title: 'Verified speakers',
      detail:
        s.diarizedEpisodes > 0 ? (
          `${n(s.diarizedEpisodes)} episodes have speaker labels, so I can say who said what.`
        ) : (
          <>
            Optional, paid. Without speaker labels I cite the conversation, never a person. See{' '}
            <Code>plan/human/transcription-budget.md</Code>.
          </>
        ),
    },
  ];
}

/** "What's set up, and what to run next" — the helpful alternative to crashing on missing config. */
export function SetupDialog({ open, onClose, status }: SetupDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} eyebrow="Setup" title="What I have to work with">
      <ul className="flex flex-col gap-4">
        {items(status).map((item) => (
          <li key={item.key} className="flex gap-3">
            <StatusMark
              status={item.status}
              size={20}
              color="var(--ivory-2)"
              doneColor="var(--ember-0)"
              errorColor="var(--oxblood-1)"
              strike={false}
              className="mt-0.5 flex-none"
            />
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-ivory-0">
                {item.title}
                {item.optional ? (
                  <span className="ml-2 font-mono text-[11px] text-steel">optional</span>
                ) : null}
              </p>
              <p className="mt-0.5 text-[14px] leading-relaxed text-ivory-2">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-6 border-t border-ink-3 pt-4 text-[13px] leading-relaxed text-ivory-2">
        Full instructions: <Code>README.md</Code> and <Code>docs/INGESTION.md</Code>. Nothing you
        ask is stored.
      </p>
    </Dialog>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-ink-3 px-1.5 py-0.5 font-mono text-[12px] text-ivory-1">
      {children}
    </code>
  );
}
