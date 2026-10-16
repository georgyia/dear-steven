import type { Metadata } from 'next';
import Link from 'next/link';
import { brand } from '@/brand';
import { CONTACT, CONTACT_PENDING, OPERATOR, OPERATOR_PENDING } from '@/content/policies';
import { MESSAGES } from '@/i18n';
import { requestUiLocale } from '@/server/locale';

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = MESSAGES[await requestUiLocale()];
  return { title: meta.legalTitle, description: meta.legalDescription };
}

const eyebrow = 'mb-2 font-mono text-[11px] tracking-[0.16em] text-steel uppercase';
const link = 'text-ivory-0 underline decoration-ink-4 underline-offset-2 hover:decoration-ember-0';

/**
 * The legal notice (Impressum, #116): who runs this copy and how to reach them, from `OPERATOR`
 * and `CONTACT` — the same place the privacy notice names its controller. Until the owner fills
 * them in, it says so in the same words as everywhere else. Like the terms, it opens without the
 * access code.
 */
export default async function LegalPage() {
  const locale = await requestUiLocale();
  const t = MESSAGES[locale];
  const copy = t.legalPage;
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

      <section className="mt-10">
        <h2 className={eyebrow}>{copy.operatorHeading}</h2>
        {OPERATOR ? (
          <address className="not-italic">
            <span className="block text-ivory-0">{OPERATOR.name}</span>
            {OPERATOR.address.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
            <span className="mt-2 block">
              {copy.email}:{' '}
              <a href={`mailto:${OPERATOR.email}`} className={link}>
                {OPERATOR.email}
              </a>
            </span>
          </address>
        ) : (
          <p lang="en">{OPERATOR_PENDING}</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className={eyebrow}>{copy.contactHeading}</h2>
        {CONTACT ? <p>{CONTACT}</p> : <p lang="en">{CONTACT_PENDING}</p>}
      </section>

      <p className="mt-12 border-t border-ink-3 pt-4 text-[13px] text-ivory-2">
        <a href="/terms" className={link}>
          {t.termsPage.title}
        </a>
      </p>
    </main>
  );
}
