import { episodeSummary } from '@dear-steven/core/answer';
import { readConfig } from '@dear-steven/core/config';
import { EPISODE_PAGE_SIZE, EpisodeQuerySchema } from '@dear-steven/core/schema';
import { demoEpisodePage } from '@/lib/demo-fixtures';
import { getStore } from '@/server/knowledge';
import { clientKey, takeToken } from '@/server/rate-limit';
import { jsonError } from '@/server/sse';

export const dynamic = 'force-dynamic';

/** GET /api/episodes?q=&offset= — the episode explorer. Metadata only, never transcript text. */
export async function GET(req: Request) {
  if (!takeToken('passages', clientKey(req)).ok) {
    return jsonError(429, 'rate_limited', 'Too many requests.');
  }
  const url = new URL(req.url);
  const parsed = EpisodeQuerySchema.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  if (!parsed.success) return jsonError(400, 'bad_request', 'That search could not be read.');
  const { q, offset } = parsed.data;
  const headers = { 'Cache-Control': 'private, max-age=30' };

  const config = readConfig();
  if (config.mode === 'demo') {
    const page = demoEpisodePage(q, offset);
    return Response.json(
      { ...page, episodes: page.episodes.slice(0, EPISODE_PAGE_SIZE) },
      { headers },
    );
  }
  try {
    const store = getStore(config);
    if (!store) return Response.json({ total: 0, offset, episodes: [] }, { headers });
    const page = store.browseIndexed({ search: q, limit: EPISODE_PAGE_SIZE, offset });
    return Response.json(
      { total: page.total, offset, episodes: page.episodes.map(episodeSummary) },
      { headers },
    );
  } catch (error) {
    console.error('[episodes] lookup failed', error instanceof Error ? error.message : error);
    return jsonError(500, 'internal', 'Could not list the conversations.');
  }
}
