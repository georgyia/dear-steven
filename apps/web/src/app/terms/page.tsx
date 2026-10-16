import { formatDate } from '@dear-steven/core/format';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { brand } from '@/brand';
import { POLICIES, POLICIES_UPDATED } from '@/content/policies';
import { MESSAGES } from '@/i18n';
import { requestUiLocale } from '@/server/locale';

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = MESSAGES[await requestUiLocale()];
  return { title: meta.termsTitle, description: meta.termsDescription };
}

const anchor = (file: string) => file.replace('.md', '').toLowerCase();

/** Repository links in the shared text, pointed at where a reader of this page can follow them. */
const HREF: Record<string, string> = {
  'DISCLAIMER.md': '#disclaimer',
  'TERMS.md': '#terms',
  'PRIVACY.md': '#privacy',
  LICENSE: 'https://polyformproject.org/licenses/noncommercial/1.0.0',
};

/** `[text](url)` → a link; `code` → code. The only markup the policies use. */
function inline(text: string, newTab: ReactNode): ReactNode[] {
  return text.split(/(\[[^\]]+\]\([^)]+\)|`[^`]+`)/g).map((part, i) => {
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link?.[1] && link[2]) {
      const href = HREF[link[2]] ?? link[2];
      const external = href.startsWith('https://');
      return (
        <a
          // biome-ignore lint/suspicious/noArrayIndexKey: static text, never reordered
          key={i}
          href={href}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="text-ivory-0 underline decoration-ink-4 underline-offset-2 hover:decoration-ember-0"
        >
          {link[1]}
          {external ? newTab : null}
        </a>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: static text, never reordered
        <code key={i} className="rounded bg-ink-2 px-1 py-0.5 font-mono text-[0.9em] text-ivory-1">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/**
 * The terms, the disclaimer and the privacy note, in one readable page (P6-12). The page's own
 * words follow the visitor's language; the policy text is English only until it is reviewed.
 */
export default async function TermsPage() {
  const locale = await requestUiLocale();
  const t = MESSAGES[locale];
  const copy = t.termsPage;
  const newTab = (
    <span className="sr-only" lang={locale}>
      {copy.newTab}
    </span>
  );
  return (
    <main className="relative z-10 mx-auto w-full max-w-[44rem] px-4 pt-12 pb-24 text-[15.5px] leading-relaxed text-ivory-1">
      <Link
        href="/"
        className="font-mono text-[11px] tracking-[0.16em] text-steel uppercase hover:text-ivory-1"
      >
        ← {brand.name}
      </Link>
      <h1 className="mt-6 font-display text-[40px] leading-tight text-ivory-0 sm:text-[48px]">
        {copy.title}
      </h1>
      <p className="mt-4 text-ivory-2">{t.disclosure}</p>
      {copy.englishOnly ? <p className="mt-3 text-ivory-2">{copy.englishOnly}</p> : null}
      <nav aria-label={copy.onThisPage} className="mt-6 flex flex-wrap gap-2">
        {POLICIES.map((p) => (
          <a
            key={p.file}
            href={`#${anchor(p.file)}`}
            lang="en"
            className="rounded-full border border-ink-3 px-3 py-1 font-mono text-[11px] text-ivory-1 hover:border-ink-4 hover:text-ivory-0"
          >
            {p.title}
          </a>
        ))}
        <a
          href="/legal"
          className="rounded-full border border-ink-3 px-3 py-1 font-mono text-[11px] text-ivory-1 hover:border-ink-4 hover:text-ivory-0"
        >
          {t.terms.legalLink}
        </a>
      </nav>
      {POLICIES.map((policy) => (
        <section key={policy.file} id={anchor(policy.file)} lang="en" className="mt-12 scroll-mt-8">
          <h2 className="font-display text-[28px] leading-snug text-ivory-0">{policy.title}</h2>
          {policy.sections.map((section) => (
            <div key={section.heading} className="mt-6">
              <h3 className="mb-2 font-mono text-[11px] tracking-[0.16em] text-steel uppercase">
                {section.heading}
              </h3>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="mt-2">
                  {inline(paragraph, newTab)}
                </p>
              ))}
            </div>
          ))}
        </section>
      ))}
      <div className="mt-12 border-t border-ink-3 pt-4 text-[13px] text-ivory-2">
        <p>{copy.updated(formatDate(POLICIES_UPDATED, locale))}</p>
        <p className="mt-2">
          <a
            href="/legal"
            className="text-ivory-0 underline decoration-ink-4 underline-offset-2 hover:decoration-ember-0"
          >
            {t.terms.legalLink}
          </a>
        </p>
      </div>
    </main>
  );
}
