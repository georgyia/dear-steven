import { getKnowledgeStatus } from '@/server/status';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(getKnowledgeStatus(), { headers: { 'Cache-Control': 'no-store' } });
}
