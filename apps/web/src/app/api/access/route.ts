import { readConfig } from '@dear-steven/core/config';
import { accessCookie, codeMatches, issueAccessToken } from '@/server/access';
import { parseJson, readBody } from '@/server/body';
import { clientKey, EVERYONE, takeToken } from '@/server/rate-limit';
import { jsonError } from '@/server/sse';

export const dynamic = 'force-dynamic';

/** A passcode is compared on its first 200 characters: room for those in any script, and more. */
const MAX_BODY_BYTES = 4 * 1024;

/**
 * POST { code } → 204 with the access cookie, or 401 (P6-08). Exists only while
 * `DEAR_STEVEN_ACCESS_CODE` is set; five guesses a minute per client and thirty in all, so a long
 * passcode (four words or more) can't be guessed.
 */
export async function POST(req: Request) {
  const code = readConfig().accessCode;
  if (!code) return jsonError(404, 'bad_request', 'There is no passcode to enter.');
  const perClient = takeToken('access', clientKey(req));
  const limit = perClient.ok ? takeToken('accessAll', EVERYONE) : perClient;
  if (!limit.ok) {
    return jsonError(429, 'rate_limited', 'Too many tries. Wait a minute, then try again.', {
      'Retry-After': String(limit.retryAfter),
    });
  }
  const raw = await readBody(req, MAX_BODY_BYTES);
  if (raw === null) return jsonError(413, 'bad_request', 'Request too large.');
  const body = parseJson(raw) as { code?: unknown } | null | undefined;
  const input = typeof body?.code === 'string' ? body.code.trim().slice(0, 200) : '';
  if (!input || !(await codeMatches(input, code))) {
    return jsonError(401, 'locked', 'That passcode isn’t right.');
  }
  return new Response(null, {
    status: 204,
    headers: {
      'Set-Cookie': accessCookie(await issueAccessToken(code)),
      'Cache-Control': 'no-store',
    },
  });
}
