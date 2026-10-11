'use client';

import { formatDate, formatTimestamp } from '@dear-steven/core/format';
import type { Citation, PassageContext } from '@dear-steven/core/schema';
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Copy01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useState } from 'react';
import { brand } from '@/brand';
import { initials, speakerLabel } from '@/components/answer/speaker';
import { useToast } from '@/components/ui/Toasts';
import RubberSegment from '@/components/vendor/react-bits/RubberSegment';
import { useI18n } from '@/i18n/I18nProvider';
import { fetchPassage } from '@/lib/api';
import { RelatedMoments } from './RelatedMoments';
import { VideoTab } from './VideoTab';

type Tab = 'quote' | 'context' | 'video';

interface PassageViewProps {
  citation: Citation;
  position: { index: number; total: number };
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
}

const cache = new Map<string, PassageContext>();

function usePassageContext(passageId: string) {
  const [state, setState] = useState<{ id: string; data: PassageContext | null; error: boolean }>(
    () => ({
      id: passageId,
      data: cache.get(passageId) ?? null,
      error: false,
    }),
  );
  useEffect(() => {
    const hit = cache.get(passageId);
    if (hit) {
      setState({ id: passageId, data: hit, error: false });
      return;
    }
    setState({ id: passageId, data: null, error: false });
    const ctrl = new AbortController();
    fetchPassage(passageId, ctrl.signal)
      .then((data) => {
        cache.set(passageId, data);
        setState({ id: passageId, data, error: false });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setState({ id: passageId, data: null, error: true });
      });
    return () => ctrl.abort();
  }, [passageId]);
  return state.id === passageId ? state : { id: passageId, data: null, error: false };
}

/** The source inspector's content, shared by the desktop panel and the mobile sheet. */
export function PassageView({
  citation,
  position,
  onPrev,
  onNext,
  onClose,
  headingRef,
}: PassageViewProps) {
  const [tab, setTab] = useState<Tab>('quote');
  const { t, locale } = useI18n();
  const who = speakerLabel(citation, t.speaker);
  const { toast } = useToast();
  const context = usePassageContext(citation.passageId);

  const copy = async () => {
    const parts = [
      `“${citation.excerpt}”`,
      `— ${who.short}${citation.speaker === 'unverified' ? t.inspector.copyConversation : ''}, ${brand.show}`,
      `“${citation.episode.title}”, ${formatTimestamp(citation.startMs)}`,
      citation.youtubeUrl ?? '',
    ];
    try {
      await navigator.clipboard.writeText(parts.filter(Boolean).join('\n'));
      toast({ id: 'copied', title: t.inspector.copied, tone: 'ember', duration: 2400 });
    } catch {
      toast({ id: 'copied', title: t.errors.clipboard, tone: 'error', duration: 2400 });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="sticky top-0 z-10 border-b border-ink-3 bg-[rgb(18_16_14/0.72)] px-5 pt-4 pb-4 backdrop-blur-xl backdrop-saturate-150">
        <div className="flex items-center justify-between gap-2">
          <SpeakerBadge citation={citation} />
          <div className="flex items-center gap-1">
            <span
              className="mr-1 font-mono text-[11px] whitespace-nowrap text-steel tabular"
              aria-live="polite"
            >
              {t.inspector.position(position.index + 1, position.total)}
            </span>
            <IconButton label={t.inspector.previous} onClick={onPrev} disabled={position.total < 2}>
              <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={2} />
            </IconButton>
            <IconButton label={t.inspector.next} onClick={onNext} disabled={position.total < 2}>
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={2} />
            </IconButton>
            <IconButton label={t.inspector.close} onClick={onClose}>
              <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
            </IconButton>
          </div>
        </div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          lang="en"
          className="mt-3 font-display text-[21px] leading-snug text-ivory-0 outline-none"
        >
          {citation.episode.title}
        </h2>
        <p className="mt-1.5 text-[13.5px] text-ivory-1">
          {citation.speaker === 'unverified'
            ? t.inspector.fromConversation(who.short)
            : t.inspector.saidBy(who.short)}
        </p>
        <p className="mt-0.5 font-mono text-[12px] text-steel">
          {formatDate(citation.episode.publishedAt, locale)} ·{' '}
          {t.inspector.inPodcast(formatTimestamp(citation.startMs))}
        </p>
        <div className="mt-4">
          <RubberSegment
            aria-label={t.inspector.tabsLabel}
            items={[
              { value: 'quote', label: t.inspector.tabs.quote },
              { value: 'context', label: t.inspector.tabs.context },
              { value: 'video', label: t.inspector.tabs.video },
            ]}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            size="sm"
            trackColor="var(--ink-2)"
            thumbColor="var(--ivory-0)"
            textColor="var(--ivory-1)"
            activeTextColor="var(--ink-0)"
            radius={999}
            className="w-full"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {tab === 'quote' ? <QuoteTab citation={citation} onCopy={copy} /> : null}
        {tab === 'context' ? <ContextTab citation={citation} context={context} /> : null}
        {tab === 'video' ? <VideoTab key={citation.id} citation={citation} /> : null}
      </div>
    </div>
  );
}

function SpeakerBadge({ citation }: { citation: Citation }) {
  const { t } = useI18n();
  const who = speakerLabel(citation, t.speaker);
  const base =
    'inline-flex items-center gap-2 whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-[11px]';
  if (citation.speaker === 'host') {
    return (
      <span className={`${base} bg-ember-tint text-ember-1`}>
        <span className="h-1.5 w-1.5 rounded-full bg-ember-0" aria-hidden="true" />
        {t.inspector.verifiedHost}
      </span>
    );
  }
  if (citation.speaker === 'guest') {
    return (
      <span className={`${base} bg-ink-3 text-ivory-0`}>
        <span
          aria-hidden="true"
          className="grid h-4 min-w-4 place-items-center rounded-full bg-ivory-0 px-[3px] text-[8.5px] font-semibold text-ink-0"
        >
          {initials(who.short)}
        </span>
        {t.inspector.verifiedGuest}
      </span>
    );
  }
  return (
    <span className={`${base} border border-dashed border-steel/60 text-steel`}>
      {t.inspector.notVerified}
    </span>
  );
}

function QuoteTab({ citation, onCopy }: { citation: Citation; onCopy: () => void }) {
  const { inspector } = useI18n().t;
  return (
    <div className="flex flex-col gap-5">
      <blockquote lang="en" className="font-display text-[20px] leading-[1.5] text-ivory-0 italic">
        <span className="text-ember-0" aria-hidden="true">
          “
        </span>
        {citation.excerpt}
        <span className="text-ember-0" aria-hidden="true">
          ”
        </span>
      </blockquote>
      <p className="font-mono text-[11.5px] leading-relaxed text-steel">
        {inspector.verbatim}
        {citation.quality === 'asr' ? inspector.asr : ''}
        {citation.speaker === 'unverified' ? inspector.unverifiedNote : ''}
      </p>
      {citation.relevance ? (
        <section className="rounded-[var(--radius-card)] border border-ink-3 bg-ink-2/60 px-4 py-3">
          <h3 className="font-mono text-[10.5px] tracking-[0.14em] text-ember-0 uppercase">
            {inspector.whyCited}
          </h3>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-ivory-1">{citation.relevance}</p>
          <p className="mt-2 text-[11.5px] text-ivory-2">{inspector.aiNote}</p>
        </section>
      ) : null}
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex w-fit items-center gap-2 rounded-full border border-ink-3 px-3.5 py-2 text-[13px] text-ivory-1 transition-colors hover:border-ink-4 hover:bg-ink-2 hover:text-ivory-0"
      >
        <HugeiconsIcon icon={Copy01Icon} size={14} strokeWidth={2} />
        {inspector.copy}
      </button>
      <RelatedMoments key={citation.passageId} passageId={citation.passageId} />
    </div>
  );
}

function ContextTab({
  citation,
  context,
}: {
  citation: Citation;
  context: { data: PassageContext | null; error: boolean };
}) {
  const { t, locale } = useI18n();
  if (context.error) return <p className="text-[14px] text-oxblood-1">{t.errors.passage}</p>;
  if (!context.data) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        {['100%', '86%', '94%', '60%'].map((w) => (
          <span key={w} className="block h-3 rounded-full bg-ink-2" style={{ width: w }} />
        ))}
      </div>
    );
  }
  const { before, after, citation: passage } = context.data;
  const text = passage.text;
  const span = citation.quoteSpan;
  const line = 'grid grid-cols-[3.25rem_1fr] gap-3 text-[14.5px] leading-[1.65]';

  return (
    <div lang="en" className="flex flex-col gap-4">
      {before.map((b) => (
        <p key={`b-${b.startMs}`} className={`${line} text-ivory-2`}>
          <span className="pt-0.5 font-mono text-[11px] text-steel tabular">
            {formatTimestamp(b.startMs)}
          </span>
          <span>{b.text}</span>
        </p>
      ))}
      {context.data.lines && !span ? (
        context.data.lines.map((l) => (
          <p key={`l-${l.startMs}`} className={`${line} text-ivory-0`}>
            <span className="pt-0.5 font-mono text-[11px] text-ember-0 tabular">
              {formatTimestamp(l.startMs)}
            </span>
            <span>
              <span
                lang={locale}
                className={`mr-1.5 font-mono text-[11px] tracking-[0.06em] uppercase ${l.speaker === 'host' ? 'text-ember-1' : l.speaker === 'guest' ? 'text-ivory-1' : 'text-steel'}`}
              >
                {l.speaker === 'host'
                  ? brand.host.firstName
                  : l.speaker === 'guest'
                    ? (l.speakerName ?? t.speaker.guest)
                    : t.speaker.unknown}
              </span>
              {l.text}
            </span>
          </p>
        ))
      ) : (
        <p className={`${line} text-ivory-0`}>
          <span className="pt-0.5 font-mono text-[11px] text-ember-0 tabular">
            {formatTimestamp(passage.startMs)}
          </span>
          <span>
            {span ? (
              <>
                {text.slice(0, span.start)}
                <mark className="rounded-[3px] bg-ember-tint px-0.5 text-ivory-0">
                  {text.slice(span.start, span.end)}
                </mark>
                {text.slice(span.end)}
              </>
            ) : (
              <mark className="bg-transparent text-ivory-0 [box-shadow:inset_2px_0_0_var(--ember-0)] [padding-left:8px]">
                {text}
              </mark>
            )}
          </span>
        </p>
      )}
      {after.map((a) => (
        <p key={`a-${a.startMs}`} className={`${line} text-ivory-2`}>
          <span className="pt-0.5 font-mono text-[11px] text-steel tabular">
            {formatTimestamp(a.startMs)}
          </span>
          <span>{a.text}</span>
        </p>
      ))}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-full text-ivory-2 transition-colors hover:bg-ink-3 hover:text-ivory-0 disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  );
}
