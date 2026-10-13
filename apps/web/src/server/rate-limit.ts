import 'server-only';

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
  /** …and thirty a minute in all, because a client can claim any X-Forwarded-For it likes. */
  accessAll: { capacity: 30, refillPerMinute: 30 },
  /** Key checks (P6-03) — the same pair, so this server can't be used to test stolen keys in bulk. */
  keyCheck: { capacity: 5, refillPerMinute: 5 },
  keyCheckAll: { capacity: 30, refillPerMinute: 30 },
} satisfies Record<string, Bucket>;

type Key = keyof typeof BUCKETS;

const state = new Map<string, { tokens: number; at: number }>();
const MAX_KEYS = 10_000;

export function takeToken(bucket: Key, client: string, now: number = Date.now()) {
  const cfg = BUCKETS[bucket];
  const key = `${bucket}:${client}`;
  const prev = state.get(key) ?? { tokens: cfg.capacity, at: now };
  const refilled = Math.min(
    cfg.capacity,
    prev.tokens + ((now - prev.at) / 60_000) * cfg.refillPerMinute,
  );
  if (state.size > MAX_KEYS) state.clear();
  if (refilled < 1) {
    state.set(key, { tokens: refilled, at: now });
    const retryAfter = Math.ceil(((1 - refilled) / cfg.refillPerMinute) * 60);
    return { ok: false as const, retryAfter };
  }
  state.set(key, { tokens: refilled - 1, at: now });
  return { ok: true as const };
}

/** Best-effort client identity. Behind a proxy, the first X-Forwarded-For hop is the client. */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip') || 'local';
}

export function resetRateLimits() {
  state.clear();
}
