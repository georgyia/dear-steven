/**
 * Requests sent from other sites' pages (P8-08, SR-23). A page anywhere can make its visitors'
 * browsers POST here with a "simple" request (`text/plain`, a form), which needs no preflight. It
 * can't read the answer, but the server would still ask OpenAI: on the operator's key, from each
 * visitor's own address, and counted against their network's free questions. So `src/proxy.ts`
 * refuses an API request that isn't a read when it comes from another site's page.
 *
 * Browsers say where a request comes from: Fetch Metadata (`Sec-Fetch-Site`) and, on every POST,
 * `Origin`. A request with neither doesn't come from a page (a script, `curl`): it can't borrow
 * anyone's browser, and the rate limits count it like anyone else. Web APIs only, for the proxy.
 */

const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function fromAnotherSite(request: { method: string; headers: Headers }): boolean {
  if (READS.has(request.method.toUpperCase())) return false;
  const site = request.headers.get('sec-fetch-site');
  if (site !== null) return site !== 'same-origin' && site !== 'none';
  const origin = request.headers.get('origin');
  if (origin === null) return false;
  return !ownHosts(request.headers).some((host) => sameHost(origin, host));
}

/** The host the browser asked for: `Host`, or what a proxy in front says it was. */
const ownHosts = (headers: Headers) =>
  [headers.get('host'), ...(headers.get('x-forwarded-host') ?? '').split(',')]
    .map((host) => host?.trim())
    .filter((host): host is string => Boolean(host));

/** `Origin` names this host, default ports included (`null` and anything unreadable don't). */
function sameHost(origin: string, host: string): boolean {
  try {
    const from = new URL(origin);
    return new URL(`${from.protocol}//${host}`).host === from.host;
  } catch {
    return false;
  }
}
