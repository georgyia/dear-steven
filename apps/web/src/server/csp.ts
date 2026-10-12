/**
 * The Content-Security-Policy for pages (P6-09, SR-15), built per request in `proxy.ts`.
 *
 * Scripts run only with this request's nonce; 'strict-dynamic' lets Next's nonced bootstrap load
 * its own chunks, and anything injected without the nonce — an inline script, an event-handler
 * attribute, a script from another origin — is refused. Everything else is same-origin except
 * the two third-party loads the inspector makes after a click (P5-05): the privacy-enhanced
 * YouTube player and the podcast audio from whichever https CDN the RSS enclosure names.
 *
 * Holds no secret, so it is not `server-only`: the proxy and the unit tests import it directly.
 */

export interface PolicyOptions {
  nonce: string;
  /** `next dev`: React rebuilds server error stacks with eval, and violations are reported. */
  dev: boolean;
  /** The request reached us over HTTPS (directly or via the platform's TLS proxy). */
  https: boolean;
}

export const CSP_REPORT_PATH = '/api/csp-report';

export function contentSecurityPolicy({ nonce, dev, https }: PolicyOptions): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Style attributes stay allowed: React and motion render them during SSR, and a nonce can't
    // cover an attribute. Styles can't run code; scripts are what this policy is for.
    "style-src 'self' 'unsafe-inline'",
    // blob: is the film-grain tile (Noise) painted on a canvas.
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    'frame-src https://www.youtube-nocookie.com',
    "media-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ['upgrade-insecure-requests'] : []),
    ...(dev ? [`report-uri ${CSP_REPORT_PATH}`] : []),
  ].join('; ');
}

/** One year; no includeSubDomains — the operator's other subdomains are not ours to decide. */
export const STRICT_TRANSPORT_SECURITY = 'max-age=31536000';

/** 128 random bits, base64 — fresh for every response. */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/** Behind a TLS-terminating proxy the app sees plain HTTP; the forwarded protocol says otherwise. */
export function arrivedOverHttps(headers: Headers, url: URL): boolean {
  const forwarded = headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  return forwarded ? forwarded === 'https' : url.protocol === 'https:';
}
