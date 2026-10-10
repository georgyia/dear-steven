import 'server-only';
import type { AskErrorCode } from '@dear-steven/core/schema';

/**
 * Turns a failure inside the answer pipeline into a code and a message safe to show and log.
 * Provider error text is never passed through: it can echo request details (even a masked key).
 */
export function describeFailure(error: unknown): {
  code: AskErrorCode;
  message: string;
  log: string;
} {
  const status =
    typeof (error as { status?: unknown })?.status === 'number'
      ? (error as { status: number }).status
      : null;
  const name = error instanceof Error ? error.name : typeof error;
  if (status === 401 || status === 403) {
    return {
      code: 'not_configured',
      message: 'The OpenAI key was rejected. Check OPENAI_API_KEY in .env and restart.',
      log: `openai ${status}`,
    };
  }
  if (status === 429) {
    return {
      code: 'upstream',
      message: 'OpenAI is rate-limiting this key, or it has run out of credit.',
      log: 'openai 429',
    };
  }
  if (status !== null && status >= 500) {
    return {
      code: 'upstream',
      message: 'OpenAI had a problem answering just now.',
      log: `openai ${status}`,
    };
  }
  if (status !== null && status >= 400) {
    return {
      code: 'upstream',
      message: 'OpenAI turned the request down.',
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
      message: 'I couldn’t reach OpenAI just now.',
      log: `network ${name}`,
    };
  }
  return { code: 'internal', message: 'Something went wrong on my end.', log: name };
}
