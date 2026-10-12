import { composeAnswer, emptyKnowledgeAnswer, restingAnswer } from '@dear-steven/core/answer';
import { readConfig } from '@dear-steven/core/config';
import { routeQuestion, safetyReply } from '@dear-steven/core/safety';
import { AskRequestSchema } from '@dear-steven/core/schema';
import { streamDemoAnswer } from '@/server/demo';
import {
  answerLogger,
  getAnswerModel,
  getEmbedder,
  getModerator,
  getStore,
} from '@/server/knowledge';
import { clientKey, takeToken } from '@/server/rate-limit';
import { overBudget } from '@/server/spend';
import { jsonError, sseResponse } from '@/server/sse';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BODY_BYTES = 64 * 1024;

/**
 * POST { question, history } → text/event-stream of AskEvents (packages/core/src/schema/ask.ts).
 * Validates input, rate-limits live answers, and hands everything else to packages/core.
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
  const parsed = AskRequestSchema.safeParse(json);
  if (!parsed.success) return jsonError(400, 'bad_request', 'That question could not be read.');
  const request = { ...parsed.data, locale: parsed.data.locale ?? acceptedLocale(req) };

  const config = readConfig();
  if (config.mode === 'demo') {
    // Even fixtures must not answer someone in crisis with a demo about procrastination (P6-11).
    const reply = safetyReply(routeQuestion(request.question, null), request.locale);
    if (reply) {
      return sseResponse(async function* () {
        yield* reply;
      }, req.signal);
    }
    // Fixtures cost nothing, so demo mode is not rate limited.
    return sseResponse((signal) => streamDemoAnswer(request.question, signal), req.signal);
  }

  const limit = takeToken('ask', clientKey(req));
  if (!limit.ok) {
    return jsonError(429, 'rate_limited', 'Too many questions at once.', {
      'Retry-After': String(limit.retryAfter),
    });
  }

  // Past today's cap: an in-persona reply, and no OpenAI call at all (P6-08).
  if (overBudget(config)) {
    return sseResponse(async function* () {
      yield* restingAnswer();
    }, req.signal);
  }

  const model = getAnswerModel(config);
  if (!model) return jsonError(503, 'not_configured', 'No OpenAI key is configured.');
  let store: ReturnType<typeof getStore>;
  try {
    store = getStore(config);
  } catch (error) {
    console.error(
      '[ask] knowledge base unavailable',
      error instanceof Error ? error.message : error,
    );
    return jsonError(503, 'not_configured', 'The knowledge base could not be opened.');
  }
  if (!store) {
    // No database yet: the honest, in-persona empty answer (no model call is made).
    return sseResponse(async function* () {
      yield* emptyKnowledgeAnswer();
    }, req.signal);
  }

  const deps = {
    store,
    model,
    embedder: getEmbedder(config),
    moderate: getModerator(config),
    onComplete: answerLogger(config),
  };
  return sseResponse((signal) => composeAnswer(deps, request, signal), req.signal);
}

/** The first Accept-Language tag, if it is a well-formed locale; it picks the crisis helpline. */
function acceptedLocale(req: Request): string | undefined {
  const tag = req.headers.get('accept-language')?.split(',')[0]?.split(';')[0]?.trim();
  return tag && AskRequestSchema.shape.locale.safeParse(tag).success ? tag : undefined;
}
