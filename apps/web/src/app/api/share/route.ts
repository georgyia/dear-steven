import { readConfig } from '@dear-steven/core/config';
import { ShareRequestSchema } from '@dear-steven/core/schema';
import { MESSAGES } from '@/i18n';
import { readBody } from '@/server/body';
import { requestUiLocale } from '@/server/locale';
import { clientKey, takeToken } from '@/server/rate-limit';
import { openSharedAnswer } from '@/server/share';
import { jsonError } from '@/server/sse';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 32 * 1024;

/**
 * Opens a share link (P6-17): POST { token } → { question, answer }, the answer re-validated and
 * re-linked. A token this server didn't sign, or one that was changed, opens nothing; nor does an
 * answer whose sources have since left the knowledge base.
 */
export async function POST(req: Request) {
  const copy = MESSAGES[await requestUiLocale()].serverErrors;
  if (!takeToken('share', clientKey(req)).ok) {
    return jsonError(429, 'rate_limited', copy.shareSlow);
  }
  const raw = await readBody(req, MAX_BODY_BYTES);
  if (raw === null) return jsonError(413, 'bad_request', copy.shareBroken);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, 'bad_request', copy.shareBroken);
  }
  const parsed = ShareRequestSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'bad_request', copy.shareBroken);
  try {
    const opened = openSharedAnswer(readConfig(), parsed.data.token);
    if ('refused' in opened) {
      return opened.refused === 'gone'
        ? jsonError(410, 'not_found', copy.shareGone)
        : jsonError(400, 'bad_request', copy.shareBroken);
    }
    return Response.json(opened.shared, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(
      '[share] knowledge base lookup failed',
      error instanceof Error ? error.name : error,
    );
    return jsonError(500, 'internal', copy.shareBroken);
  }
}
