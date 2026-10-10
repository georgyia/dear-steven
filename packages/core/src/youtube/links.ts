import type { TimestampState, YouTubeAlignment } from '../schema/index.ts';

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
  alignment: YouTubeAlignment;
}

export interface ResolvedMoment {
  url: string | null;
  embedUrl: string | null;
  /** Position on the video, in ms; equals the podcast position when alignment is unknown. */
  ms: number;
  state: TimestampState;
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

  if (moment.alignment === 'unknown') {
    return {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      ms: startMs,
      state: 'unknown',
    };
  }

  const ms = Math.max(0, startMs + Math.round(moment.offsetMs));
  const seconds = Math.floor(ms / 1000);
  return {
    url: `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?start=${seconds}`,
    ms,
    state: moment.alignment,
  };
}
