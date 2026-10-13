import { ConversationSummaryViewSchema } from '@dear-steven/core/schema';
import { summaryView } from '@dear-steven/core/summary';
import { demoSummaryView } from '@/lib/demo-fixtures';
import { getStore } from '@/server/knowledge';
import { clientKey, takeToken } from '@/server/rate-limit';
import { requestConfig } from '@/server/request-config';
import { jsonError } from '@/server/sse';

export const dynamic = 'force-dynamic';

const EPISODE_ID = /^[\w-]{1,80}$/;

/**
 * GET /api/episodes/:id/summary — a conversation's summary for the explorer (P8-04): the stored
 * summary (P8-03) with every item's citation, and no other transcript text. Free: no OpenAI call.
 * `{ summary: null }` when the conversation hasn't been summarised; 404 when it isn't indexed.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!takeToken('passages', clientKey(req)).ok) {
    return jsonError(429, 'rate_limited', 'Too many requests.');
  }
  const { id } = await params;
  if (!EPISODE_ID.test(id)) return jsonError(400, 'bad_request', 'That episode could not be read.');
  const { config, refused } = requestConfig(req);
  if (refused) return refused;
  const headers = { 'Cache-Control': 'private, max-age=60' };
  try {
    const view = config.mode === 'demo' ? demoSummaryView(id) : summaryOf(config, id);
    if (!view) return jsonError(404, 'not_found', 'There is no such conversation.');
    return Response.json(ConversationSummaryViewSchema.parse(view), { headers });
  } catch (error) {
    console.error('[summary] lookup failed', error instanceof Error ? error.message : error);
    return jsonError(500, 'internal', 'Could not load that summary.');
  }
}

function summaryOf(config: Parameters<typeof getStore>[0], id: string) {
  const store = getStore(config);
  return store ? summaryView(store, id) : null;
}
