import 'server-only';
import type { KeySource } from '@dear-steven/core/config';
import { DEFAULT_UI_LOCALE, type UiLocale } from '@dear-steven/core/copy';
import type { AskErrorCode } from '@dear-steven/core/schema';
import { MESSAGES } from '@/i18n';

/**
 * What the operator should do, for the server log (P10-08). Never shown to a visitor: they can't
 * edit the server's env file or run its commands. English, like every log line.
 */
export const OPERATOR_HINT = {
  keyRejected: "the operator's key was rejected. Check OPENAI_API_KEY in .env and restart.",
  rateLimited:
    "the operator's key is rate-limited or out of credit. Check its limits and billing on platform.openai.com.",
  noKey:
    'no OpenAI key to answer with. Set OPENAI_API_KEY in .env, or DEAR_STEVEN_DEMO=1, and restart.',
  noKnowledgeBase:
    'the knowledge base could not be opened. Check DEAR_STEVEN_DB_PATH and the file, or rebuild it with `pnpm ingest all`.',
} as const;

/**
 * Turns a failure inside the answer pipeline into a code and a message safe to show and log.
 * Provider error text is never passed through: it can echo request details (even a masked key).
 * The message is in the visitor's interface language; the log line is always English. A
 * rejected or rate-limited key is the visitor's to fix when it is their own (P6-03). On the
 * operator's key the visitor reads what happened and what they can do, and what the operator
 * should do goes to the log line (P10-08).
 */
export function describeFailure(
  error: unknown,
  locale: UiLocale = DEFAULT_UI_LOCALE,
  keySource: KeySource | null = 'operator',
): {
  code: AskErrorCode;
  message: string;
  log: string;
} {
  const copy = MESSAGES[locale].serverErrors;
  const status =
    typeof (error as { status?: unknown })?.status === 'number'
      ? (error as { status: number }).status
      : null;
  const name = error instanceof Error ? error.name : typeof error;
  const visitor = keySource === 'visitor';
  if (status === 401 || status === 403) {
    return {
      code: 'not_configured',
      message: visitor ? copy.yourKeyRejected : copy.keyRejected,
      log: visitor
        ? `openai ${status} on the visitor's own key`
        : `openai ${status}: ${OPERATOR_HINT.keyRejected}`,
    };
  }
  if (status === 429) {
    return {
      code: 'upstream',
      message: visitor ? copy.yourKeyRateLimited : copy.rateLimited,
      log: visitor
        ? "openai 429 on the visitor's own key"
        : `openai 429: ${OPERATOR_HINT.rateLimited}`,
    };
  }
  if (status !== null && status >= 500) {
    return {
      code: 'upstream',
      message: copy.providerDown,
      log: `openai ${status}`,
    };
  }
  if (status !== null && status >= 400) {
    return {
      code: 'upstream',
      message: copy.refused,
      log: `openai ${status}`,
    };
  }
  if (
    /timeout|connection|fetch failed|ECONNRESET|ENOTFOUND/i.test(
      String((error as Error)?.message ?? ''),
    )
  ) {
    return {
      code: 'upstream',
      message: copy.unreachable,
      log: `network ${name}`,
    };
  }
  return { code: 'internal', message: copy.internal, log: name };
}
