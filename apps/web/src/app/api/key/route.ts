import { MODELS } from '@dear-steven/core/models';
import { checkKey } from '@dear-steven/core/openai';
import { MESSAGES } from '@/i18n';
import { describeFailure } from '@/server/errors';
import { getOpenAI } from '@/server/knowledge';
import { requestUiLocale } from '@/server/locale';
import { clientKey, takeToken } from '@/server/rate-limit';
import { requestConfig } from '@/server/request-config';
import { jsonError } from '@/server/sse';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * "Test and use" in the setup panel (P6-03): does the visitor's own key, sent in `x-openai-key`,
 * work and reach the answer model? One free `models.retrieve`, nothing stored. The answer says
 * yes or why not, and nothing about the key itself.
 */
export async function POST(req: Request) {
  const locale = await requestUiLocale();
  const copy = MESSAGES[locale].serverErrors;
  if (!takeToken('keyCheck', clientKey(req)).ok || !takeToken('keyCheckAll', 'all').ok) {
    return jsonError(429, 'rate_limited', copy.keyChecks, NO_STORE);
  }
  const { config, refused } = requestConfig(req, locale);
  if (refused) return refused;
  if (config.demoReason === 'forced') {
    return jsonError(503, 'not_configured', copy.keyForced, NO_STORE);
  }

  // Only ever the visitor's key: without one, this route must not spend a call on the operator's.
  const client = config.keySource === 'visitor' ? getOpenAI(config) : null;
  if (!client) {
    return jsonError(400, 'bad_request', copy.keyMalformed, NO_STORE);
  }
  try {
    await checkKey(client, MODELS.answer, req.signal);
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    if ((error as { status?: unknown })?.status === 404) {
      return jsonError(400, 'not_configured', copy.keyNoModel(MODELS.answer), NO_STORE);
    }
    const failure = describeFailure(error, locale, 'visitor');
    console.error('[key] check failed:', failure.log);
    return jsonError(
      failure.code === 'not_configured' ? 400 : 502,
      failure.code,
      failure.message,
      NO_STORE,
    );
  }
}
