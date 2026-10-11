import type { AnswerModel, JsonFormat } from '@dear-steven/core/answer';
import type { FinalAnswer } from '@dear-steven/core/schema';

/**
 * The persona-v2 rubric (P6-06): does an answer take a position and say what to do? Graded by the
 * answer model with a strict schema; a person spot-checks a sample (plan/human/first-live-eval.md).
 * The judge sees only what the reader sees — the question and the answer's text.
 */
export interface Judgement {
  /** The question asks what to do, think or choose (not just what happened). */
  adviceSeeking: boolean;
  /** The first one or two sentences state a clear view or recommendation. */
  opensWithPosition: boolean;
  /** 1 hedges everything … 5 takes a clear, reasoned stance. */
  decisiveness: number;
  /** 1 no next step … 5 concrete steps with specifics (numbers, timeframes, examples). */
  actionability: number;
  /** Hedging phrases and disclaimers counted in the answer. */
  hedges: number;
  note: string;
}

export const JUDGE_FORMAT: JsonFormat = {
  name: 'judgement',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'adviceSeeking',
      'opensWithPosition',
      'decisiveness',
      'actionability',
      'hedges',
      'note',
    ],
    properties: {
      adviceSeeking: { type: 'boolean' },
      opensWithPosition: { type: 'boolean' },
      decisiveness: { type: 'integer' },
      actionability: { type: 'integer' },
      hedges: { type: 'integer' },
      note: { type: 'string' },
    },
  },
};

export const JUDGE_INSTRUCTIONS = `You grade one answer from an advice persona, strictly and consistently.
- adviceSeeking: true if the question asks what to do, think, choose or prioritise; false if it only asks what happened or what someone said.
- opensWithPosition: true only if the first one or two sentences state a clear view or recommendation ("Here's what I'd do: …", "Don't quit yet.", "Yes — but only if …"). A survey of perspectives, a definition, or "it depends" without a verdict is false.
- decisiveness, 1–5: 1 hedges everything and commits to nothing; 3 leans one way; 5 takes a clear, reasoned stance and owns it.
- actionability, 1–5: 1 no next step; 3 general advice; 5 concrete steps someone could start this week, with specifics (numbers, timeframes, examples).
- hedges: count hedging phrases and disclaimers ("may", "might", "it depends", "I can't say", "not a diagnosis", "these passages don't establish").
- note: one short sentence on the biggest weakness.
Grade what is written, not what you would have written. A clear "see a professional" line on a medical, legal or money question is good practice, not a hedge.`;

const textOf = (final: FinalAnswer) =>
  final.blocks
    .map((b) => (b.kind === 'quote' ? `“${b.text}”` : b.segments.map((s) => s.text).join(' ')))
    .join('\n\n');

const clamp = (n: unknown) => Math.min(5, Math.max(1, Math.round(Number(n) || 1)));

export async function judge(
  model: AnswerModel,
  question: string,
  final: FinalAnswer,
): Promise<Judgement> {
  const raw = await model.completeJson({
    instructions: JUDGE_INSTRUCTIONS,
    input: [
      {
        role: 'user',
        content: `<question>\n${question}\n</question>\n\n<answer>\n${textOf(final)}\n</answer>`,
      },
    ],
    format: JUDGE_FORMAT,
  });
  const j = JSON.parse(raw) as Partial<Judgement>;
  return {
    adviceSeeking: j.adviceSeeking === true,
    opensWithPosition: j.opensWithPosition === true,
    decisiveness: clamp(j.decisiveness),
    actionability: clamp(j.actionability),
    hedges: Math.max(0, Math.round(Number(j.hedges) || 0)),
    note: String(j.note ?? '').slice(0, 300),
  };
}

/** The rubric over a run: averages, and how many advice-seeking answers open with a position. */
export function rubric(judgements: Judgement[]) {
  const advice = judgements.filter((j) => j.adviceSeeking);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    judged: judgements.length,
    adviceSeeking: advice.length,
    opensWithPosition: advice.filter((j) => j.opensWithPosition).length,
    opensWithPositionRate: advice.length
      ? advice.filter((j) => j.opensWithPosition).length / advice.length
      : 0,
    decisiveness: Math.round(avg(judgements.map((j) => j.decisiveness)) * 100) / 100,
    actionability: Math.round(avg(judgements.map((j) => j.actionability)) * 100) / 100,
    hedgesPerAnswer: Math.round(avg(judgements.map((j) => j.hedges)) * 100) / 100,
  };
}
