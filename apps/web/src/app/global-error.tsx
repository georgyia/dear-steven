'use client';

import { DEFAULT_UI_LOCALE, isUiLocale, type UiLocale, uiLocaleFrom } from '@dear-steven/core/copy';
import { useEffect, useState } from 'react';
import { brand } from '@/brand';
import { CrashPage } from '@/components/ui/FallbackPage';
import { LOCALE_COOKIE, MESSAGES } from '@/i18n';
import { fontVariables } from './fonts';
import '@/styles/globals.css';

/** The visitor's language as the root layout picks it: their saved choice, else their browser's. */
function browserLocale(): UiLocale {
  const saved = document.cookie
    .split('; ')
    .find((pair) => pair.startsWith(`${LOCALE_COOKIE}=`))
    ?.slice(LOCALE_COOKIE.length + 1);
  if (saved && isUiLocale(saved)) return saved;
  return uiLocaleFrom(navigator.languages.join(','));
}

/**
 * A crash in the root layout itself (P10-09). It replaces the whole document, so it brings its own
 * `<html>`, styles and fonts, and finds the visitor's language in the browser, since the layout
 * that would have said is what failed (English until then). Never shows the error.
 */
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const [locale, setLocale] = useState<UiLocale>(DEFAULT_UI_LOCALE);
  useEffect(() => setLocale(browserLocale()), []);
  return (
    <html lang={locale} className={fontVariables}>
      <body>
        <title>{brand.name}</title>
        <CrashPage t={MESSAGES[locale]} retry={retry} />
      </body>
    </html>
  );
}
