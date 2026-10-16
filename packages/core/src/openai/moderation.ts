import type OpenAI from 'openai';
import { MODELS } from '../config/models.ts';
import type { ModerationResult } from '../safety/route.ts';

/**
 * OpenAI's moderation model on a question (P6-11). Free to call; the safety routing reads its
 * self-harm and severe-harm categories. Throws the provider's error; `moderationVerdict` (safety)
 * asks once more, and a question with no verdict is not answered (P10-06).
 */
export async function moderate(
  client: OpenAI,
  text: string,
  signal?: AbortSignal,
): Promise<ModerationResult> {
  const res = await client.moderations.create(
    { model: MODELS.moderation, input: text },
    { signal },
  );
  const result = res.results[0];
  return {
    flagged: result?.flagged ?? false,
    categories: { ...(result?.categories ?? {}) } as unknown as Record<string, boolean>,
    scores: { ...(result?.category_scores ?? {}) } as unknown as Record<string, number>,
  };
}
