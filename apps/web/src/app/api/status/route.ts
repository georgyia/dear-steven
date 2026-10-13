import { freeStatus } from '@/server/free-questions';
import { requestConfig } from '@/server/request-config';
import { getKnowledgeStatus } from '@/server/status';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const { config, refused } = requestConfig(req);
  if (refused) return refused;
  return Response.json(getKnowledgeStatus(config, freeStatus(config, req)), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
