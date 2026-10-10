import { readConfig } from '@dear-steven/core/config';
import { AskRequestSchema } from '@dear-steven/core/schema';
import { streamDemoAnswer } from '@/server/demo';
import { clientKey, takeToken } from '@/server/rate-limit';
import { jsonError, sseResponse } from '@/server/sse';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 64 * 1024;

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

  const config = readConfig();
  if (config.mode === 'demo') {
    // Fixtures cost nothing, so demo mode is not rate limited.
    return sseResponse((signal) => streamDemoAnswer(parsed.data.question, signal), req.signal);
  }

  const limit = takeToken('ask', clientKey(req));
  if (!limit.ok) {
    return jsonError(429, 'rate_limited', 'Too many questions at once.', {
      'Retry-After': String(limit.retryAfter),
    });
  }
  // Live answers arrive with the answer pipeline (Phase 3).
  return jsonError(503, 'not_configured', 'Live answers are not available yet.');
}
