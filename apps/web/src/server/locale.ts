import 'server-only';
import { isUiLocale, type UiLocale, uiLocaleFrom } from '@dear-steven/core/copy';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE } from '@/i18n';

/** The interface language for this request: the visitor's saved choice, else their browser's. */
export async function requestUiLocale(): Promise<UiLocale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (saved && isUiLocale(saved)) return saved;
  return uiLocaleFrom((await headers()).get('accept-language'));
}
