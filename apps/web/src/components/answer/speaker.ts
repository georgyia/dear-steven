import { episodeLabel } from '@dear-steven/core/format';
import type { Citation } from '@dear-steven/core/schema';
import { brand } from '@/brand';

/** Who said a cited passage, in the UI's words. One source of truth for chips, quotes and drawer. */
export function speakerLabel(c: Pick<Citation, 'speaker' | 'speakerName' | 'episode'>): {
  short: string;
  long: string;
} {
  const guest = episodeLabel(c.episode);
  switch (c.speaker) {
    case 'host':
      return {
        short: brand.host.firstName,
        long: `${brand.host.fullName} (host) — verified speaker`,
      };
    case 'guest': {
      const name = c.speakerName ?? guest;
      return { short: name, long: `${name} — verified speaker` };
    }
    case 'unverified':
      return { short: guest, long: `From the conversation with ${guest} — speaker not verified` };
  }
}

export function initials(name: string): string {
  const words = name
    .replace(/^(dr|prof|sir|dame)\.?\s+/i, '')
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w));
  return (
    (
      (words[0]?.[0] ?? '') + (words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '')
    ).toUpperCase() || '·'
  );
}
