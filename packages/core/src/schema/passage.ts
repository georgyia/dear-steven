import { z } from 'zod';

export const SpeakerSchema = z.enum(['host', 'guest', 'unknown']);
export type Speaker = z.infer<typeof SpeakerSchema>;

/** How a segment's speaker was established. Only `diarization` and `manual` count as evidence. */
export const AttributionMethodSchema = z.enum(['diarization', 'manual', 'none']);
export type AttributionMethod = z.infer<typeof AttributionMethodSchema>;

export const SpeakersPresentSchema = z.enum(['host', 'guest', 'mixed', 'unknown']);
export type SpeakersPresent = z.infer<typeof SpeakersPresentSchema>;

/** Cue- or turn-level transcript truth. Quotes and speaker checks are made against these. */
export const SegmentSchema = z.object({
  idx: z.number().int().nonnegative(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  speaker: SpeakerSchema,
  speakerName: z.string().nullable(),
  attributionMethod: AttributionMethodSchema,
  attributionConfidence: z.number().min(0).max(1).nullable(),
  text: z.string(),
});
export type Segment = z.infer<typeof SegmentSchema>;

/** A retrievable chunk: whole speaker turns packed to ~350–500 tokens. */
export const PassageSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  idx: z.number().int().nonnegative(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  segmentStartIdx: z.number().int().nonnegative(),
  segmentEndIdx: z.number().int().nonnegative(),
  text: z.string(),
  contextPrefix: z.string(),
  speakersPresent: SpeakersPresentSchema,
  tokenCount: z.number().int().nonnegative(),
});
export type Passage = z.infer<typeof PassageSchema>;
