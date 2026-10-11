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

const ALTERNATES_INSTRUCTIONS =
  'Give two more English search queries for the same question, each using different words that a podcast guest might use when talking about it. One per line, no numbering, no quotes, at most 12 words each.';

/**
 * Two more ways to search for the same thing (P6-07): guests rarely use the asker's words, so
 * fusing a few phrasings finds the moment more often. Best-effort — on any failure, none.
 */
export async function alternateQueries(
  model: AnswerModel,
  query: string,
  signal?: AbortSignal,
): Promise<string[]> {
  try {
    const text = await model.completeText({
      instructions: ALTERNATES_INSTRUCTIONS,
      input: [{ role: 'user', content: query }],
      maxOutputTokens: 60,
      signal,
    });
    const seen = new Set([query.toLowerCase()]);
    return text
      .split('\n')
      .map((l) => l.replace(/^[-*\d.)\s"']+|["']$/g, '').trim())
      .filter(
        (l) =>
          l.length > 3 && l.length < 200 && !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase()),
      )
      .slice(0, 2);
  } catch {
    return [];
  }
}
