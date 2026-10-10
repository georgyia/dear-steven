import { requireKey } from '@dear-steven/core/config';
import { isYouTubeVideoId } from '@dear-steven/core/youtube';
import type { Context } from '../context.ts';
import { c } from '../lib/output.ts';
import { listUploads } from '../sources/youtube-api.ts';
import { matchEpisodes } from '../sources/youtube-match.ts';

/** Stage 2: map episodes to their YouTube videos so citations can open at the right moment. */
export async function matchYouTube(ctx: Context, opts: { refresh: boolean }) {
  const key = requireKey('YOUTUBE_API_KEY', ctx.config.youtubeApiKey);
  const run = ctx.store.startRun(null, 'match-youtube');
  try {
    const videos = await listUploads(key, undefined, (n) =>
      process.stdout.write(`\r${c.dim(`${n} uploads listed…`)}`),
    );
    process.stdout.write('\n');
    const episodes = ctx.store
      .listEpisodes({ types: ['full'] })
      .filter((e) => opts.refresh || e.youtubeVideoId === null);
    const matches = matchEpisodes(episodes, videos);
    for (const m of matches) {
      ctx.store.setYouTube(m.episodeId, {
        videoId: m.videoId,
        durationMs: m.durationMs,
        offsetMs: m.offsetMs,
        alignment: m.alignment,
      });
    }
    const exact = matches.filter((m) => m.alignment === 'exact').length;
    ctx.store.finishRun(run, 'done', {
      meta: { videos: videos.length, matched: matches.length, exact },
    });
    console.log(
      `Matched ${matches.length} of ${episodes.length} episodes to ${videos.length} uploads: ${exact} exact, ${matches.length - exact} estimated (shown as ≈).`,
    );
    if (matches.length < episodes.length) {
      console.log(
        c.dim(
          'Unmatched episodes link to no video. Fix one by hand: pnpm ingest align <episode> --video <id>',
        ),
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
  ctx.store.setYouTube(episode.id, {
    videoId: videoId ?? null,
    durationMs: null,
    offsetMs:
      opts.offsetSeconds !== undefined ? opts.offsetSeconds * 1000 : episode.youtubeOffsetMs,
    alignment,
  });
  console.log(
    `${episode.title}\n  video ${videoId ?? '—'} · offset ${(opts.offsetSeconds ?? episode.youtubeOffsetMs / 1000).toFixed(1)}s · ${alignment}`,
  );
}
