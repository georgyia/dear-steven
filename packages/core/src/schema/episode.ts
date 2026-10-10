import { z } from 'zod';

export const EpisodeTypeSchema = z.enum(['full', 'bonus', 'trailer']);
export type EpisodeType = z.infer<typeof EpisodeTypeSchema>;

export const TranscriptSourceSchema = z.enum(['rss-vtt', 'openai-diarize', 'manual']);
export type TranscriptSource = z.infer<typeof TranscriptSourceSchema>;

export const TranscriptStatusSchema = z.enum(['none', 'fetched', 'failed']);
export type TranscriptStatus = z.infer<typeof TranscriptStatusSchema>;

export const YouTubeAlignmentSchema = z.enum(['exact', 'estimated', 'unknown']);
export type YouTubeAlignment = z.infer<typeof YouTubeAlignmentSchema>;

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
  youtubeAlignment: YouTubeAlignmentSchema,
  summary: z.string().nullable(),
  indexedAt: z.string().nullable(),
});
export type Episode = z.infer<typeof EpisodeSchema>;
