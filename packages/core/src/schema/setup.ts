import { z } from 'zod';
import { VisitorKeySchema } from './ask.ts';

/**
 * Guided local setup (P6-04): the setup panel saves keys to `.env` and runs the ingest stages, on
 * a server started by `pnpm dev:setup` — bound to this machine, with a one-time token.
 */

/** The one-time token from the terminal, sent with every setup request. */
export const SETUP_TOKEN_HEADER = 'x-setup-token';

/** Google API keys are 39 characters today; anything of their alphabet in a sane length is taken. */
export const YouTubeKeySchema = z.string().regex(/^[A-Za-z0-9_-]{30,100}$/);

/** What to write to `.env`. A missing field is left alone; a `null` budget removes the cap. */
export const SetupKeysSchema = z.strictObject({
  openaiApiKey: VisitorKeySchema.optional(),
  youtubeApiKey: YouTubeKeySchema.optional(),
  dailyBudgetUsd: z.number().min(0).max(1000).nullable().optional(),
});
export type SetupKeys = z.infer<typeof SetupKeysSchema>;

/** The ingest stages the panel runs, in order. Paid diarization stays in the CLI. */
export const SETUP_STAGES = ['discover', 'transcribe', 'chunk', 'index', 'match-youtube'] as const;
export const SetupStageSchema = z.enum(SETUP_STAGES);
export type SetupStage = z.infer<typeof SetupStageSchema>;

/** The most the panel lets one embedding run spend; more than that belongs in the CLI. */
export const SETUP_MAX_BUDGET_USD = 20;

export const SetupRunSchema = z.strictObject({
  stage: SetupStageSchema,
  /** `transcribe`: how many more of the newest episodes to fetch. */
  limit: z.number().int().min(1).max(500).optional(),
  /** `index`: the most it may spend. Required, and the estimate must fit under it. */
  budgetUsd: z.number().positive().max(SETUP_MAX_BUDGET_USD).optional(),
});
export type SetupRun = z.infer<typeof SetupRunSchema>;

/** `GET /api/setup`: what is saved and what the next paid step would cost — never a key's value. */
export const SetupStateSchema = z.object({
  /** The env file, relative to the repository root. */
  envFile: z.string(),
  keys: z.object({ openai: z.boolean(), youtube: z.boolean() }),
  dailyBudgetUsd: z.number().nullable(),
  embedding: z.object({ passages: z.number(), tokens: z.number(), usd: z.number() }),
  /** Recorded by paid ingest stages so far. */
  spentUsd: z.number(),
  running: SetupStageSchema.nullable(),
});
export type SetupState = z.infer<typeof SetupStateSchema>;

/** A stage's progress, streamed as server-sent events: its output, then how it ended. */
export const SetupEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('line'), text: z.string() }),
  z.object({ type: z.literal('done'), ok: z.boolean() }),
]);
export type SetupEvent = z.infer<typeof SetupEventSchema>;
