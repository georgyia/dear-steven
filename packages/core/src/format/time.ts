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

/** Spoken form for screen readers: "32 minutes 14 seconds". */
export function spokenTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [
    h ? `${h} hour${h === 1 ? '' : 's'}` : '',
    m ? `${m} minute${m === 1 ? '' : 's'}` : '',
    s || (!h && !m) ? `${s} second${s === 1 ? '' : 's'}` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `8 Oct 2026`, computed in UTC so server and client render identically. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Short label for an episode: its first guest, else a trimmed title. */
export function episodeLabel(episode: { guestNames: string[]; title: string }): string {
  const guest = episode.guestNames[0];
  if (guest) return guest;
  const head = episode.title.split(/[:|–—-]/)[0]?.trim() ?? episode.title;
  return head.length > 32 ? `${head.slice(0, 31).trimEnd()}…` : head;
}
