import { z } from 'zod';

/**
 * A conversation's summary (P8-03): what it's about, its topics, its most interesting moments and
 * its best questions and answers. Written once per episode at ingest; read by the explorer.
 *
 * Not to be confused with `EpisodeSummary`, an explorer row. Here, every moment, question and
 * answer is a span of the stored transcript; only `about`, topic titles and moment labels are
 * machine-written, and they are labelled so wherever they are shown.
 */
export const SUMMARY_VERSION = 'summary-v1';

export const SUMMARY_LIMITS = {
  aboutWords: 90,
  titleWords: 8,
  labelWords: 10,
  /** A quoted moment, question or answer: whole sentences, long enough to stand alone. */
  quoteMinWords: 8,
  quoteMaxWords: 90,
  /** A question can be short ("What is an exorcism?"); its answer can't. */
  questionMinWords: 3,
  topics: 8,
  moments: 8,
  exchanges: 5,
  /** An answer starts in the question's passage or one of the next two. */
  answerWithin: 2,
} as const;

/** A span of one stored passage, and when in the episode it starts. */
export const SummarySpanSchema = z.object({
  passageId: z.string().min(1).max(80),
  startMs: z.number().int().nonnegative(),
  text: z.string().min(1).max(1200),
});
export type SummarySpan = z.infer<typeof SummarySpanSchema>;

export const ConversationSummarySchema = z.object({
  version: z.string().min(1).max(40),
  model: z.string().min(1).max(80),
  createdAt: z.string().min(1).max(40),
  /** Whether the transcript says who is speaking; RSS transcripts don't. */
  speakers: z.enum(['verified', 'unverified']),
  /** Machine-written. `null` when no overview passed the checks. */
  about: z.string().min(1).max(900).nullable(),
  topics: z
    .array(
      z.object({
        /** Machine-written. */
        title: z.string().min(1).max(120),
        passageId: z.string().min(1).max(80),
        startMs: z.number().int().nonnegative(),
      }),
    )
    .max(SUMMARY_LIMITS.topics),
  moments: z
    .array(SummarySpanSchema.extend({ /** Machine-written. */ label: z.string().min(1).max(120) }))
    .max(SUMMARY_LIMITS.moments),
  exchanges: z
    .array(z.object({ question: SummarySpanSchema, answer: SummarySpanSchema }))
    .max(SUMMARY_LIMITS.exchanges),
});
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

/** What the model returns: passages by their short ids (`p12`), quotes as it copied them. */
const ModelQuoteSchema = z.object({ passage: z.string(), quote: z.string() });
export const ModelSummarySchema = z.object({
  about: z.string(),
  topics: z.array(z.object({ title: z.string(), passage: z.string() })),
  moments: z.array(ModelQuoteSchema.extend({ label: z.string() })),
  exchanges: z.array(z.object({ question: ModelQuoteSchema, answer: ModelQuoteSchema })),
});
export type ModelSummary = z.infer<typeof ModelSummarySchema>;
