import 'server-only';
import { type AppConfig, forVisitor, readConfig } from '@dear-steven/core/config';
import { DEFAULT_UI_LOCALE, type UiLocale } from '@dear-steven/core/copy';
import { VISITOR_KEY_HEADER, VisitorKeySchema } from '@dear-steven/core/schema';
import { MESSAGES } from '@/i18n';
import { arrivedOverHttps } from './csp';
import { jsonError } from './sse';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * The configuration for this request (P6-03): the visitor's own OpenAI key from
 * `x-openai-key` if they sent one, else the operator's if allowed. Every API route reads its
 * configuration here, never `readConfig()` directly.
 *
 * The key is validated, used for this request and dropped: it is never logged, echoed, cached or
 * stored. One that is malformed, or arrived over plain HTTP from anywhere but this machine, is
 * refused outright rather than ignored, so a misconfiguration is loud.
 */
export function requestConfig(
  req: Request,
  locale: UiLocale = DEFAULT_UI_LOCALE,
): { config: AppConfig; refused?: never } | { config?: never; refused: Response } {
  const sent = req.headers.get(VISITOR_KEY_HEADER);
  if (sent === null) return { config: forVisitor(readConfig(), null) };
  const copy = MESSAGES[locale].serverErrors;
  const url = new URL(req.url);
  if (!arrivedOverHttps(req.headers, url) && !LOOPBACK.has(url.hostname)) {
    return { refused: jsonError(400, 'bad_request', copy.keyNeedsHttps) };
  }
  const key = VisitorKeySchema.safeParse(sent);
  if (!key.success) return { refused: jsonError(400, 'bad_request', copy.keyMalformed) };
  return { config: forVisitor(readConfig(), key.data) };
}
