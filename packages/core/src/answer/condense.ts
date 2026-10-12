import type { HistoryTurn } from '../schema/index.ts';
import type { AnswerModel } from './model.ts';
import { CONDENSE_INSTRUCTIONS, historyMessages } from './prompt.ts';

/**
 * The English search query for a question. The transcripts are English, so:
 * - a first English question is searched as it is — no model call, no added wait;
 * - a follow-up is condensed ("what did he say about that?" → a standalone query);
 * - a question in another language is translated into an English query (P6-01).
 * If the model call fails, an English follow-up falls back to the previous question plus this
 * one (keeping topic words in play for keyword search); any other question to itself, which
 * semantic search still understands.
 */
export async function searchQuery(
  model: AnswerModel,
  question: string,
  history: HistoryTurn[],
  language: string,
  signal?: AbortSignal,
): Promise<string> {
  if (history.length === 0 && language === 'en') return question;
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
    if (language !== 'en' || history.length === 0) return question;
    const prev = history[history.length - 1]?.question ?? '';
    return `${prev} ${question}`.trim();
  }
}
