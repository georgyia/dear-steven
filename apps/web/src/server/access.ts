/**
 * The access gate (P6-08): with `DEAR_STEVEN_ACCESS_CODE` set, a browser that entered the code gets
 * a signed, HTTP-only cookie, and `src/proxy.ts` refuses every API request without a valid one.
 *
 * The cookie is `<expiry>.<HMAC-SHA256(expiry)>`, keyed by a hash of the access code: it proves
 * this server issued it and says nothing else. Changing the code signs every browser out. Web
 * Crypto only, so the proxy can use it; it holds no secret of its own, so it isn't `server-only`.
 */

export const ACCESS_COOKIE = 'ds_access';
export const ACCESS_PATH = '/api/access';
/** Thirty days, then the passcode again. */
export const ACCESS_MAX_AGE_S = 30 * 24 * 60 * 60;

const encoder = new TextEncoder();
const TOKEN = /^(\d{10})\.([A-Za-z0-9_-]{43})$/;

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromBase64url = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const digest = async (text: string) =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)));

async function signingKey(code: string) {
  return crypto.subtle.importKey(
    'raw',
    await digest(`dear-steven/access/v1\n${code}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function issueAccessToken(code: string, nowMs: number = Date.now()): Promise<string> {
  const expires = String(Math.floor(nowMs / 1000) + ACCESS_MAX_AGE_S);
  const signature = await crypto.subtle.sign(
    'HMAC',
    await signingKey(code),
    encoder.encode(expires),
  );
  return `${expires}.${base64url(new Uint8Array(signature))}`;
}

/** Signed by this code and not expired. `crypto.subtle.verify` compares in constant time. */
export async function validAccessToken(
  code: string,
  token: string | undefined,
  nowMs: number = Date.now(),
): Promise<boolean> {
  const m = token ? TOKEN.exec(token) : null;
  if (!m?.[1] || !m[2]) return false;
  if (Number(m[1]) * 1000 <= nowMs) return false;
  return crypto.subtle.verify(
    'HMAC',
    await signingKey(code),
    fromBase64url(m[2]),
    encoder.encode(m[1]),
  );
}

/** Compares hashes, so neither the length nor the content of a wrong guess changes the timing. */
export async function codeMatches(input: string, code: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(input), digest(code)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** Always Secure: browsers accept Secure cookies from http://localhost, so local runs work too. */
export function accessCookie(token: string): string {
  return [
    `${ACCESS_COOKIE}=${token}`,
    'Path=/',
    `Max-Age=${ACCESS_MAX_AGE_S}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
  ].join('; ');
}
