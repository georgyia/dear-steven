import type { UiLocale } from '@dear-steven/core/copy';
import { de } from './de';
import { en, type Messages } from './en';

export type { Messages };

export const MESSAGES: Record<UiLocale, Messages> = { en, de };

/** The visitor's explicit choice. A cookie, not localStorage, so the server renders in it too. */
export const LOCALE_COOKIE = 'dear-steven-locale';

/** Each language named in itself, for the language picker. */
export const LOCALE_NAMES: Record<UiLocale, string> = { en: 'English', de: 'Deutsch' };
