import { z } from 'zod';

export const EpisodeTypeSchema = z.enum(['full', 'bonus', 'trailer']);
export type EpisodeType = z.infer<typeof EpisodeTypeSchema>;

export const TranscriptSourceSchema = z.enum(['rss-vtt', 'openai-diarize', 'manual']);
export type TranscriptSource = z.infer<typeof TranscriptSourceSchema>;

export const TranscriptStatusSchema = z.enum(['none', 'fetched', 'failed']);
export type TranscriptStatus = z.infer<typeof TranscriptStatusSchema>;

export const YouTubeAlignmentSchema = z.enum(['exact', 'estimated', 'unknown']);
export type YouTubeAlignment = z.infer<typeof YouTubeAlignmentSchema>;

/**
 * From podcast position `fromMs` on, the video runs `offsetMs` ahead. The podcast and the video
 * are sometimes edited differently mid-episode (an ad break only one of them has), so one offset
 * can't hold throughout; shared chapter timestamps show where it changes (P6-15).
 */
export const OffsetStepSchema = z.object({
  fromMs: z.number().int().nonnegative(),
  offsetMs: z.number().int(),
});
export type OffsetStep = z.infer<typeof OffsetStepSchema>;

/** One podcast episode, as discovered from the official RSS feed. */
export const EpisodeSchema = z.object({
  id: z.string(),
  sourceGuid: z.string(),
  title: z.string(),
  description: z.string(),
  publishedAt: z.string(),
  durationMs: z.number().int().nonnegative().nullable(),
  episodeType: EpisodeTypeSchema,
  guestNames: z.array(z.string()),
  audioUrl: z.string().nullable(),
  transcriptUrl: z.string().nullable(),
  transcriptSource: TranscriptSourceSchema.nullable(),
  transcriptStatus: TranscriptStatusSchema,
  youtubeVideoId: z.string().nullable(),
  youtubeOffsetMs: z.number().int(),
  /** Where the offset changes later in the episode; empty when one offset holds throughout. */
  youtubeOffsetSteps: z.array(OffsetStepSchema),
  youtubeAlignment: YouTubeAlignmentSchema,
  summary: z.string().nullable(),
  indexedAt: z.string().nullable(),
});
export type Episode = z.infer<typeof EpisodeSchema>;
