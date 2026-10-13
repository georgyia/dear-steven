import { z } from 'zod';
import { UI_LOCALES } from '../persona/copy.ts';
import { ResolvedBlockSchema } from './answer.ts';

/**
 * Interview mode (P7-06): Dear Steven asks, the visitor answers, one question at a time, the way
 * the show's conversations move. The server keeps nothing: the client sends the interview so far
 * with every step.
 */

/** Where each question takes the conversation, in order. */
export const INTERVIEW_STAGES = [
  'opening',
  'story',
  'turning-point',
  'depth',
  'challenge',
  'advice',
  'closing',
] as const;
export const InterviewStageSchema = z.enum(INTERVIEW_STAGES);
export type InterviewStage = z.infer<typeof InterviewStageSchema>;

export const INTERVIEW_LIMITS = {
  minQuestions: 6,
  maxQuestions: 10,
  defaultQuestions: 7,
  /** A question is one question: at most this many words. */
  questionWords: 40,
  questionChars: 400,
  answerChars: 2000,
  nameChars: 60,
  aboutChars: 240,
  /** "What I learned about you": at most this many lines. */
  learnedLines: 5,
} as const;

export const InterviewSetupSchema = z.strictObject({
  /** What to call the visitor. Optional. */
  name: z.string().trim().max(INTERVIEW_LIMITS.nameChars).optional(),
  /** What they do, in a line. Optional. */
  about: z.string().trim().max(INTERVIEW_LIMITS.aboutChars).optional(),
  length: z
    .number()
    .int()
    .min(INTERVIEW_LIMITS.minQuestions)
    .max(INTERVIEW_LIMITS.maxQuestions)
    .optional(),
});
export type InterviewSetup = z.infer<typeof InterviewSetupSchema>;

export const InterviewTurnSchema = z.strictObject({
  question: z.string().trim().min(1).max(INTERVIEW_LIMITS.questionChars),
  stage: InterviewStageSchema,
  /** Empty when the visitor skipped the question. */
  answer: z.string().trim().max(INTERVIEW_LIMITS.answerChars),
});
export type InterviewTurn = z.infer<typeof InterviewTurnSchema>;

export const InterviewRequestSchema = z.strictObject({
  setup: InterviewSetupSchema,
  turns: z.array(InterviewTurnSchema).max(INTERVIEW_LIMITS.maxQuestions),
  /** `next`: the next question, or what I learned once the arc is done. `finish`: stop now. */
  action: z.enum(['next', 'finish']),
  /** BCP 47, for the crisis helpline. */
  locale: z
    .string()
    .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$/)
    .optional(),
  uiLocale: z.enum(UI_LOCALES).optional(),
});
export type InterviewRequest = z.infer<typeof InterviewRequestSchema>;

/** One thing Dear Steven learned, and the visitor's own words it rests on. */
export const LearnedLineSchema = z.object({
  text: z.string(),
  /** A verbatim span of the visitor's answer to question `turn` (0-based). */
  evidence: z.string(),
  turn: z.number().int().nonnegative(),
});
export type LearnedLine = z.infer<typeof LearnedLineSchema>;

export const InterviewReplySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('question'),
    question: z.string(),
    stage: InterviewStageSchema,
    /** 0-based position of this question, and how many the interview has. */
    index: z.number().int().nonnegative(),
    total: z.number().int().positive(),
    language: z.string(),
    demo: z.boolean(),
  }),
  z.object({
    type: z.literal('learned'),
    lines: z.array(LearnedLineSchema),
    language: z.string(),
    demo: z.boolean(),
  }),
  /** The interview stopped: a crisis or refused answer gets the fixed safety reply, or spend ran out. */
  z.object({
    type: z.literal('ended'),
    reason: z.enum(['crisis', 'refuse', 'resting']),
    blocks: z.array(ResolvedBlockSchema),
  }),
]);
export type InterviewReply = z.infer<typeof InterviewReplySchema>;
