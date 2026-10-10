import { demoPassageContext } from '@/lib/demo-fixtures';
import { clientKey, takeToken } from '@/server/rate-limit';
import { jsonError } from '@/server/sse';

export const dynamic = 'force-dynamic';

const PASSAGE_ID = /^[A-Za-z0-9_-]{1,80}$/;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!takeToken('passages', clientKey(req)).ok) {
    return jsonError(429, 'rate_limited', 'Too many requests.');
  }
  const { id } = await params;
  if (!PASSAGE_ID.test(id)) return jsonError(400, 'bad_request', 'Unknown passage.');

  const demo = demoPassageContext(id);
  if (demo) return Response.json(demo, { headers: { 'Cache-Control': 'private, max-age=300' } });
  return jsonError(404, 'not_found', 'Unknown passage.');
}
