/**
 * Development only (P6-09): `next dev` adds `report-uri` to the policy, and the browser posts each
 * violation here so it shows in the terminal. Production never reports, and this answers 404.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') return new Response(null, { status: 404 });
  let report: Record<string, unknown> = {};
  try {
    const body = JSON.parse((await request.text()).slice(0, 8192));
    report = body?.['csp-report'] ?? {};
  } catch {
    return new Response(null, { status: 400 });
  }
  const field = (k: string) => String(report[k] ?? '').slice(0, 200);
  console.warn(
    '[csp] blocked',
    field('effective-directive') || field('violated-directive'),
    field('blocked-uri'),
  );
  return new Response(null, { status: 204 });
}
