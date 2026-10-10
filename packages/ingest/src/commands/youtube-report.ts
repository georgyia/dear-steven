import type { Episode } from '@dear-steven/core/schema';
import type { KnowledgeStore } from '@dear-steven/core/store';
import { resolveMoment } from '@dear-steven/core/youtube';
import {
  CONFIDENT_SCORE,
  type MatchResult,
  type YouTubeMatch,
  type YouTubeVideo,
} from '../sources/youtube-match.ts';

/**
 * The match report a person reads after `match-youtube` (P6-15): what is matched and how well,
 * what isn't, and a fixed sample to spot-check (`plan/human/youtube-spot-check.md`). Written to
 * `data/reports/`, never committed — it names videos by their YouTube titles.
 */

const SAMPLE = 20;

const minutes = (ms: number | null) => (ms === null ? '—' : `${Math.round(ms / 60_000)} min`);
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hms = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60];
  return hms.map((n, i) => (i === 0 ? String(n) : String(n).padStart(2, '0'))).join(':');
};
const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const date = (iso: string) => iso.slice(0, 10);
const watch = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;

/** Every n-th item, so the sample spans the whole catalogue and is the same on every run. */
function spread<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  const step = items.length / count;
  const picks = new Set(Array.from({ length: count }, (_, i) => Math.floor(i * step)));
  return items.filter((_, i) => picks.has(i));
}

export interface ReportInput {
  result: MatchResult;
  episodes: Map<string, Episode>;
  videos: Map<string, YouTubeVideo>;
  store: KnowledgeStore;
  now?: Date;
}

/** One transcript line about a third of the way in, and where the video should say it. */
function moment(store: KnowledgeStore, episode: Episode, match: YouTubeMatch) {
  const count = store.segmentCount(episode.id);
  if (count === 0) return null;
  const [segment] = store.getSegments(episode.id, Math.floor(count / 3), Math.floor(count / 3));
  if (!segment) return null;
  const resolved = resolveMoment({
    videoId: match.videoId,
    startMs: segment.startMs,
    offsetMs: match.offsetMs,
    alignment: match.alignment,
  });
  return { segment, url: resolved.url };
}

export function matchReport({ result, episodes, videos, store, now = new Date() }: ReportInput) {
  const { matches, unmatched } = result;
  const exact = matches.filter((m) => m.alignment === 'exact');
  const estimated = matches.filter((m) => m.alignment === 'estimated');
  const doubtful = matches.filter((m) => m.confidence < CONFIDENT_SCORE);
  const total = matches.length + unmatched.length;
  const ep = (id: string) => episodes.get(id) as Episode;
  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);

  push(
    `# YouTube matches — ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    '',
    `Matched **${matches.length} of ${total}** full episodes in this run: ${exact.length} exact (offset measured on shared chapters), ${estimated.length} estimated (shown as ≈), ${unmatched.length} unmatched. ${doubtful.length} matches scored below ${CONFIDENT_SCORE} and are listed for checking.`,
    '',
    '## Spot check: is it the right video?',
    '',
    'Open each link. It should be the same conversation as the podcast episode.',
    '',
    '| # | Podcast episode | Date | Video | Score | Right video? |',
    '|---|---|---|---|---|---|',
  );
  spread(matches, SAMPLE).forEach((m, i) => {
    const video = videos.get(m.videoId);
    push(
      `| ${i + 1} | ${cell(ep(m.episodeId).title)} | ${date(ep(m.episodeId).publishedAt)} | [${cell(video?.title ?? m.videoId)}](${watch(m.videoId)}) | ${m.confidence} | |`,
    );
  });

  const timed = estimated.flatMap((m) => {
    const found = moment(store, ep(m.episodeId), m);
    return found?.url ? [{ m, ...found }] : [];
  });
  push(
    '',
    '## Spot check: estimated timestamps',
    '',
    timed.length
      ? 'Each link should start within ten seconds of these words. Only episodes with a transcript can be listed.'
      : 'No estimated match has a transcript yet. Run `pnpm ingest transcribe` first.',
    '',
  );
  if (timed.length) {
    push(
      '| # | Episode | Podcast at | The words | Video | Within 10 s? |',
      '|---|---|---|---|---|---|',
    );
    spread(timed, SAMPLE).forEach(({ m, segment, url }, i) => {
      push(
        `| ${i + 1} | ${cell(ep(m.episodeId).title)} | ${clock(segment.startMs)} | “${cell(segment.text.slice(0, 120))}” | [≈ ${clock(segment.startMs + m.offsetMs)}](${url}) | |`,
      );
    });
  }

  push(
    '',
    `## Low confidence (score below ${CONFIDENT_SCORE})`,
    '',
    '| Podcast episode | Video | Days apart | Length gap | Title overlap | Guest named | Shared chapters | Score |',
    '|---|---|---|---|---|---|---|---|',
  );
  for (const m of doubtful) {
    const e = m.evidence;
    push(
      `| ${cell(ep(m.episodeId).title)} (${date(ep(m.episodeId).publishedAt)}) | [${cell(videos.get(m.videoId)?.title ?? m.videoId)}](${watch(m.videoId)}) | ${e.dayGap.toFixed(1)} | ${minutes(e.durationGapMs)} | ${e.titleSimilarity.toFixed(2)} | ${e.guestInTitle ? 'yes' : 'no'} | ${e.sharedChapters} | ${m.confidence} |`,
    );
  }

  push('', '## Unmatched', '', '| Date | Podcast episode | Length |', '|---|---|---|');
  for (const id of unmatched) {
    const e = ep(id);
    push(`| ${date(e.publishedAt)} | ${cell(e.title)} | ${minutes(e.durationMs)} |`);
  }
  push('', 'Fix one by hand: `pnpm ingest align <episode> --video <id> [--offset <seconds>]`.', '');
  return lines.join('\n');
}
