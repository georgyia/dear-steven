'use client';

import { DEFAULT_UI_LOCALE, type UiLocale } from '@dear-steven/core/copy';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { LOCALE_COOKIE, MESSAGES, type Messages } from './index';

interface I18n {
  locale: UiLocale;
  t: Messages;
  setLocale: (locale: UiLocale) => void;
}

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const I18nContext = createContext<I18n>({
  locale: DEFAULT_UI_LOCALE,
  t: MESSAGES[DEFAULT_UI_LOCALE],
  setLocale: () => undefined,
});

/** The interface language, chosen on the server (cookie, then Accept-Language) and switchable. */
export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: UiLocale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState(initialLocale);
  const setLocale = useCallback((next: UiLocale) => {
    // biome-ignore lint/suspicious/noDocumentCookie: one non-sensitive preference; the Cookie Store API is not in Safari or Firefox.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
    document.documentElement.lang = next;
    setLocaleState(next);
  }, []);
  const value = useMemo(() => ({ locale, t: MESSAGES[locale], setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
