import { z } from 'zod';
import { UI_LOCALES } from '../persona/copy.ts';
import { type Citation, CitationSchema, FinalAnswerSchema, ResolvedBlockSchema } from './answer.ts';

import { LIMITS } from './limits.ts';

export { LIMITS };

/** One earlier exchange, sent back by the client so the server stays stateless. */
export const HistoryTurnSchema = z.object({
  question: z.string().min(1).max(LIMITS.questionChars),
  answer: z.string().max(LIMITS.answerContextChars),
});
export type HistoryTurn = z.infer<typeof HistoryTurnSchema>;

export const AskRequestSchema = z.strictObject({
  question: z.string().trim().min(1).max(LIMITS.questionChars),
  history: z.array(HistoryTurnSchema).max(LIMITS.historyTurns).default([]),
  /**
   * The visitor's BCP 47 locale (`en-GB`): which crisis helpline to show (P6-11), later the answer
   * language. Optional; the server falls back to Accept-Language.
   */
  locale: z
    .string()
    .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$/)
    .optional(),
  /** The interface language (P6-02): the thinking steps and fixed replies. Not the answer's. */
  uiLocale: z.enum(UI_LOCALES).optional(),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

/** Steps shown in the thought line, in order. */
export const AskStepSchema = z.enum(['searching', 'found', 'writing', 'checking']);
export type AskStep = z.infer<typeof AskStepSchema>;

export const AskErrorCodeSchema = z.enum([
  'bad_request',
  'rate_limited',
  'not_configured',
  'upstream',
  'internal',
  /** The access gate (P6-08): this browser hasn't entered the passcode, or its cookie expired. */
  'locked',
]);
export type AskErrorCode = z.infer<typeof AskErrorCodeSchema>;

/**
 * Server-sent events streamed by `POST /api/ask`. A block is only ever sent after it has been
 * validated, so unverified text never reaches the browser (docs/ARCHITECTURE.md §4).
 */
export const AskEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status'), step: AskStepSchema, message: z.string() }),
  z.object({
    type: z.literal('sources'),
    passages: z.number().int().nonnegative(),
    episodes: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal('block.start'), index: z.number().int().nonnegative() }),
  z.object({
    type: z.literal('block.done'),
    index: z.number().int().nonnegative(),
    block: ResolvedBlockSchema,
    citations: z.array(CitationSchema),
  }),
  z.object({ type: z.literal('final'), answer: FinalAnswerSchema }),
  z.object({ type: z.literal('error'), code: AskErrorCodeSchema, message: z.string() }),
]);
export type AskEvent = z.infer<typeof AskEventSchema>;

/** Context shown in the evidence drawer: the cited passage plus its neighbours. */
export const PassageContextSchema = z.object({
  citation: CitationSchema.omit({ id: true, relevance: true, quoteSpan: true }).extend({
    text: z.string(),
  }),
  before: z.array(z.object({ text: z.string(), startMs: z.number().int() })),
  after: z.array(z.object({ text: z.string(), startMs: z.number().int() })),
  /** The passage as speaker turns — present only when at least one speaker is verified. */
  lines: z
    .array(
      z.object({
        startMs: z.number().int(),
        speaker: z.enum(['host', 'guest', 'unknown']),
        speakerName: z.string().nullable(),
        text: z.string(),
      }),
    )
    .nullable(),
});
export type PassageContext = z.infer<typeof PassageContextSchema>;
export type PassageCitation = Omit<Citation, 'id' | 'relevance' | 'quoteSpan'> & { text: string };

export const KnowledgeStatusSchema = z.object({
  mode: z.enum(['live', 'demo']),
  demoReason: z.enum(['no_openai_key', 'forced']).nullable(),
  episodes: z.number().int().nonnegative(),
  passages: z.number().int().nonnegative(),
  embeddedPassages: z.number().int().nonnegative(),
  diarizedEpisodes: z.number().int().nonnegative(),
  youtubeLinkedEpisodes: z.number().int().nonnegative(),
  lastIndexedAt: z.string().nullable(),
  storeError: z.string().nullable(),
  /** Estimated OpenAI spend today (UTC) and the operator's daily cap, if any (P6-08). */
  spend: z.object({
    todayUsd: z.number().nonnegative(),
    capUsd: z.number().nonnegative().nullable(),
  }),
  setup: z.object({
    openaiKey: z.boolean(),
    youtubeKey: z.boolean(),
    database: z.boolean(),
  }),
});
export type KnowledgeStatus = z.infer<typeof KnowledgeStatusSchema>;

/**
 * OpenAI's built-in voices. Stock only: a custom or cloned voice id is never accepted, so the
 * persona can't be made to sound like anyone real (ADR-003).
 */
export const STOCK_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'cedar',
  'coral',
  'echo',
  'fable',
  'marin',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
] as const;
export type StockVoice = (typeof STOCK_VOICES)[number];
export const DEFAULT_STOCK_VOICE: StockVoice = 'ash';

export const SpeechRequestSchema = z.strictObject({
  text: z.string().trim().min(1).max(LIMITS.speechChars),
  /** The listener's pick; the server default (`SPEECH_VOICE`) when absent. */
  voice: z.enum(STOCK_VOICES).optional(),
  /** ISO 639-1 code of the text's language (P6-02), so it is pronounced as that language. */
  language: z
    .string()
    .regex(/^[a-z]{2,3}$/)
    .optional(),
});

/** One row of the episode explorer: metadata only, never transcript text. */
export const EpisodeSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  guestNames: z.array(z.string()),
  publishedAt: z.string(),
  passages: z.number().int().nonnegative(),
  speakers: z.enum(['verified', 'unverified']),
  video: z.enum(['exact', 'estimated', 'unknown', 'none']),
  youtubeUrl: z.string().nullable(),
  demo: z.boolean(),
});
export type EpisodeSummary = z.infer<typeof EpisodeSummarySchema>;

export const EPISODE_PAGE_SIZE = 30;

export const EpisodeQuerySchema = z.object({
  q: z.string().trim().max(100).default(''),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

export const EpisodePageSchema = z.object({
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  episodes: z.array(EpisodeSummarySchema),
});
export type EpisodePage = z.infer<typeof EpisodePageSchema>;

/**
 * "Related moments" in the inspector: passages from other conversations close to a cited one.
 * Related, never cited — they support no claim in the answer and are labelled that way.
 */
export const RelatedMomentsSchema = z.object({
  passages: z.array(PassageContextSchema.shape.citation).max(5),
});
export type RelatedMoments = z.infer<typeof RelatedMomentsSchema>;
