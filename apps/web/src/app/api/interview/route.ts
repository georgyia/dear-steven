import { uiLocaleFrom } from '@dear-steven/core/copy';
import { interviewStep, restingInterview } from '@dear-steven/core/interview';
import { InterviewRequestSchema } from '@dear-steven/core/schema';
import { MESSAGES } from '@/i18n';
import { demoInterviewStep } from '@/server/demo-interview';
import { describeFailure } from '@/server/errors';
import { getAnswerModel, getModerator, getStore } from '@/server/knowledge';
import { clientKey, takeToken } from '@/server/rate-limit';
import { requestConfig } from '@/server/request-config';
import { overBudget } from '@/server/spend';
import { jsonError } from '@/server/sse';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BODY_BYTES = 48 * 1024;
const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Interview mode (P7-06): POST the interview so far → the next question, what I learned, or an
 * ending. Nothing is kept here: the visitor's answers go to OpenAI to write the next step, and are
 * forgotten. The safety rails see every answer first; live steps are rate-limited and counted
 * against the daily spend cap, like answers.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return jsonError(413, 'bad_request', 'Request too large.');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return jsonError(400, 'bad_request', 'Expected a JSON body.');
  }
  const parsed = InterviewRequestSchema.safeParse(json);
  const uiLocale = parsed.success
    ? (parsed.data.uiLocale ?? uiLocaleFrom(req.headers.get('accept-language')))
    : uiLocaleFrom(req.headers.get('accept-language'));
  const copy = MESSAGES[uiLocale].serverErrors;
  if (!parsed.success) return jsonError(400, 'bad_request', copy.interviewBroken);
  const request = { ...parsed.data, uiLocale, locale: parsed.data.locale ?? acceptedLocale(req) };

  const { config, refused } = requestConfig(req, uiLocale);
  if (refused) return refused;
  if (config.mode === 'demo')
    return Response.json(demoInterviewStep(request), { headers: NO_STORE });

  const limit = takeToken('interview', clientKey(req));
  if (!limit.ok) {
    return jsonError(429, 'rate_limited', copy.interviewSlow, {
      'Retry-After': String(limit.retryAfter),
    });
  }
  if (overBudget(config)) return Response.json(restingInterview(uiLocale), { headers: NO_STORE });

  const model = getAnswerModel(config);
  if (!model) return jsonError(503, 'not_configured', copy.noKey);
  let store: ReturnType<typeof getStore> = null;
  try {
    store = getStore(config);
  } catch {
    // Style examples are optional: an interview runs without the knowledge base.
  }
  try {
    const reply = await interviewStep(
      { model, store, moderate: getModerator(config) },
      request,
      req.signal,
    );
    return Response.json(reply, { headers: NO_STORE });
  } catch (error) {
    const failure = describeFailure(error, uiLocale, config.keySource);
    console.error('[interview] step failed:', failure.log);
    return jsonError(502, failure.code, failure.message, NO_STORE);
  }
}

function acceptedLocale(req: Request): string | undefined {
  const tag = req.headers.get('accept-language')?.split(',')[0]?.split(';')[0]?.trim();
  return tag && InterviewRequestSchema.shape.locale.safeParse(tag).success ? tag : undefined;
}
