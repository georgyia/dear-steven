import { z } from 'zod';
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
  setup: z.object({
    openaiKey: z.boolean(),
    youtubeKey: z.boolean(),
    database: z.boolean(),
  }),
});
export type KnowledgeStatus = z.infer<typeof KnowledgeStatusSchema>;

export const SpeechRequestSchema = z.strictObject({
  text: z.string().trim().min(1).max(LIMITS.speechChars),
});
