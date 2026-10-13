import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import {
  ABOUT_THE_USER,
  PERSONA_INSTRUCTIONS,
  PERSONA_VERSION,
  TALK_STYLE,
} from '../persona/persona.ts';
import {
  type AskMode,
  type HistoryTurn,
  ModelAnswerSchema,
  ModelBlockSchema,
} from '../schema/index.ts';
import type { AnswerContext } from './context.ts';
import { neutralise, renderSources } from './context.ts';
import type { JsonFormat, ModelMessage } from './model.ts';
import type { Violation } from './validate.ts';

const toFormat = (schema: z.ZodType, name: string): JsonFormat => ({
  name,
  schema: zodTextFormat(schema, name).schema as Record<string, unknown>,
});

export const ANSWER_FORMAT = toFormat(ModelAnswerSchema, 'answer');

export const RepairSchema = z.object({
  blocks: z.array(z.object({ index: z.number().int(), block: ModelBlockSchema })),
});
export const REPAIR_FORMAT = toFormat(RepairSchema, 'repair');

export const ANSWER_CACHE_KEY = `dear-steven-answer-${PERSONA_VERSION}`;

/** Earlier turns, newest last, each answer trimmed — enough for follow-ups, cheap to send. */
export function historyMessages(history: HistoryTurn[], turns = 6): ModelMessage[] {
  return history.slice(-turns).flatMap((t): ModelMessage[] => [
    { role: 'user', content: t.question },
    { role: 'assistant', content: t.answer.slice(0, 1500) },
  ]);
}

/**
 * The question with its sources. `guidance` is per-question care (P6-11: high stakes, sensitive
 * topics), the talk-mode style (P7-05) and what the visitor kept about themselves (P7-08); all travel
 * here rather than in the instructions, so the cached prefix never changes.
 */
export function answerInput(
  question: string,
  history: HistoryTurn[],
  ctx: AnswerContext,
  guidance: string | null = null,
  mode: AskMode = 'ask',
  about?: string,
): ModelMessage[] {
  const care = guidance ? `\n\n<care>\n${guidance}\n</care>` : '';
  const style = mode === 'talk' ? `\n\n<style>\n${TALK_STYLE}\n</style>` : '';
  const user = about
    ? `\n\n<about_the_user>\n${neutralise(about)}\n</about_the_user>\n${ABOUT_THE_USER}`
    : '';
  return [
    ...historyMessages(history),
    {
      role: 'user',
      content: `${renderSources(ctx)}\n\n<question>\n${question}\n</question>${care}${style}${user}\n\nAnswer the question as Dear Steven, following every rule in your instructions. Return only the JSON answer object.`,
    },
  ];
}

export function repairInput(
  question: string,
  ctx: AnswerContext,
  failing: { index: number; block: unknown; violations: Violation[] }[],
): ModelMessage[] {
  const items = failing
    .map(
      (f) =>
        `Block ${f.index}:\n${JSON.stringify(f.block)}\nProblems:\n${f.violations.map((v) => `- ${v.message}`).join('\n')}`,
    )
    .join('\n\n');
  return [
    {
      role: 'user',
      content: `${renderSources(ctx)}\n\n<question>\n${question}\n</question>\n\nSome blocks of your answer failed verification against the sources. Rewrite ONLY these blocks so they pass, keeping the same voice and meaning where the evidence allows. Never invent support: if a claim can't be supported, soften it into clearly-labelled synthesis or drop it.\n\n${items}\n\nReturn {"blocks":[{"index":…,"block":…}]} with one entry per block above.`,
    },
  ];
}

export const CONDENSE_INSTRUCTIONS =
  'Rewrite the final user question as one standalone search query, in English, for an English podcast transcript archive: translate it if it is in another language, and resolve pronouns and references from the conversation. Keep names and key terms. Output only the query, no quotes, at most 25 words.';

export { PERSONA_INSTRUCTIONS };
