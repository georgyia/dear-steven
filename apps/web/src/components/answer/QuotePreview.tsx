import type { Citation } from '@dear-steven/core/schema';
import { useI18n } from '@/i18n/I18nProvider';
import { initials, speakerLabel } from './speaker';

const PREVIEW_CHARS = 320;
const clip = (text: string) =>
  text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS - 2).trimEnd()}…` : text;

/**
 * What hovering or focusing a source shows (P7-03): the words set like a quotation, who said them
 * and when, how far to trust the attribution, the conversation, and where a click goes. Shown in
 * the chip's tooltip; the chip's own label already says all of this to a screen reader.
 */
export function QuotePreview({ citation, time }: { citation: Citation; time: string }) {
  const { t } = useI18n();
  const who = speakerLabel(citation, t.speaker);
  const verified = citation.speaker !== 'unverified';
  return (
    <span className="flex w-[min(22rem,calc(100vw-48px))] flex-col gap-2.5 py-1.5 text-left font-normal">
      <span className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          {citation.speaker === 'host' ? (
            <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full bg-ember-0" />
          ) : (
            <span
              aria-hidden="true"
              className={`grid h-5 min-w-5 flex-none place-items-center rounded-full px-1 text-[9.5px] font-semibold ${verified ? 'bg-ivory-0 text-ink-0' : 'border border-dashed border-steel/70 text-steel'}`}
            >
              {initials(who.short)}
            </span>
          )}
          <span className="truncate text-[13.5px] font-semibold text-ivory-0">{who.short}</span>
        </span>
        <span className="flex-none font-mono text-[11px] text-steel tabular">{time}</span>
      </span>

      <span className="relative block pl-4">
        <span
          aria-hidden="true"
          className="absolute top-0.5 bottom-0.5 left-0 w-[2px] rounded-full bg-[linear-gradient(180deg,var(--ember-1),var(--ember-0)_60%,transparent)]"
        />
        <span
          lang="en"
          className="line-clamp-5 font-display text-[16px] leading-[1.45] text-ivory-0 italic"
          style={{ fontVariationSettings: '"opsz" 36, "SOFT" 50' }}
        >
          <span aria-hidden="true" className="text-ember-0">
            “
          </span>
          {clip(citation.excerpt)}
          <span aria-hidden="true" className="text-ember-0">
            ”
          </span>
        </span>
      </span>

      <span className="flex flex-col gap-1.5 border-t border-ink-3 pt-2.5">
        <span lang="en" className="truncate text-[12.5px] text-ivory-1">
          {citation.episode.title}
        </span>
        <span className="flex items-center justify-between gap-3">
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10.5px] ${verified ? 'bg-ember-tint text-ember-1' : 'border border-dashed border-steel/60 text-steel'}`}
          >
            {verified ? t.chip.previewVerified : t.answer.notVerified}
          </span>
          <span className="text-[11.5px] text-ivory-2">{t.chip.previewOpen}</span>
        </span>
      </span>
    </span>
  );
}
