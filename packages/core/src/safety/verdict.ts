import { DEFAULT_UI_LOCALE, MODERATION_UNAVAILABLE, type UiLocale } from '../persona/copy.ts';
import type { ModerationResult } from './route.ts';

/** OpenAI's moderation model on one text (`moderate` in `openai/`, bound to a client). */
export type Moderator = (text: string, signal: AbortSignal) => Promise<ModerationResult>;

/** Moderation was asked twice and gave no verdict, so the text must not be answered (P10-06). */
export const UNAVAILABLE = 'unavailable';

/**
 * Moderation's verdict on a text (P6-11), asked once more if the first call fails. If the second
 * call fails too, there is no verdict: the result is `unavailable`, and the server logs one line,
 * `moderation unavailable`, with the status code or error name, never the provider's text. Without a
 * moderator (demo mode, the offline red team) the result is `null`, and the phrase rules decide
 * alone. Never rejects, so it can run alongside retrieval; a visitor's abort is not retried or
 * logged.
 */
export async function moderationVerdict(
  moderate: Moderator | undefined,
  text: string,
  signal: AbortSignal,
): Promise<ModerationResult | null | typeof UNAVAILABLE> {
  if (!moderate) return null;
  let failure: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await moderate(text, signal);
    } catch (error) {
      if (signal.aborted) return UNAVAILABLE;
      failure = error;
    }
  }
  console.error(`[safety] moderation unavailable (${failureName(failure)})`);
  return UNAVAILABLE;
}

/**
 * An interview step that couldn't be checked (P10-06). The route sends it as an `upstream` error,
 * worded in the interface language; the line was logged when the verdict failed.
 */
export class ModerationUnavailableError extends Error {
  override readonly name = 'ModerationUnavailableError';
  readonly code = 'upstream';

  constructor(locale: UiLocale = DEFAULT_UI_LOCALE) {
    super(MODERATION_UNAVAILABLE[locale]);
  }
}

function failureName(error: unknown): string {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === 'number') return `openai ${status}`;
  return error instanceof Error ? error.name : typeof error;
}
