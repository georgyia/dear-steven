import type { Episode, YouTubeAlignment } from '@dear-steven/core/schema';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  durationMs: number | null;
}

export interface YouTubeMatch {
  episodeId: string;
  videoId: string;
  durationMs: number | null;
  offsetMs: number;
  alignment: YouTubeAlignment;
  confidence: number;
}

/** ISO-8601 duration (`PT1H28M24S`) → milliseconds. */
export function parseIsoDuration(iso: string): number | null {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(iso);
  if (!m) return null;
  const [, d = '0', h = '0', min = '0', s = '0'] = m;
  return Math.round(((Number(d) * 24 + Number(h)) * 3600 + Number(min) * 60 + Number(s)) * 1000);
}

const words = (title: string) =>
  new Set(
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/&#?\w+;/g, ' ')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );

/** Jaccard similarity of title word sets. */
export function titleSimilarity(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter += 1;
  return inter / (A.size + B.size - inter);
}

const DAY = 86_400_000;
/** Podcast and video durations within this window are treated as the same edit. */
export const SAME_EDIT_TOLERANCE_MS = 8_000;

/**
 * Maps podcast episodes to YouTube uploads by title similarity inside a ±4-day publication window.
 * Alignment is honest about what we know: durations within a few seconds ⇒ `exact` with offset 0;
 * otherwise `estimated` (the UI shows "≈") — dynamic ad insertion and different intros make the
 * podcast and video drift, and only a manual `ingest align` makes it exact.
 */
export function matchEpisodes(
  episodes: Episode[],
  videos: YouTubeVideo[],
  minScore = 0.45,
): YouTubeMatch[] {
  const used = new Set<string>();
  const matches: YouTubeMatch[] = [];
  const candidates = episodes
    .filter((e) => e.episodeType === 'full')
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  for (const episode of candidates) {
    const when = Date.parse(episode.publishedAt);
    let best: { video: YouTubeVideo; score: number } | null = null;
    for (const video of videos) {
      if (used.has(video.videoId)) continue;
      const gap = Math.abs(Date.parse(video.publishedAt) - when);
      if (gap > 4 * DAY) continue;
      const score = titleSimilarity(episode.title, video.title) - (gap / DAY) * 0.02;
      if (score >= minScore && (!best || score > best.score)) best = { video, score };
    }
    if (!best) continue;
    used.add(best.video.videoId);
    const sameEdit =
      episode.durationMs !== null &&
      best.video.durationMs !== null &&
      Math.abs(episode.durationMs - best.video.durationMs) <= SAME_EDIT_TOLERANCE_MS;
    matches.push({
      episodeId: episode.id,
      videoId: best.video.videoId,
      durationMs: best.video.durationMs,
      offsetMs: 0,
      alignment: sameEdit ? 'exact' : 'estimated',
      confidence: Math.min(1, best.score),
    });
  }
  return matches;
}
