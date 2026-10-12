import type { UiLocale } from '../persona/copy.ts';
import type { TimestampState } from '../schema/index.ts';

/** `32:14`, or `1:02:03` past the hour. */
export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Prefixes `≈` when the video position is estimated; empty string when unknown. */
export function formatMoment(ms: number, state: TimestampState): string {
  if (state === 'unknown') return '';
  return state === 'estimated' ? `≈ ${formatTimestamp(ms)}` : formatTimestamp(ms);
}

const UNITS: Record<UiLocale, Record<'h' | 'm' | 's', [one: string, other: string]>> = {
  en: { h: ['hour', 'hours'], m: ['minute', 'minutes'], s: ['second', 'seconds'] },
  de: { h: ['Stunde', 'Stunden'], m: ['Minute', 'Minuten'], s: ['Sekunde', 'Sekunden'] },
};

/** Spoken form for screen readers: "32 minutes 14 seconds", "32 Minuten 14 Sekunden". */
export function spokenTimestamp(ms: number, locale: UiLocale = 'en'): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const unit = (n: number, key: 'h' | 'm' | 's') => `${n} ${UNITS[locale][key][n === 1 ? 0 : 1]}`;
  const parts = [h ? unit(h, 'h') : '', m ? unit(m, 'm') : '', s || (!h && !m) ? unit(s, 's') : ''];
  return parts.filter(Boolean).join(' ');
}

/**
 * Written out rather than taken from Intl: month abbreviations differ between ICU versions
 * ("Sep"/"Sept"), and a date rendered on the server must match the browser's to the letter.
 */
const MONTHS: Record<UiLocale, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  de: [
    'Jan.',
    'Feb.',
    'März',
    'Apr.',
    'Mai',
    'Juni',
    'Juli',
    'Aug.',
    'Sept.',
    'Okt.',
    'Nov.',
    'Dez.',
  ],
};

/** `8 Oct 2026` / `8. Okt. 2026`, computed in UTC so server and client render identically. */
export function formatDate(iso: string, locale: UiLocale = 'en'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const month = MONTHS[locale][d.getUTCMonth()];
  return locale === 'de'
    ? `${d.getUTCDate()}. ${month} ${d.getUTCFullYear()}`
    : `${d.getUTCDate()} ${month} ${d.getUTCFullYear()}`;
}

/** How long an episode is marked new in the explorer (P6-16). */
export const NEW_EPISODE_DAYS = 7;

/** Published within the last `NEW_EPISODE_DAYS` (and not in the future). */
export function isNewEpisode(publishedAt: string, now: Date = new Date()): boolean {
  const age = now.getTime() - new Date(publishedAt).getTime();
  return age >= 0 && age < NEW_EPISODE_DAYS * 86_400_000;
}

/** Short label for an episode: its first guest, else a trimmed title. */
export function episodeLabel(episode: { guestNames: string[]; title: string }): string {
  const guest = episode.guestNames[0];
  if (guest) return guest;
  const head = episode.title.split(/[:|–—-]/)[0]?.trim() ?? episode.title;
  return head.length > 32 ? `${head.slice(0, 31).trimEnd()}…` : head;
}
