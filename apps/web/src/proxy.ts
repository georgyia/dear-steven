import { type NextRequest, NextResponse } from 'next/server';
import {
  arrivedOverHttps,
  contentSecurityPolicy,
  newNonce,
  STRICT_TRANSPORT_SECURITY,
} from '@/server/csp';

/**
 * A fresh script nonce for every page (P6-09). Next reads the nonce from the request's
 * Content-Security-Policy header and stamps it on its own scripts, which is why every page is
 * rendered per request. The other security headers are static and live in `next.config.ts`.
 */
export function proxy(request: NextRequest) {
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

export const config = {
  // Pages only: API responses are JSON or SSE, and built assets carry no inline script.
  matcher: ['/((?!api/|_next/static/|_next/image|favicon.ico).*)'],
};
