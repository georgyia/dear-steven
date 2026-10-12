'use client';

import { SHOW_CHANNEL_URL } from '@dear-steven/core/youtube';
import { brand } from '@/brand';
import { Dialog } from '@/components/ui/Dialog';
import { YouTubeLink } from '@/components/ui/YouTubeLink';
import { useI18n } from '@/i18n/I18nProvider';

/** "How this works": the persona, the four kinds of statement, and what happens to your data. */
export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const copy = t.about;
  return (
    <Dialog open={open} onClose={onClose} eyebrow={copy.eyebrow} title={copy.title} width="lg">
      <div className="flex flex-col gap-6 text-[15px] leading-relaxed text-ivory-1">
        <p>{copy.intro}</p>

        <section>
          <h3 className="mb-3 font-mono text-[11px] tracking-[0.16em] text-steel uppercase">
            {copy.kinds}
          </h3>
          <dl className="grid gap-3 sm:grid-cols-[auto_1fr] sm:gap-x-5">
            <Legend
              chip={
                <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-ember-tint px-2 font-mono text-[11.5px] text-ember-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-ember-0" />
                  {brand.host.firstName}
                  <span className="tabular opacity-70">32:14</span>
                </span>
              }
              {...copy.host}
            />
            <Legend
              chip={
                <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-ink-3 px-2 font-mono text-[11.5px] text-ivory-0">
                  <span className="grid h-[15px] min-w-[15px] place-items-center rounded-full bg-ivory-0 text-[8.5px] font-semibold text-ink-0">
                    {copy.guest.chip[0]}
                  </span>
                  {copy.guest.chip}
                  <span className="tabular opacity-70">32:14</span>
                </span>
              }
              title={copy.guest.title}
              body={copy.guest.body}
            />
            <Legend
              chip={
                <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-dashed border-steel/60 px-2 font-mono text-[11.5px] text-steel">
                  {copy.episode.chip}
                  <span className="tabular opacity-70">32:14</span>
                </span>
              }
              title={copy.episode.title}
              body={copy.episode.body}
            />
            <Legend
              chip={<span className="text-[15px] text-ivory-1">{copy.synthesis.chip}</span>}
              title={copy.synthesis.title}
              body={copy.synthesis.body}
            />
          </dl>
        </section>

        <section>
          <h3 className="mb-2 font-mono text-[11px] tracking-[0.16em] text-steel uppercase">
            {copy.checkedHeading}
          </h3>
          <p>{copy.checked}</p>
        </section>

        <section>
          <h3 className="mb-2 font-mono text-[11px] tracking-[0.16em] text-steel uppercase">
            {copy.originalsHeading}
          </h3>
          <p>{copy.originals}</p>
          <p className="mt-3">
            <YouTubeLink href={SHOW_CHANNEL_URL}>{t.youtube.channel}</YouTubeLink>
          </p>
        </section>

        <section>
          <h3 className="mb-2 font-mono text-[11px] tracking-[0.16em] text-steel uppercase">
            {copy.dataHeading}
          </h3>
          <p>{copy.data}</p>
          <p className="mt-3">
            {copy.fullVersion}{' '}
            <a
              href="/terms"
              className="text-ivory-0 underline decoration-ink-4 underline-offset-2 hover:decoration-ember-0"
            >
              {t.terms.link}
            </a>
            .
          </p>
        </section>
      </div>
    </Dialog>
  );
}

function Legend({ chip, title, body }: { chip: React.ReactNode; title: string; body: string }) {
  return (
    <>
      <dt className="pt-0.5">{chip}</dt>
      <dd className="mb-2 sm:mb-0">
        <span className="text-ivory-0">{title}.</span> <span className="text-ivory-2">{body}</span>
      </dd>
    </>
  );
}
