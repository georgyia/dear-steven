import 'server-only';
import { type ClientAddressPolicy, clientAddressFrom } from '@dear-steven/core/config';

/**
 * Who a request comes from, as far as this deployment can tell (P8-01): the key its rate limits
 * are counted under. The address comes from where `clientAddressFrom` says this deployment can
 * trust it, never from the first `X-Forwarded-For` entry, which the client writes itself.
 *
 * IPv6 addresses count by their /64, the block a single subscriber is given, so stepping through
 * the addresses of one connection is still one client.
 */
export function clientAddress(
  req: Request,
  policy: ClientAddressPolicy = clientAddressFrom(),
): string {
  const raw = policy.header
    ? req.headers.get(policy.header)
    : nearestHop(req.headers.get('x-forwarded-for'), policy.trustedProxies);
  return normaliseAddress(raw) ?? 'unknown';
}

/** The entry `trusted` places from the right; with fewer entries, the first. */
function nearestHop(forwarded: string | null, trusted: number): string | null {
  const hops = (forwarded ?? '')
    .split(',')
    .map((hop) => hop.trim())
    .filter(Boolean);
  return hops.length ? (hops[Math.max(0, hops.length - trusted)] ?? null) : null;
}

/** An IPv4 address as it is, an IPv6 address as its /64, anything else `null`. */
export function normaliseAddress(raw: string | null | undefined): string | null {
  let address = raw?.trim() ?? '';
  const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(address);
  if (bracketed?.[1]) address = bracketed[1];
  else if (/^[\d.]+:\d{1,5}$/.test(address)) address = address.slice(0, address.lastIndexOf(':'));
  address = address.replace(/%[\w.-]+$/, ''); // an interface zone ("fe80::1%eth0")
  const mapped = /^::ffff:([\d.]+)$/i.exec(address);
  if (mapped?.[1]) address = mapped[1];
  if (isIPv4(address)) return address;
  const groups = ipv6Groups(address);
  return groups ? `${groups.slice(0, 4).join(':')}::/64` : null;
}

function isIPv4(address: string): boolean {
  const parts = address.split('.');
  return parts.length === 4 && parts.every((p) => /^(0|[1-9]\d{0,2})$/.test(p) && Number(p) <= 255);
}

/** The eight groups of an IPv6 address, without leading zeros; `null` if it isn't one. */
function ipv6Groups(address: string): string[] | null {
  if (!/^[\da-f:.]+$/i.test(address) || address.split('::').length > 2) return null;
  const [head = '', tail] = address.split('::');
  const split = (part: string) => (part ? part.split(':') : []);
  const left = split(head);
  const right = tail === undefined ? [] : split(tail);
  // A dotted IPv4 tail ("64:ff9b::192.0.2.1") is the last two groups.
  const last = right.length ? right : left;
  const dotted = last.at(-1);
  if (dotted?.includes('.')) {
    if (!isIPv4(dotted)) return null;
    const [a, b, c, d] = dotted.split('.').map(Number) as [number, number, number, number];
    last.splice(-1, 1, ((a << 8) | b).toString(16), ((c << 8) | d).toString(16));
  }
  const missing = 8 - left.length - right.length;
  if (tail === undefined ? missing !== 0 : missing < 1) return null;
  const groups = [...left, ...Array<string>(tail === undefined ? 0 : missing).fill('0'), ...right];
  if (!groups.every((g) => /^[\da-f]{1,4}$/i.test(g))) return null;
  return groups.map((g) => Number.parseInt(g, 16).toString(16));
}
