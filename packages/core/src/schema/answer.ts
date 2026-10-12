import { z } from 'zod';
import { LIMITS } from './limits.ts';

/**
 * Who a statement belongs to. This is the product's central distinction (docs/PRODUCT.md §5):
 * - `host`      — something Steven actually said, proven by a diarized or manually labelled passage.
 * - `guest`     — something a guest actually said, proven the same way.
 * - `episode`   — the passage is real, but who said it is not verified.
 * - `synthesis` — the persona's own reasoning; never attributed to Steven or a guest.
 */
export const AttributionSchema = z.enum(['host', 'guest', 'episode', 'synthesis']);
export type Attribution = z.infer<typeof AttributionSchema>;

export const AnswerModeSchema = z.enum(['grounded', 'partial', 'insufficient', 'conversational']);
export type AnswerMode = z.infer<typeof AnswerModeSchema>;

// ---------------------------------------------------------------------------------------------
// What the model returns (strict structured output). Passage ids here are the short ids (`p3`)
// given to the model in its context; the server maps them back to stored passages.
// Every field is required (nullable instead of optional) to satisfy strict JSON schema mode.
// ---------------------------------------------------------------------------------------------

export const ModelSegmentSchema = z.object({
  text: z.string(),
  attribution: AttributionSchema,
  citations: z.array(z.string()),
});

export const ModelParagraphSchema = z.object({
  kind: z.literal('paragraph'),
  segments: z.array(ModelSegmentSchema),
});

export const ModelQuoteSchema = z.object({
  kind: z.literal('quote'),
  passageId: z.string(),
  /** Word for word from the passage, in English — the only text the validator checks. */
  quote: z.string(),
  lead: z.string().nullable(),
  /** The quote in the answer's language, when that isn't English (P6-01); shown as a translation. */
  translation: z.string().nullable(),
});

export const ModelTakeawaySchema = z.object({
  kind: z.literal('takeaway'),
  segments: z.array(ModelSegmentSchema),
});

export const ModelBlockSchema = z.discriminatedUnion('kind', [
  ModelParagraphSchema,
  ModelQuoteSchema,
  ModelTakeawaySchema,
]);

export const ModelAnswerSchema = z.object({
  /** ISO 639-1 code of the language the answer is written in (the question's). */
  language: z.string(),
  mode: AnswerModeSchema,
  blocks: z.array(ModelBlockSchema),
  evidence: z.array(z.object({ passageId: z.string(), why: z.string() })),
  spoken: z.string(),
  caveats: z.array(z.string()),
});

export type ModelSegment = z.infer<typeof ModelSegmentSchema>;
export type ModelBlock = z.infer<typeof ModelBlockSchema>;
export type ModelAnswer = z.infer<typeof ModelAnswerSchema>;

// ---------------------------------------------------------------------------------------------
// What the UI renders: blocks whose citations have been resolved and validated server-side.
// Nothing in here is model-authored except prose `text`, `lead`, `relevance`, `spoken`, `caveats`.
// Quote text is always the stored transcript span, never the model's string.
// ---------------------------------------------------------------------------------------------

/** Speaker evidence for a citation, as the UI shows it. */
export const SpeakerStateSchema = z.enum(['host', 'guest', 'unverified']);
export type SpeakerState = z.infer<typeof SpeakerStateSchema>;

/** How much to trust a timestamp on the YouTube video (podcast audio and video can drift). */
export const TimestampStateSchema = z.enum(['exact', 'estimated', 'unknown']);
export type TimestampState = z.infer<typeof TimestampStateSchema>;

export const EpisodeRefSchema = z.object({
  id: z.string(),
  title: z.string(),
  guestNames: z.array(z.string()),
  publishedAt: z.string(),
  youtubeVideoId: z.string().nullable(),
  /** The RSS enclosure (https only). The browser fetches it only after the user presses play. */
  audioUrl: z.string().nullable(),
  demo: z.boolean(),
});
export type EpisodeRef = z.infer<typeof EpisodeRefSchema>;

export const CitationSchema = z.object({
  id: z.string(),
  passageId: z.string(),
  episode: EpisodeRefSchema,
  speaker: SpeakerStateSchema,
  speakerName: z.string().nullable(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  timestamp: z.object({ ms: z.number().int().nonnegative(), state: TimestampStateSchema }),
  youtubeUrl: z.string().nullable(),
  /** youtube-nocookie embed at the same moment; loaded only when the user asks for the player. */
  embedUrl: z.string().nullable(),
  /** Verbatim stored text: the located quote span when there is one, else the passage text. */
  excerpt: z.string(),
  quoteSpan: z.object({ start: z.number().int(), end: z.number().int() }).nullable(),
  relevance: z.string().nullable(),
  /** `asr` passages may contain transcription errors and are labelled as such. */
  quality: z.enum(['asr', 'reviewed']),
});
export type Citation = z.infer<typeof CitationSchema>;

export const ResolvedSegmentSchema = z.object({
  text: z.string(),
  attribution: AttributionSchema,
  citationIds: z.array(z.string()),
});
export type ResolvedSegment = z.infer<typeof ResolvedSegmentSchema>;

export const ResolvedBlockSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('paragraph'), segments: z.array(ResolvedSegmentSchema) }),
  z.object({
    kind: z.literal('quote'),
    citationId: z.string(),
    lead: z.string().nullable(),
    /** The stored transcript span, always English. */
    text: z.string(),
    /** Model-written translation into the answer's language; never shown inside the quote marks. */
    translation: z.string().nullable().default(null),
  }),
  z.object({ kind: z.literal('takeaway'), segments: z.array(ResolvedSegmentSchema) }),
]);
export type ResolvedBlock = z.infer<typeof ResolvedBlockSchema>;

export const FinalAnswerSchema = z.object({
  /** The answer's language (P6-01). Answers stored before it existed were English. */
  language: z.string().default('en'),
  mode: AnswerModeSchema,
  blocks: z.array(ResolvedBlockSchema),
  citations: z.array(CitationSchema),
  episodes: z.array(EpisodeRefSchema.extend({ citationIds: z.array(z.string()) })),
  spoken: z.string(),
  caveats: z.array(z.string()),
  demo: z.boolean(),
  elapsedMs: z.number().int().nonnegative(),
  /**
   * The server's signed copy of this question and answer, for a share link (P6-17). Opaque to the
   * browser; only the server that wrote the answer can open it. Absent on fixed replies.
   */
  share: z.string().max(LIMITS.shareTokenChars).optional(),
});
export type FinalAnswer = z.infer<typeof FinalAnswerSchema>;
export type AnswerEpisode = FinalAnswer['episodes'][number];
