import { readConfig } from '@dear-steven/core/config';
import { accessCookie, codeMatches, issueAccessToken } from '@/server/access';
import { clientKey, takeToken } from '@/server/rate-limit';
import { jsonError } from '@/server/sse';

export const dynamic = 'force-dynamic';

/**
 * POST { code } → 204 with the access cookie, or 401 (P6-08). Exists only while
 * `DEAR_STEVEN_ACCESS_CODE` is set; five guesses a minute per client and thirty in all, so a long
 * passcode (four words or more) can't be guessed.
 */
export async function POST(req: Request) {
  const code = readConfig().accessCode;
  if (!code) return jsonError(404, 'bad_request', 'There is no passcode to enter.');
  const perClient = takeToken('access', clientKey(req));
  const limit = perClient.ok ? takeToken('accessAll', 'everyone') : perClient;
  if (!limit.ok) {
    return jsonError(429, 'rate_limited', 'Too many tries. Wait a minute, then try again.', {
      'Retry-After': String(limit.retryAfter),
    });
  }
  const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
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
