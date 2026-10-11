import { LOCALE_TAG, type UiLocale } from '@dear-steven/core/copy';

/** Dollars as the setup panel shows them: three decimals under a dollar, where cents matter. */
export function usd(x: number, locale: UiLocale): string {
  const digits = x < 1 ? 3 : 2;
  return `$${x.toLocaleString(LOCALE_TAG[locale], { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
