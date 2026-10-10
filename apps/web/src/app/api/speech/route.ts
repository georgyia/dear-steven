import { readConfig } from '@dear-steven/core/config';
import { synthesizeSpeech } from '@dear-steven/core/openai';
import { SpeechRequestSchema } from '@dear-steven/core/schema';
import { describeFailure } from '@/server/errors';
import { getOpenAI } from '@/server/knowledge';
import { clientKey, takeToken } from '@/server/rate-limit';
import { jsonError } from '@/server/sse';

export const dynamic = 'force-dynamic';

/**
 * Spoken replies (POST { text } → audio/mpeg). The client falls back to the browser's own
 * speechSynthesis whenever this returns an error, including in demo mode.
 */
export async function POST(req: Request) {
  const config = readConfig();
  const client = config.mode === 'live' ? getOpenAI(config) : null;
  if (!client) return jsonError(503, 'not_configured', 'Server speech needs an OpenAI key.');
  const limit = takeToken('speech', clientKey(req));
  if (!limit.ok) {
    return jsonError(429, 'rate_limited', 'Too many requests.', {
      'Retry-After': String(limit.retryAfter),
    });
  }

  const parsed = SpeechRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, 'bad_request', 'Nothing to say.');

  try {
    const body = await synthesizeSpeech(client, parsed.data.text, req.signal);
    return new Response(body, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const failure = describeFailure(error);
    console.error('[speech] failed:', failure.log);
    return jsonError(502, failure.code, failure.message);
  }
}
