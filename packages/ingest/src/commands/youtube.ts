import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { requireKey } from '@dear-steven/core/config';
import { isYouTubeVideoId } from '@dear-steven/core/youtube';
import type { Context } from '../context.ts';
import { c } from '../lib/output.ts';
import { listUploads } from '../sources/youtube-api.ts';
import { CONFIDENT_SCORE, MIN_VIDEO_MS, matchEpisodes } from '../sources/youtube-match.ts';
import { matchReport } from './youtube-report.ts';

/**
 * Stage 2: map episodes to their YouTube videos so citations can open at the right moment. Without
 * --refresh, episodes already linked keep their video (and their videos stay theirs); with it,
 * every full episode is matched again and a manual `align` is overwritten.
 */
export async function matchYouTube(ctx: Context, opts: { refresh: boolean }) {
  const key = requireKey('YOUTUBE_API_KEY', ctx.config.youtubeApiKey);
  const run = ctx.store.startRun(null, 'match-youtube');
  try {
    const videos = await listUploads(key, undefined, (n) =>
      process.stdout.write(`\r${c.dim(`${n} uploads listed…`)}`),
    );
    process.stdout.write('\n');
    const full = ctx.store.listEpisodes({ types: ['full'] });
    const kept = opts.refresh ? [] : full.filter((e) => e.youtubeVideoId !== null);
    const episodes = opts.refresh ? full : full.filter((e) => e.youtubeVideoId === null);
    const result = matchEpisodes(episodes, videos, {
      taken: new Set(kept.flatMap((e) => (e.youtubeVideoId ? [e.youtubeVideoId] : []))),
      measured: kept
        .filter((e) => e.youtubeAlignment === 'exact')
        .map((e) => ({ publishedAt: e.publishedAt, offsetMs: e.youtubeOffsetMs })),
    });
    for (const m of result.matches) {
      ctx.store.setYouTube(m.episodeId, {
        videoId: m.videoId,
        durationMs: m.durationMs,
        offsetMs: m.offsetMs,
        offsetSteps: m.offsetSteps,
        alignment: m.alignment,
      });
    }

    const reportPath = join(ctx.dataDir, 'reports', 'youtube-match.md');
    mkdirSync(join(ctx.dataDir, 'reports'), { recursive: true });
    writeFileSync(
      reportPath,
      matchReport({
        result,
        episodes: new Map(full.map((e) => [e.id, e])),
        videos: new Map(videos.map((v) => [v.videoId, v])),
        store: ctx.store,
      }),
    );

    const { matches, unmatched } = result;
    const exact = matches.filter((m) => m.alignment === 'exact').length;
    const doubtful = matches.filter((m) => m.confidence < CONFIDENT_SCORE).length;
    const long = videos.filter((v) => (v.durationMs ?? 0) >= MIN_VIDEO_MS).length;
    ctx.store.finishRun(run, 'done', {
      meta: { videos: videos.length, matched: matches.length, exact, unmatched: unmatched.length },
    });
    console.log(
      `Matched ${matches.length} of ${episodes.length} episodes to ${long} full-length uploads (of ${videos.length}; Shorts and clips skipped): ${exact} exact (measured on chapters), ${matches.length - exact} estimated (shown as ≈).`,
    );
    console.log(
      `${unmatched.length} unmatched · ${doubtful} below ${CONFIDENT_SCORE} to check · report: ${relative(ctx.root, reportPath)}`,
    );
    if (unmatched.length) {
      console.log(
        c.dim('Fix one by hand: pnpm ingest align <episode> --video <id> [--offset <seconds>]'),
      );
    }
  } catch (error) {
    ctx.store.finishRun(run, 'failed', { error: String(error) });
    throw error;
  }
}

/** Manual alignment override: set the video, the offset, or mark the timing exact. */
export function align(
  ctx: Context,
  ref: string,
  opts: { video?: string; offsetSeconds?: number; exact: boolean; unknown: boolean },
) {
  const [episode, ...rest] = ctx.store.findEpisodes(ref);
  if (!episode || rest.length)
    throw new Error(
      episode ? `"${ref}" matches several episodes.` : `No episode matches "${ref}".`,
    );
  const videoId = opts.video ?? episode.youtubeVideoId;
  if (videoId && !isYouTubeVideoId(videoId))
    throw new Error(`"${videoId}" is not a YouTube video id.`);
  const alignment = opts.unknown
    ? 'unknown'
    : opts.exact || opts.offsetSeconds !== undefined
      ? 'exact'
      : videoId
        ? 'estimated'
        : 'unknown';
  // A manual offset holds for the whole episode; without one, the measured steps stay (same video).
  const keepSteps = opts.offsetSeconds === undefined && videoId === episode.youtubeVideoId;
  ctx.store.setYouTube(episode.id, {
    videoId: videoId ?? null,
    durationMs: null,
    offsetMs:
      opts.offsetSeconds !== undefined ? opts.offsetSeconds * 1000 : episode.youtubeOffsetMs,
    offsetSteps: keepSteps ? episode.youtubeOffsetSteps : [],
    alignment,
  });
  console.log(
    `${episode.title}\n  video ${videoId ?? '—'} · offset ${(opts.offsetSeconds ?? episode.youtubeOffsetMs / 1000).toFixed(1)}s · ${alignment}`,
  );
}
