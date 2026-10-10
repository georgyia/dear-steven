import type { HistoryTurn } from '../schema/index.ts';
import type { AnswerModel } from './model.ts';
import { CONDENSE_INSTRUCTIONS, historyMessages } from './prompt.ts';

/**
 * Follow-up condensation: "what did he say about that?" → a standalone search query. Skipped on
 * the first turn. If the model call fails, falls back to the previous question plus this one,
 * which keeps the topic words in play for keyword search.
 */
export async function condenseQuery(
  model: AnswerModel,
  question: string,
  history: HistoryTurn[],
  signal?: AbortSignal,
): Promise<string> {
  if (history.length === 0) return question;
  try {
    const query = await model.completeText({
      instructions: CONDENSE_INSTRUCTIONS,
      input: [...historyMessages(history, 3), { role: 'user', content: question }],
      maxOutputTokens: 80,
      signal,
    });
    const clean = query.replace(/^["']|["']$/g, '').trim();
    return clean.length > 2 && clean.length < 400 ? clean : question;
  } catch {
    const prev = history[history.length - 1]?.question ?? '';
    return `${prev} ${question}`.trim();
  }
}
