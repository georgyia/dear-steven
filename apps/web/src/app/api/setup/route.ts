import { NO_STORE, notFound, setupAllowed, setupState } from '@/server/setup';

export const dynamic = 'force-dynamic';

/** Guided local setup (P6-04): what is saved and what the next paid step would cost. */
export async function GET(req: Request) {
  if (!setupAllowed(req)) return notFound();
  return Response.json(setupState(), { headers: NO_STORE });
}
