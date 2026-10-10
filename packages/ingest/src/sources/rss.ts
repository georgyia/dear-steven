import { extractGuestNames } from '@dear-steven/core/ingest';
import type { EpisodeInput } from '@dear-steven/core/store';
import { XMLParser } from 'fast-xml-parser';
import { fetchJson, fetchText } from '../lib/http.ts';

/** The Diary Of A CEO on Apple Podcasts; the lookup returns the publisher's current RSS URL. */
export const APPLE_SHOW_ID = '1291423644';

export async function resolveFeedUrl(): Promise<string> {
  const res = await fetchJson<{ results?: { feedUrl?: string }[] }>(
    `https://itunes.apple.com/lookup?id=${APPLE_SHOW_ID}`,
  );
  const url = res.results?.[0]?.feedUrl;
  if (!url) throw new Error('Apple Podcasts lookup returned no feed URL. Pass one with --feed.');
  return url;
}

export async function fetchFeed(url: string): Promise<string> {
  return fetchText(url, 120_000);
}

type Node = Record<string, unknown>;

const text = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (v && typeof v === 'object' && '#text' in v) return text((v as Node)['#text']);
  return '';
};

const list = (v: unknown): Node[] => (Array.isArray(v) ? (v as Node[]) : v ? [v as Node] : []);

const stripHtml = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** `5817`, `1:36:57` or `96:57` → milliseconds. */
export function parseItunesDuration(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const parts = s.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  const seconds = parts.reduce((acc, n) => acc * 60 + n, 0);
  return seconds > 0 ? seconds * 1000 : null;
}

/**
 * Parses the official feed into episode inputs. Only `text/vtt` transcripts are taken: they carry
 * timestamps; other transcript types would not let us cite a moment.
 */
export function parseFeed(xml: string): EpisodeInput[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    processEntities: true,
    htmlEntities: true,
    trimValues: true,
  });
  const doc = parser.parse(xml) as Node;
  const channel = (doc.rss as Node | undefined)?.channel as Node | undefined;
  if (!channel) throw new Error('Not an RSS feed (no <rss><channel>).');

  return list(channel.item).flatMap((item): EpisodeInput[] => {
    const title = text(item.title).trim();
    const guid = text(item.guid).trim() || text((item.enclosure as Node | undefined)?.['@_url']);
    const published = new Date(text(item.pubDate));
    if (!title || !guid || Number.isNaN(published.getTime())) return [];

    const type = text(item['itunes:episodeType']).toLowerCase();
    const transcripts = list(item['podcast:transcript']);
    const vtt = transcripts.find((t) => text(t['@_type']) === 'text/vtt');
    const description = stripHtml(
      text(item['content:encoded']) || text(item.description) || text(item['itunes:summary']),
    );

    return [
      {
        sourceGuid: guid,
        title,
        description: description.slice(0, 8000),
        publishedAt: published.toISOString(),
        durationMs: parseItunesDuration(text(item['itunes:duration'])),
        episodeType: type === 'bonus' ? 'bonus' : type === 'trailer' ? 'trailer' : 'full',
        guestNames: extractGuestNames(title),
        audioUrl: text((item.enclosure as Node | undefined)?.['@_url']) || null,
        transcriptUrl: vtt ? text(vtt['@_url']) || null : null,
      },
    ];
  });
}
