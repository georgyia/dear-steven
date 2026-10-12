import 'server-only';
import { DEFAULT_UI_LOCALE, type UiLocale } from '@dear-steven/core/copy';
import type { AskErrorCode } from '@dear-steven/core/schema';
import { MESSAGES } from '@/i18n';

/**
 * Turns a failure inside the answer pipeline into a code and a message safe to show and log.
 * Provider error text is never passed through: it can echo request details (even a masked key).
 * The message is in the visitor's interface language; the log line is always English.
 */
export function describeFailure(
  error: unknown,
  locale: UiLocale = DEFAULT_UI_LOCALE,
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
  if (status === 401 || status === 403) {
    return {
      code: 'not_configured',
      message: copy.keyRejected,
      log: `openai ${status}`,
    };
  }
  if (status === 429) {
    return {
      code: 'upstream',
      message: copy.rateLimited,
      log: 'openai 429',
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
