import type { OffsetStep, TimestampState, YouTubeAlignment } from '../schema/index.ts';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function isYouTubeVideoId(value: string): boolean {
  return VIDEO_ID.test(value);
}

export interface VideoMoment {
  videoId: string | null;
  /** Position in the podcast transcript. */
  startMs: number;
  /** Video position minus podcast position (positive when the video runs ahead). */
  offsetMs: number;
  /** Where the offset changes later in the episode (see `OffsetStep`); absent = never. */
  offsetSteps?: readonly OffsetStep[];
  alignment: YouTubeAlignment;
}

/** The offset in force at the moment's podcast position: the last step at or before it. */
export function offsetAt(
  moment: Pick<VideoMoment, 'startMs' | 'offsetMs' | 'offsetSteps'>,
): number {
  let offset = moment.offsetMs;
  let from = -1;
  for (const step of moment.offsetSteps ?? []) {
    if (step.fromMs <= moment.startMs && step.fromMs > from) {
      offset = step.offsetMs;
      from = step.fromMs;
    }
  }
  return offset;
}

export interface ResolvedMoment {
  url: string | null;
  embedUrl: string | null;
  /** Position on the video, in ms; equals the podcast position when alignment is unknown. */
  ms: number;
  state: TimestampState;
}

/**
 * The podcast enclosure at a moment, as a media fragment (`#t=<seconds>`). https only — anything
 * else (or a malformed URL) gives `null`, so the page never loads mixed or odd-scheme media.
 */
export function podcastAudioAt(audioUrl: string | null, startMs: number): string | null {
  const safe = httpsUrl(audioUrl);
  if (!safe) return null;
  const url = new URL(safe);
  url.hash = `t=${Math.floor(Math.max(0, startMs) / 1000)}`;
  return url.toString();
}

/** The URL itself when it parses as https, else `null`. */
export function httpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Turns a podcast-relative moment into a YouTube deep link.
 *
 * - No (or malformed) video id → no link at all; we never invent one.
 * - Unknown alignment → link to the episode without `t`, so we never send someone to a wrong moment.
 * - Exact or estimated alignment → `t=<seconds>s`, floored, never negative.
 */
export function resolveMoment(moment: VideoMoment): ResolvedMoment {
  const startMs = Math.max(0, Math.round(moment.startMs));
  const videoId = moment.videoId && isYouTubeVideoId(moment.videoId) ? moment.videoId : null;
  if (!videoId) return { url: null, embedUrl: null, ms: startMs, state: 'unknown' };
  if (moment.alignment === 'unknown')
    return { ...linksAt(videoId, startMs, 'unknown'), ms: startMs, state: 'unknown' };
  const ms = Math.max(0, startMs + Math.round(offsetAt(moment)));
  return { ...linksAt(videoId, ms, moment.alignment), ms, state: moment.alignment };
}

/**
 * The watch and embed links for a video position that is already resolved — the one place both
 * URLs are spelled out. Also rebuilds the links of a citation restored from browser storage, so a
 * stored URL is never trusted. Unknown timing links to the start rather than to a wrong moment.
 */
export function linksAt(
  videoId: string | null,
  ms: number,
  state: TimestampState,
): { url: string | null; embedUrl: string | null } {
  if (!videoId || !isYouTubeVideoId(videoId)) return { url: null, embedUrl: null };
  if (state === 'unknown') {
    return {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    };
  }
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return {
    url: `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?start=${seconds}`,
  };
}
