import { DEFAULT_UI_LOCALE, MODERATION_UNAVAILABLE, type UiLocale } from '../persona/copy.ts';
import type { ModerationResult } from './route.ts';

/** OpenAI's moderation model on one text (`moderate` in `openai/`, bound to a client). */
export type Moderator = (text: string, signal: AbortSignal) => Promise<ModerationResult>;

/** Moderation was asked twice and gave no verdict, so the text must not be answered (P10-06). */
export const UNAVAILABLE = 'unavailable';

/**
 * OpenAI refused the key itself (401, 403) or held it back (429: too many requests, or no credit
 * left), so moderation couldn't be asked (P10-13). That isn't an outage: the answer would fail the
 * same way. The caller throws `error`, and `describeFailure` words it for whoever owns the key.
 */
export class KeyRefused {
  readonly error: unknown;

  constructor(error: unknown) {
    this.error = error;
  }
}

const KEY_REFUSED = new Set([401, 403, 429]);

/**
 * Moderation's verdict on a text (P6-11), asked once more if the first call fails. If the second
 * call fails too, there is no verdict: the result is `unavailable`, and the server logs one line,
 * `moderation unavailable`, with the status code or error name, never the provider's text. A
 * refused or held-back key is not asked again: the result is `KeyRefused` (P10-13). Without a
 * moderator (demo mode, the offline red team) the result is `null`, and the phrase rules decide
 * alone. Never rejects, so it can run alongside retrieval; a visitor's abort is not retried or
 * logged.
 */
export async function moderationVerdict(
  moderate: Moderator | undefined,
  text: string,
  signal: AbortSignal,
): Promise<ModerationResult | null | typeof UNAVAILABLE | KeyRefused> {
  if (!moderate) return null;
  let failure: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await moderate(text, signal);
    } catch (error) {
      if (signal.aborted) return UNAVAILABLE;
      if (KEY_REFUSED.has(statusOf(error) ?? 0)) return new KeyRefused(error);
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

function statusOf(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : null;
}

function failureName(error: unknown): string {
  const status = statusOf(error);
  if (status !== null) return `openai ${status}`;
  return error instanceof Error ? error.name : typeof error;
}
