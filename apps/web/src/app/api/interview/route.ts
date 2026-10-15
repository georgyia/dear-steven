import { uiLocaleFrom } from '@dear-steven/core/copy';
import { interviewStep, restingInterview } from '@dear-steven/core/interview';
import { ModerationUnavailableError } from '@dear-steven/core/safety';
import { InterviewRequestSchema } from '@dear-steven/core/schema';
import { MESSAGES } from '@/i18n';
import { demoInterviewStep } from '@/server/demo-interview';
import { describeFailure } from '@/server/errors';
import {
  type FreeQuestion,
  freeLimitApplies,
  issueTicket,
  spendTicket,
  TICKET_HEADER,
  takeFreeQuestion,
  visitorOf,
} from '@/server/free-questions';
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
 * against the daily spend cap, like answers. On the operator's key with a limit set (P8-02), a whole
 * interview counts as one free question: a step without a valid ticket (the first, or one after a
 * ticket ran out) counts one and gets a ticket for the steps that follow.
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

  let free: FreeQuestion | null = null;
  if (
    freeLimitApplies(config) &&
    !spendTicket(config, visitorOf(config, req), req.headers.get(TICKET_HEADER))
  ) {
    free = takeFreeQuestion(config, req);
    if (!free.ok) return jsonError(402, 'needs_key', copy.needsKey(free.limit), NO_STORE);
  }
  let cost = 0;
  const model = getAnswerModel(config, (usd) => {
    cost += usd;
  });
  if (!model) {
    if (free?.ok) free.giveBack();
    return jsonError(503, 'not_configured', copy.noKey);
  }
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
    const headers = new Headers(NO_STORE);
    if (free?.ok) {
      // A step that cost nothing (a safety ending, a fixed question) is given back, and the next
      // step counts instead.
      if (cost === 0) free.giveBack();
      else headers.set(TICKET_HEADER, issueTicket(config, free.visitor));
      if (free.cookie) headers.append('Set-Cookie', free.cookie);
    }
    return Response.json(reply, { headers });
  } catch (error) {
    if (free?.ok && cost === 0) free.giveBack();
    if (error instanceof ModerationUnavailableError) {
      // No safety verdict, so no next step (P10-06); core has logged `moderation unavailable`.
      return jsonError(502, error.code, error.message, NO_STORE);
    }
    const failure = describeFailure(error, uiLocale, config.keySource);
    console.error('[interview] step failed:', failure.log);
    return jsonError(502, failure.code, failure.message, NO_STORE);
  }
}

function acceptedLocale(req: Request): string | undefined {
  const tag = req.headers.get('accept-language')?.split(',')[0]?.split(';')[0]?.trim();
  return tag && InterviewRequestSchema.shape.locale.safeParse(tag).success ? tag : undefined;
}
