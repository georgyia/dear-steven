import { composeAnswer, emptyKnowledgeAnswer, restingAnswer } from '@dear-steven/core/answer';
import { uiLocaleFrom } from '@dear-steven/core/copy';
import { routeQuestion, safetyReply } from '@dear-steven/core/safety';
import { type AskEvent, AskRequestSchema } from '@dear-steven/core/schema';
import { MESSAGES } from '@/i18n';
import { readBody } from '@/server/body';
import { streamDemoAnswer } from '@/server/demo';
import { OPERATOR_HINT } from '@/server/errors';
import { type FreeQuestion, freeLimitApplies, takeFreeQuestion } from '@/server/free-questions';
import {
  answerLogger,
  getAnswerModel,
  getEmbedder,
  getModerator,
  getStore,
} from '@/server/knowledge';
import { clientKey, takeToken } from '@/server/rate-limit';
import { requestConfig } from '@/server/request-config';
import { withShareToken } from '@/server/share';
import { overBudget } from '@/server/spend';
import { jsonError, sseResponse } from '@/server/sse';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BODY_BYTES = 64 * 1024;

/**
 * POST { question, history, uiLocale? } → text/event-stream of AskEvents (packages/core/src/schema/ask.ts).
 * Validates input, rate-limits live answers, and hands everything else to packages/core. Runs on the
 * visitor's own OpenAI key when they sent one (`requestConfig`, P6-03). On the operator's key with a
 * limit set, each question counts as one of the visitor's free questions (P8-02), given back if it
 * costs nothing or fails on this server's or OpenAI's side (P10-05).
 */
export async function POST(req: Request) {
  const raw = await readBody(req, MAX_BODY_BYTES);
  if (raw === null) return jsonError(413, 'bad_request', 'Request too large.');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return jsonError(400, 'bad_request', 'Expected a JSON body.');
  }
  const parsed = AskRequestSchema.safeParse(json);
  if (!parsed.success) return jsonError(400, 'bad_request', 'That question could not be read.');
  const request = {
    ...parsed.data,
    locale: parsed.data.locale ?? acceptedLocale(req),
    uiLocale: parsed.data.uiLocale ?? uiLocaleFrom(req.headers.get('accept-language')),
  };
  const { uiLocale } = request;
  const errors = MESSAGES[uiLocale].serverErrors;

  const { config, refused } = requestConfig(req, uiLocale);
  if (refused) return refused;
  if (config.mode === 'demo') {
    // Even fixtures must not answer someone in crisis with a demo about procrastination (P6-11).
    const reply = safetyReply(routeQuestion(request.question, null), request.locale);
    if (reply) {
      return sseResponse(
        async function* () {
          yield* reply;
        },
        req.signal,
        uiLocale,
      );
    }
    // Fixtures cost nothing, so demo mode is not rate limited.
    return sseResponse(
      (signal) => withShareToken(streamDemoAnswer(request, signal), config, request.question),
      req.signal,
      uiLocale,
    );
  }

  const limit = takeToken('ask', clientKey(req));
  if (!limit.ok) {
    return jsonError(429, 'rate_limited', 'Too many questions at once.', {
      'Retry-After': String(limit.retryAfter),
    });
  }

  // Past today's cap on the operator's key: an in-persona reply, and no OpenAI call (P6-08).
  if (overBudget(config)) {
    return sseResponse(
      async function* () {
        yield* restingAnswer(uiLocale);
      },
      req.signal,
      uiLocale,
    );
  }

  let free: FreeQuestion | null = null;
  if (freeLimitApplies(config)) {
    free = takeFreeQuestion(config, req);
    if (!free.ok) return jsonError(402, 'needs_key', errors.needsKey(free.limit), NO_STORE);
  }
  const giveBack = () => {
    if (free?.ok) free.giveBack();
  };
  let cost = 0;
  const onCost = (usd: number) => {
    cost += usd;
  };

  const model = getAnswerModel(config, onCost);
  if (!model) {
    console.error(`[ask] ${OPERATOR_HINT.noKey}`);
    giveBack();
    return jsonError(503, 'not_configured', errors.noKey);
  }
  let store: ReturnType<typeof getStore>;
  try {
    store = getStore(config);
  } catch (error) {
    console.error(
      `[ask] ${OPERATOR_HINT.noKnowledgeBase}`,
      error instanceof Error ? error.message : error,
    );
    giveBack();
    return jsonError(503, 'not_configured', errors.noKnowledgeBase);
  }
  if (!store) {
    // No database yet: the honest, in-persona empty answer (no model call is made).
    giveBack();
    return sseResponse(
      async function* () {
        yield* emptyKnowledgeAnswer(uiLocale);
      },
      req.signal,
      uiLocale,
    );
  }

  const deps = {
    store,
    model,
    embedder: getEmbedder(config, onCost),
    moderate: getModerator(config),
    onComplete: answerLogger(config),
  };
  const res = sseResponse(
    (signal) =>
      countedUnlessFailed(
        withShareToken(composeAnswer(deps, request, signal), config, request.question),
        () => cost,
        giveBack,
        signal,
      ),
    req.signal,
    uiLocale,
    config.keySource,
  );
  if (free?.ok && free.cookie) res.headers.append('Set-Cookie', free.cookie);
  return res;
}

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Passes the events on. When they end, the free question is given back if it cost nothing (a safety
 * reply), or if the answer failed on this server's or OpenAI's side before it was complete (P10-05):
 * a thrown error or an `error` event, before `final`. A visitor who stops an answer keeps it
 * counted: their abort is never such a failure, so stopping a paid answer can't win the question back.
 */
async function* countedUnlessFailed(
  events: AsyncIterable<AskEvent>,
  cost: () => number,
  giveBack: () => void,
  signal: AbortSignal,
): AsyncIterable<AskEvent> {
  let failed = false;
  let complete = false;
  try {
    for await (const event of events) {
      if (event.type === 'final') complete = true;
      else if (event.type === 'error') failed = true;
      yield event;
    }
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (cost() === 0 || (failed && !complete && !signal.aborted)) giveBack();
  }
}

/** The first Accept-Language tag, if it is a well-formed locale; it picks the crisis helpline. */
function acceptedLocale(req: Request): string | undefined {
  const tag = req.headers.get('accept-language')?.split(',')[0]?.split(';')[0]?.trim();
  return tag && AskRequestSchema.shape.locale.safeParse(tag).success ? tag : undefined;
}
