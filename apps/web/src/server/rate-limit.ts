import 'server-only';
import { clientAddress } from './client-address';

/**
 * Per-client token bucket, in memory. Good enough for one process on one machine (the deploy
 * target, ADR-001); a multi-instance deploy would need a shared store. Limits protect the
 * operator's OpenAI bill, not just the server.
 */
export interface Bucket {
  capacity: number;
  refillPerMinute: number;
}

export const BUCKETS = {
  ask: { capacity: 8, refillPerMinute: 6 },
  /** Interview steps (P7-06): one model call each, like a question. */
  interview: { capacity: 8, refillPerMinute: 6 },
  transcribe: { capacity: 10, refillPerMinute: 10 },
  speech: { capacity: 10, refillPerMinute: 10 },
  passages: { capacity: 120, refillPerMinute: 120 },
  /** Opening share links (P6-17): free, but each one inflates and validates a whole answer. */
  share: { capacity: 20, refillPerMinute: 20 },
  /** Passcode guesses (P6-08): five, then one every twelve seconds, per client… */
  access: { capacity: 5, refillPerMinute: 5 },
  /** …and thirty a minute from `EVERYONE`, in case one client looks like many. */
  accessAll: { capacity: 30, refillPerMinute: 30 },
  /** Key checks (P6-03) — the same pair, so this server can't be used to test stolen keys in bulk. */
  keyCheck: { capacity: 5, refillPerMinute: 5 },
  keyCheckAll: { capacity: 30, refillPerMinute: 30 },
} satisfies Record<string, Bucket>;

type Key = keyof typeof BUCKETS;

/** The client of a bucket shared by every request (`accessAll`, `keyCheckAll`). */
export const EVERYONE = '*';

interface Entry {
  bucket: Key;
  tokens: number;
  at: number;
}

/**
 * Per-client entries are bounded; shared ones (a handful) are kept apart and never dropped.
 *
 * Dropping an entry refills it, so only entries that have refilled anyway are ever dropped
 * (P8-01): flooding the limiter with made-up clients can't hand anyone, or everyone, a fresh
 * bucket. While every tracked client is still limited, a client not seen before waits too.
 */
const clients = new Map<string, Entry>();
const shared = new Map<string, Entry>();
export const MAX_CLIENTS = 10_000;
/** At most one sweep a second: under a flood, a full map is answered without scanning it. */
const SWEEP_EVERY_MS = 1_000;
let lastSweep = Number.NEGATIVE_INFINITY;

const refilled = (e: Entry, now: number) =>
  Math.min(
    BUCKETS[e.bucket].capacity,
    e.tokens + ((now - e.at) / 60_000) * BUCKETS[e.bucket].refillPerMinute,
  );

function sweep(now: number) {
  lastSweep = now;
  for (const [key, e] of clients) {
    if (refilled(e, now) >= BUCKETS[e.bucket].capacity) clients.delete(key);
  }
}

const retryAfter = (bucket: Key, tokens: number) =>
  Math.ceil(((1 - tokens) / BUCKETS[bucket].refillPerMinute) * 60);

export function takeToken(bucket: Key, client: string, now: number = Date.now()) {
  const cfg = BUCKETS[bucket];
  const map = client === EVERYONE ? shared : clients;
  const key = `${bucket}:${client}`;
  let prev = map.get(key);
  if (!prev && map === clients && clients.size >= MAX_CLIENTS) {
    if (now - lastSweep >= SWEEP_EVERY_MS) sweep(now);
    if (clients.size >= MAX_CLIENTS) {
      return { ok: false as const, retryAfter: retryAfter(bucket, 0) };
    }
  }
  prev ??= { bucket, tokens: cfg.capacity, at: now };
  const tokens = refilled(prev, now);
  if (tokens < 1) {
    map.set(key, { bucket, tokens, at: now });
    return { ok: false as const, retryAfter: retryAfter(bucket, tokens) };
  }
  map.set(key, { bucket, tokens: tokens - 1, at: now });
  return { ok: true as const };
}

/** The client a request's per-client buckets are counted under (`client-address.ts`). */
export function clientKey(req: Request): string {
  return clientAddress(req);
}

export function resetRateLimits() {
  clients.clear();
  shared.clear();
  lastSweep = Number.NEGATIVE_INFINITY;
}
