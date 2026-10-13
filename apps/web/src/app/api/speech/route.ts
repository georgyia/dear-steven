import { speechCostUsd } from '@dear-steven/core/models';
import { synthesizeSpeech } from '@dear-steven/core/openai';
import { SpeechRequestSchema } from '@dear-steven/core/schema';
import { describeFailure } from '@/server/errors';
import { freeLimitApplies } from '@/server/free-questions';
import { getOpenAI } from '@/server/knowledge';
import { clientKey, takeToken } from '@/server/rate-limit';
import { requestConfig } from '@/server/request-config';
import { overBudget, recordSpend } from '@/server/spend';
import { jsonError } from '@/server/sse';

export const dynamic = 'force-dynamic';

/**
 * Spoken replies (POST { text } → audio/mpeg). The client falls back to the browser's own
 * speechSynthesis whenever this returns an error, including in demo mode.
 */
export async function POST(req: Request) {
  const { config, refused } = requestConfig(req);
  if (refused) return refused;
  const client = config.mode === 'live' ? getOpenAI(config) : null;
  if (!client) return jsonError(503, 'not_configured', 'Server speech needs an OpenAI key.');
  // On free questions (P8-02) it would read any text for free: the browser's own voice reads instead.
  if (freeLimitApplies(config)) {
    return jsonError(402, 'needs_key', 'Server speech needs your own OpenAI key.');
  }
  const limit = takeToken('speech', clientKey(req));
  if (!limit.ok) {
    return jsonError(429, 'rate_limited', 'Too many requests.', {
      'Retry-After': String(limit.retryAfter),
    });
  }

  const parsed = SpeechRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, 'bad_request', 'Nothing to say.');
  // The browser reads the reply in its own voice instead (it falls back on any error).
  if (overBudget(config))
    return jsonError(503, 'not_configured', 'Today’s spend limit is reached.');

  try {
    const body = await synthesizeSpeech(client, parsed.data.text, {
      voice: parsed.data.voice,
      language: parsed.data.language,
      signal: req.signal,
    });
    recordSpend(config, speechCostUsd(parsed.data.text));
    return new Response(body, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const failure = describeFailure(error, undefined, config.keySource);
    console.error('[speech] failed:', failure.log);
    return jsonError(502, failure.code, failure.message);
  }
}
