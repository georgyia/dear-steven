import { healthOf } from '@/server/health';
import { visitorConfig } from '@/server/request-config';

export const dynamic = 'force-dynamic';

/**
 * GET → 200 `{ ok: true }` when this deployment can do what it was configured to do, else 503
 * `{ ok: false, reason }` (P10-02). For the image's `HEALTHCHECK` and the platform's check, so it
 * answers outside the access gate (`src/proxy.ts`) and says nothing but a reason code: no paths,
 * messages, counts or spend. Built for a visitor without a key of their own, as a poll is.
 */
export function GET() {
  const health = healthOf(visitorConfig(null));
  return Response.json(health, {
    status: health.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
