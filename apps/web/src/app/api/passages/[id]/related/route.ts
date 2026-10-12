import { buildRelatedMoments } from '@dear-steven/core/answer';
import { demoRelatedMoments } from '@/lib/demo-fixtures';
import { getStore } from '@/server/knowledge';
import { clientKey, takeToken } from '@/server/rate-limit';
import { requestConfig } from '@/server/request-config';
import { jsonError } from '@/server/sse';

export const dynamic = 'force-dynamic';

const PASSAGE_ID = /^[A-Za-z0-9_-]{1,80}$/;

/**
 * "Related moments" for the evidence drawer: up to three passages from other conversations near
 * a cited one, by its stored embedding. Never a model call; empty until embeddings exist.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!takeToken('passages', clientKey(req)).ok) {
    return jsonError(429, 'rate_limited', 'Too many requests.');
  }
  const { id } = await params;
  if (!PASSAGE_ID.test(id)) return jsonError(400, 'bad_request', 'Unknown passage.');

  const headers = { 'Cache-Control': 'private, max-age=300' };
  const demo = demoRelatedMoments(id);
  if (demo) return Response.json(demo, { headers });

  const { config, refused } = requestConfig(req);
  if (refused) return refused;
  if (config.mode === 'demo') return jsonError(404, 'not_found', 'Unknown passage.');
  try {
    const store = getStore(config);
    return Response.json(store ? buildRelatedMoments(store, id) : { passages: [] }, { headers });
  } catch (error) {
    console.error('[related] lookup failed', error instanceof Error ? error.message : error);
    return jsonError(500, 'internal', 'Could not load related moments.');
  }
}
