import { parseJson, readBody } from '@/server/body';

/** A violation report is a few hundred bytes. */
const MAX_BODY_BYTES = 8 * 1024;

/**
 * Development only (P6-09): `next dev` adds `report-uri` to the policy, and the browser posts each
 * violation here so it shows in the terminal. Production never reports, and this answers 404.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') return new Response(null, { status: 404 });
  const raw = await readBody(request, MAX_BODY_BYTES);
  if (raw === null) return new Response(null, { status: 413 });
  const body = parseJson(raw) as { 'csp-report'?: Record<string, unknown> } | null | undefined;
  if (body === undefined) return new Response(null, { status: 400 });
  const report = body?.['csp-report'] ?? {};
  const field = (k: string) => String(report[k] ?? '').slice(0, 200);
  console.warn(
    '[csp] blocked',
    field('effective-directive') || field('violated-directive'),
    field('blocked-uri'),
  );
  return new Response(null, { status: 204 });
}
