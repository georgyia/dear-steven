import { buildPassageContext } from '@dear-steven/core/answer';
import { readConfig } from '@dear-steven/core/config';
import { demoPassageContext } from '@/lib/demo-fixtures';
import { getStore } from '@/server/knowledge';
import { clientKey, takeToken } from '@/server/rate-limit';
import { jsonError } from '@/server/sse';

export const dynamic = 'force-dynamic';

const PASSAGE_ID = /^[A-Za-z0-9_-]{1,80}$/;

/**
 * Context for the evidence drawer: one cited passage and its neighbouring transcript lines.
 * Only ever a few hundred words — the transcript as a whole is never served.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!takeToken('passages', clientKey(req)).ok) {
    return jsonError(429, 'rate_limited', 'Too many requests.');
  }
  const { id } = await params;
  if (!PASSAGE_ID.test(id)) return jsonError(400, 'bad_request', 'Unknown passage.');

  const headers = { 'Cache-Control': 'private, max-age=300' };
  const demo = demoPassageContext(id);
  if (demo) return Response.json(demo, { headers });

  const config = readConfig();
  if (config.mode === 'demo') return jsonError(404, 'not_found', 'Unknown passage.');
  try {
    const store = getStore(config);
    const context = store ? buildPassageContext(store, id) : null;
    if (!context) return jsonError(404, 'not_found', 'Unknown passage.');
    return Response.json(context, { headers });
  } catch (error) {
    console.error('[passages] lookup failed', error instanceof Error ? error.message : error);
    return jsonError(500, 'internal', 'Could not load that passage.');
  }
}
