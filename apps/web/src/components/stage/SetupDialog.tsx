'use client';

import type { UiLocale } from '@dear-steven/core/copy';
import type { KnowledgeStatus, SetupState } from '@dear-steven/core/schema';
import type { ReactNode } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Rich } from '@/components/ui/Rich';
import StatusMark, { type StatusMarkStatus } from '@/components/vendor/react-bits/StatusMark';
import type { Messages } from '@/i18n';
import { useI18n } from '@/i18n/I18nProvider';
import { usd } from '@/lib/money';
import { GuidedSetup } from './GuidedSetup';
import { OwnKey } from './OwnKey';

interface SetupDialogProps {
  open: boolean;
  onClose: () => void;
  status: KnowledgeStatus;
  /** Opens the episode explorer. */
  onBrowse: () => void;
  /** The visitor saved or forgot their own key: ask the server for the status again. */
  onKeyChange: () => void;
  /** Opened to add a key (P8-02): the key field takes the focus. */
  focusKey?: boolean;
  /** Set when `pnpm dev:setup` started this server and the page holds its token (P6-04). */
  guided?: { token: string; state: SetupState; onState: (state: SetupState) => void } | null;
}

interface Item {
  key: string;
  status: StatusMarkStatus;
  title: string;
  detail: ReactNode;
  /** Controls under the detail. */
  action?: ReactNode;
  optional?: boolean;
}

function items(
  s: KnowledgeStatus,
  copy: Messages['setup'],
  locale: UiLocale,
  onKeyChange: () => void,
  focusKey: boolean,
): Item[] {
  const demo = s.mode === 'demo';
  const money = (x: number) => usd(x, locale);
  return [
    {
      key: 'openai',
      status: s.setup.openaiKey ? 'done' : 'failed',
      title: copy.openai.title,
      detail: s.setup.visitorKey ? null : (
        <Rich
          text={
            s.demoReason === 'forced'
              ? copy.openai.forced
              : s.demoReason === 'no_daily_cap'
                ? copy.openai.noCap
                : s.setup.openaiKey
                  ? copy.openai.found
                  : copy.openai.missing
          }
        />
      ),
      action: s.demoReason === 'forced' ? null : <OwnKey onChange={onKeyChange} focus={focusKey} />,
    },
    {
      key: 'kb',
      status: s.storeError
        ? 'failed'
        : !s.setup.database || (!demo && s.passages === 0)
          ? 'pending'
          : 'done',
      title: copy.kb.title,
      detail: s.storeError ? (
        copy.kb.error(s.storeError)
      ) : !s.setup.database ? (
        <Rich text={copy.kb.none} />
      ) : (
        copy.kb.ready(s.episodes, s.passages, s.lastIndexedAt?.slice(0, 10) ?? null)
      ),
    },
    {
      key: 'embeddings',
      status: s.passages === 0 ? 'pending' : s.embeddedPassages >= s.passages ? 'done' : 'running',
      title: copy.embeddings.title,
      detail:
        s.passages === 0 ? (
          copy.embeddings.waiting
        ) : s.embeddedPassages >= s.passages ? (
          copy.embeddings.done
        ) : (
          <Rich text={copy.embeddings.partial(s.embeddedPassages, s.passages)} />
        ),
    },
    {
      key: 'youtube',
      optional: true,
      status: s.youtubeLinkedEpisodes > 0 ? 'done' : 'pending',
      title: copy.youtube.title,
      detail:
        s.youtubeLinkedEpisodes > 0 ? (
          copy.youtube.done(s.youtubeLinkedEpisodes)
        ) : (
          <Rich text={copy.youtube.missing} />
        ),
    },
    {
      key: 'spend',
      optional: true,
      status:
        s.spend.capUsd === null
          ? 'pending'
          : s.spend.todayUsd >= s.spend.capUsd
            ? 'failed'
            : 'done',
      title: copy.spend.title,
      detail:
        s.spend.capUsd === null ? (
          <Rich text={copy.spend.none(money(s.spend.todayUsd))} />
        ) : s.spend.todayUsd >= s.spend.capUsd ? (
          copy.spend.resting(money(s.spend.capUsd))
        ) : (
          copy.spend.within(money(s.spend.todayUsd), money(s.spend.capUsd))
        ),
    },
    {
      key: 'speakers',
      optional: true,
      status: s.diarizedEpisodes > 0 ? 'done' : 'pending',
      title: copy.speakers.title,
      detail:
        s.diarizedEpisodes > 0 ? (
          copy.speakers.done(s.diarizedEpisodes)
        ) : (
          <Rich text={copy.speakers.missing} />
        ),
    },
  ];
}

/** "What's set up, and what to run next" — the helpful alternative to crashing on missing config. */
export function SetupDialog({
  open,
  onClose,
  status,
  onBrowse,
  onKeyChange,
  focusKey = false,
  guided,
}: SetupDialogProps) {
  const { t, locale } = useI18n();
  const copy = t.setup;
  return (
    <Dialog open={open} onClose={onClose} eyebrow={copy.eyebrow} title={copy.title}>
      <ul className="flex flex-col gap-4">
        {items(status, copy, locale, onKeyChange, focusKey).map((item) => (
          <li key={item.key} className="flex gap-3">
            <StatusMark
              status={item.status}
              statusLabels={copy.marks}
              size={20}
              color="var(--ivory-2)"
              doneColor="var(--ember-0)"
              errorColor="var(--oxblood-1)"
              strike={false}
              className="mt-0.5 flex-none self-start"
            />
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-ivory-0">
                {item.title}
                {item.optional ? (
                  <span className="ml-2 font-mono text-[11px] text-steel">{copy.optional}</span>
                ) : null}
              </p>
              {item.detail ? (
                <p className="mt-0.5 text-[14px] leading-relaxed text-ivory-2">{item.detail}</p>
              ) : null}
              {item.action}
            </div>
          </li>
        ))}
      </ul>
      {status.episodes > 0 ? (
        <button
          type="button"
          onClick={onBrowse}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink-3 px-4 py-2 text-[13.5px] text-ivory-0 transition-colors hover:border-ember-0/60 hover:text-ember-1"
        >
          {copy.browse(status.episodes)}
        </button>
      ) : null}
      {guided ? <GuidedSetup {...guided} onProgress={onKeyChange} /> : null}
      <p className="mt-6 border-t border-ink-3 pt-4 text-[13px] leading-relaxed text-ivory-2">
        <Rich text={copy.footer} />
      </p>
    </Dialog>
  );
}
