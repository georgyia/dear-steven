import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { cuesToSegments, parseVtt } from '@dear-steven/core/ingest';
import type { Episode } from '@dear-steven/core/schema';
import type { Context } from '../context.ts';
import { download, hasBinary, probeDurationMs, splitAudio } from '../lib/ffmpeg.ts';
import { fetchText, mapLimit } from '../lib/http.ts';
import { c, progress, usd } from '../lib/output.ts';
import { withoutInsertedAds } from '../sources/inserted-ads.ts';
import {
  DIARIZE_CHUNK_SECONDS,
  diarizationCostUsd,
  diarizeChunks,
  hostReference,
  mapDiarizedSegments,
} from '../sources/openai-transcribe.ts';

export interface TranscribeOptions {
  from: 'vtt' | 'diarize';
  limit?: number;
  episode?: string;
  /** Only these episodes (`latest` passes the new ones). */
  ids?: string[];
  force: boolean;
  /** Required for `diarize`: the most this run may spend, in USD. */
  budget?: number;
  hostClip?: string;
  /**
   * `diarize` only: just the episodes with no transcript at all, newest first, so a batch adds
   * conversations instead of re-doing ones the publisher's transcripts already cover.
   */
  missing?: boolean;
}

function pick(ctx: Context, opts: TranscribeOptions, eligible: (e: Episode) => boolean): Episode[] {
  if (opts.episode) {
    const found = ctx.store.findEpisodes(opts.episode);
    if (found.length !== 1) {
      throw new Error(
        found.length
          ? `"${opts.episode}" matches ${found.length} episodes; be more specific.`
          : `No episode matches "${opts.episode}".`,
      );
    }
    return found;
  }
  const only = opts.ids ? new Set(opts.ids) : null;
  return ctx.store
    .listEpisodes({ types: ['full'] })
    .filter((e) => (only === null || only.has(e.id)) && eligible(e))
    .slice(0, opts.limit ?? Number.MAX_SAFE_INTEGER);
}

/**
 * Which episodes a diarized run takes: any with audio not yet diarized (`--force`: diarized ones
 * too), or with `--missing` only those with no transcript at all.
 */
export function diarizable(
  e: Episode,
  opts: Pick<TranscribeOptions, 'force' | 'missing'>,
): boolean {
  if (e.audioUrl === null) return false;
  if (opts.missing) return e.transcriptStatus !== 'fetched';
  return opts.force || e.transcriptSource !== 'openai-diarize';
}

export async function transcribe(ctx: Context, opts: TranscribeOptions) {
  return opts.from === 'vtt' ? fromVtt(ctx, opts) : diarize(ctx, opts);
}

/** Stage 3a (free): the publisher's own VTT transcripts. No speaker labels — passages are episode-level. */
async function fromVtt(ctx: Context, opts: TranscribeOptions) {
  const episodes = pick(
    ctx,
    opts,
    (e) =>
      e.transcriptUrl !== null &&
      (opts.force || (e.transcriptStatus !== 'fetched' && e.transcriptSource !== 'openai-diarize')),
  ).filter((e) => e.transcriptUrl);
  if (episodes.length === 0) {
    console.log(
      'Every episode with an RSS transcript is already transcribed. Use --force to refetch.',
    );
    return;
  }
  const bar = progress(episodes.length, 'RSS transcripts');
  await mapLimit(episodes, 3, async (e) => {
    const run = ctx.store.startRun(e.id, 'transcribe', { mode: 'vtt' });
    try {
      const cues = parseVtt(await fetchText(e.transcriptUrl as string));
      if (cues.length === 0) throw new Error('Transcript has no cues');
      ctx.store.replaceTranscript(e.id, cuesToSegments(cues), 'rss-vtt');
      ctx.store.finishRun(run, 'done', { meta: { cues: cues.length } });
      bar.tick(e.title);
    } catch (error) {
      ctx.store.setTranscriptFailed(e.id);
      ctx.store.finishRun(run, 'failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      bar.tick(`${e.title} — ${error instanceof Error ? error.message : error}`, false);
    }
  });
  bar.end();
  console.log(c.dim('Next: pnpm ingest chunk'));
}

/**
 * Stage 3b (paid, human-approved): OpenAI diarized transcription of the RSS audio with the host's
 * voice enrolled, so passages carry verified speakers. Refuses to start without --budget, and stops
 * before an episode that would take the run over it.
 */
async function diarize(ctx: Context, opts: TranscribeOptions) {
  if (opts.budget === undefined || !(opts.budget > 0)) {
    throw new Error(
      'Diarized transcription costs money. Pass --budget <usd> (see plan/human/transcription-budget.md).',
    );
  }
  if (!opts.hostClip)
    throw new Error('Pass --host-clip <path to a 2–10 s clip of Steven speaking>.');
  const clip = resolve(opts.hostClip);
  if (!existsSync(clip)) throw new Error(`Host clip not found: ${clip}`);
  if (!hasBinary('ffmpeg') || !hasBinary('ffprobe'))
    throw new Error('ffmpeg and ffprobe must be installed.');
  const clipMs = probeDurationMs(clip);
  if (clipMs < 2000 || clipMs > 10_000)
    throw new Error(`Host clip is ${(clipMs / 1000).toFixed(1)}s; it must be 2–10 s.`);

  const client = ctx.openai();
  const reference = hostReference(clip);
  const episodes = pick(ctx, opts, (e) => diarizable(e, opts));
  const cacheDir = join(ctx.dataDir, 'cache', 'audio');
  mkdirSync(cacheDir, { recursive: true });
  const total = episodes.reduce((n, e) => n + diarizationCostUsd(e.durationMs ?? 0), 0);
  console.log(
    `${episodes.length} episodes, about ${usd(total)} of audio; this run stops at ${usd(opts.budget)}.`,
  );

  let spent = 0;
  for (const e of episodes) {
    const estimate = diarizationCostUsd(e.durationMs ?? 0);
    if (spent + estimate > opts.budget) {
      console.log(
        c.yellow(
          `Stopping: "${e.title}" (~${usd(estimate)}) would exceed the ${usd(opts.budget)} budget.`,
        ),
      );
      break;
    }
    const run = ctx.store.startRun(e.id, 'transcribe', { mode: 'diarize', estimateUsd: estimate });
    const audio = join(cacheDir, `${e.id}.mp3`);
    const work = join(cacheDir, `${e.id}.chunks`);
    try {
      console.log(`${c.bold(e.title)} ${c.dim(`~${usd(estimate)}`)}`);
      await download(e.audioUrl as string, audio);
      const chunks = splitAudio(audio, work, DIARIZE_CHUNK_SECONDS);
      const durationMs = chunks.reduce((n, ch) => n + ch.durationMs, 0);
      const bar = progress(chunks.length, 'audio chunks');
      const diarized = await diarizeChunks(client, chunks, reference, () => bar.tick(e.title));
      bar.end();
      const { segments, droppedMs } = withoutInsertedAds(
        mapDiarizedSegments(diarized, e.guestNames),
      );
      // What the ad service added to this download, by the feed's own length: a check on droppedMs.
      const extraMs = Math.max(0, durationMs - (e.durationMs ?? durationMs));
      if (segments.length === 0) throw new Error('Diarization returned no segments');
      ctx.store.replaceTranscript(e.id, segments, 'openai-diarize');
      const cost = diarizationCostUsd(durationMs);
      spent += cost;
      const hostShare = segments.filter((s) => s.speaker === 'host').length / segments.length;
      ctx.store.finishRun(run, 'done', {
        meta: {
          costUsd: cost,
          segments: segments.length,
          hostShare,
          adsDroppedMs: droppedMs,
          extraMs,
        },
      });
      console.log(
        c.dim(
          `  ${segments.length} segments · host speaks in ${Math.round(hostShare * 100)}% · ${usd(cost)} · inserted ads: ${Math.round(droppedMs / 1000)} s dropped, the download ran ${Math.round(extraMs / 1000)} s past the feed's length`,
        ),
      );
    } catch (error) {
      ctx.store.finishRun(run, 'failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(c.red(`  failed: ${error instanceof Error ? error.message : error}`));
    } finally {
      // An episode's audio is about a megabyte a minute: kept, a batch would fill the disk.
      rmSync(work, { recursive: true, force: true });
      rmSync(audio, { force: true });
      rmSync(`${audio}.part`, { force: true });
    }
  }
  console.log(`Spent ${usd(spent)} of ${usd(opts.budget)}. ${c.dim('Next: pnpm ingest chunk')}`);
}
