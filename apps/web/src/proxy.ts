import { accessCodeFrom } from '@dear-steven/core/config';
import { type NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE, ACCESS_PATH, validAccessToken } from '@/server/access';
import { fromAnotherSite } from '@/server/cross-site';
import {
  arrivedOverHttps,
  contentSecurityPolicy,
  newNonce,
  STRICT_TRANSPORT_SECURITY,
} from '@/server/csp';

/**
 * Runs before every page and API request.
 *
 * - API: nothing but a read answers a request from another site's page (P8-08); with an access
 *   code set, nothing but the passcode route answers a browser without a valid access cookie
 *   (P6-08). One place, so a new route can't forget either.
 * - Pages: a fresh script nonce for every page (P6-09). Next reads the nonce from the request's
 *   Content-Security-Policy header and stamps it on its own scripts, which is why every page is
 *   rendered per request. (Whether to show the passcode screen is the page's decision.) The other
 *   security headers are static and live in `next.config.ts`.
 */
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) return guardApi(request);

  const production = process.env.NODE_ENV === 'production';
  const https = arrivedOverHttps(request.headers, request.nextUrl);
  const policy = contentSecurityPolicy({ nonce: newNonce(), dev: !production, https });

  const forwarded = new Headers(request.headers);
  forwarded.set('content-security-policy', policy);
  const response = NextResponse.next({ request: { headers: forwarded } });
  response.headers.set('Content-Security-Policy', policy);
  if (production && https) {
    response.headers.set('Strict-Transport-Security', STRICT_TRANSPORT_SECURITY);
  }
  return response;
}

async function guardApi(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (fromAnotherSite(request) && !OWN_CHECKS.some((p) => path === p || path.startsWith(`${p}/`))) {
    return refuse(403, 'cross_site', 'Requests from other sites are refused.');
  }
  const code = accessCodeFrom();
  if (!code || path === ACCESS_PATH) return NextResponse.next();
  if (await validAccessToken(code, request.cookies.get(ACCESS_COOKIE)?.value)) {
    return NextResponse.next();
  }
  return refuse(401, 'locked', 'This copy of Dear Steven is private. Enter the passcode first.');
}

/**
 * Routes that decide about other sites themselves (P8-08): guided setup answers 404 to anything it
 * doesn't trust, the same as a server without setup (SR-21); CSP reports are the browser's own, in
 * development only.
 */
const OWN_CHECKS = ['/api/setup', '/api/csp-report'];

const refuse = (status: number, code: string, message: string) =>
  NextResponse.json(
    { error: { code, message } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );

export const config = {
  // Everything but built assets: they carry no inline script and no data.
  matcher: ['/((?!_next/static/|_next/image|favicon.ico).*)'],
};
