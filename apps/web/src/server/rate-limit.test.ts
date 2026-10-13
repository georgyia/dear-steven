import { beforeEach, describe, expect, it } from 'vitest';
import { BUCKETS, EVERYONE, MAX_CLIENTS, resetRateLimits, takeToken } from './rate-limit';

const drain = (bucket: keyof typeof BUCKETS, client: string, now: number) => {
  for (let i = 0; i < BUCKETS[bucket].capacity; i++) takeToken(bucket, client, now);
  return takeToken(bucket, client, now);
};

beforeEach(resetRateLimits);

describe('rate limits', () => {
  it('lets a client through up to its bucket, then asks it to wait', () => {
    const now = 1_000_000;
    expect(drain('keyCheck', '203.0.113.9', now)).toEqual({ ok: false, retryAfter: 12 });
    // Twelve seconds later, one more.
    expect(takeToken('keyCheck', '203.0.113.9', now + 12_000).ok).toBe(true);
  });

  it('counts the shared bucket for everyone at once', () => {
    const now = 1_000_000;
    for (let i = 0; i < BUCKETS.keyCheckAll.capacity; i++) {
      expect(takeToken('keyCheckAll', EVERYONE, now).ok).toBe(true);
    }
    expect(takeToken('keyCheckAll', EVERYONE, now).ok).toBe(false);
  });
});

describe('a flood of made-up clients (P8-01)', () => {
  const flood = (now: number, count = 20_000) => {
    for (let i = 0; i < count; i++) takeToken('passages', `198.51.${i >> 8}.${i & 255}`, now);
  };

  it("refills neither another client's bucket nor a shared one", () => {
    const now = 1_000_000;
    expect(drain('keyCheck', '203.0.113.9', now).ok).toBe(false);
    for (let i = 0; i < BUCKETS.keyCheckAll.capacity; i++) takeToken('keyCheckAll', EVERYONE, now);
    flood(now + 1);
    expect(takeToken('keyCheck', '203.0.113.9', now + 2).ok).toBe(false);
    expect(takeToken('keyCheckAll', EVERYONE, now + 2).ok).toBe(false);
  });

  it('makes a client not seen before wait while every tracked client is still limited', () => {
    const now = 1_000_000;
    flood(now);
    expect(takeToken('ask', '192.0.2.1', now + 10)).toMatchObject({ ok: false });
  });

  it('forgets only clients whose buckets have refilled anyway', () => {
    const now = 1_000_000;
    expect(drain('keyCheck', '203.0.113.9', now)).toMatchObject({ ok: false });
    flood(now, MAX_CLIENTS);
    expect(takeToken('ask', '192.0.2.1', now).ok).toBe(false);
    // One passage request refills in half a second: a minute on, the flood is forgotten
    // and new clients get in, but the drained key check (12 s a token) is still owed.
    expect(takeToken('ask', '192.0.2.1', now + 1_000).ok).toBe(true);
    expect(takeToken('keyCheck', '203.0.113.9', now + 1_000).ok).toBe(false);
  });
});
