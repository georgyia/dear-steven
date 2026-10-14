import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from '@dear-steven/core/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FreeLedger,
  freeStatus,
  issueTicket,
  MAX_ENTRIES,
  NETWORK_FACTOR,
  resetFreeQuestions,
  spendTicket,
  TICKET_STEPS,
  takeFreeQuestion,
  VISITOR_COOKIE,
  type Visitor,
  visitorOf,
  WINDOW_MS,
} from './free-questions';

/** Free questions on the operator's key (P8-02): who is counted, for how long, and the tickets. */
const DAY = 86_400_000;
const visitor = (key: string, network = 'net-1'): Visitor => ({
  id: key.padEnd(22, 'x'),
  isNew: false,
  key,
  network,
});

let dir: string;
beforeEach(() => {
  resetFreeQuestions();
  dir = mkdtempSync(join(tmpdir(), 'dear-steven-free-'));
});
afterEach(() => vi.restoreAllMocks());

describe('FreeLedger', () => {
  it('counts each visitor up to the limit, and gives back what cost nothing', () => {
    const ledger = new FreeLedger(join(dir, 'free.json'));
    const sam = visitor('sam');
    expect(ledger.remaining(sam, 3)).toBe(3);
    expect([ledger.take(sam, 3), ledger.take(sam, 3), ledger.take(sam, 3)]).toEqual([
      true,
      true,
      true,
    ]);
    expect(ledger.take(sam, 3)).toBe(false);
    ledger.giveBack(sam);
    expect(ledger.remaining(sam, 3)).toBe(1);
  });

  it('counts the network too, so a new cookie only helps until it has had 3n', () => {
    const ledger = new FreeLedger(null);
    let taken = 0;
    for (let i = 0; i < 20; i++) {
      // A fresh cookie every time, from the same network.
      const fresh = visitor(`cookie-${i}`);
      while (ledger.take(fresh, 3)) taken += 1;
    }
    expect(taken).toBe(3 * NETWORK_FACTOR);
    // Another network is not affected.
    expect(ledger.remaining(visitor('cookie-0', 'net-2'), 3)).toBe(0);
    expect(ledger.remaining(visitor('someone-else', 'net-2'), 3)).toBe(3);
  });

  it('forgets everything after 30 days, and keeps what it knows across a restart', () => {
    let now = Date.UTC(2026, 9, 13);
    const path = join(dir, 'free.json');
    const ledger = new FreeLedger(path, () => now);
    const sam = visitor('sam');
    while (ledger.take(sam, 3));
    ledger.flush();
    expect(new FreeLedger(path, () => now).remaining(sam, 3)).toBe(0);
    now += WINDOW_MS - DAY;
    expect(ledger.remaining(sam, 3)).toBe(0);
    now += DAY;
    expect(ledger.remaining(sam, 3)).toBe(3);
    ledger.take(sam, 3);
    ledger.flush();
    const saved = JSON.parse(readFileSync(path, 'utf8')) as { visitors: Record<string, unknown> };
    expect(Object.keys(saved.visitors)).toEqual(['sam']);
  });

  it('holds only the hashes it is given: no address, no cookie', () => {
    const config = readConfig({
      DEAR_STEVEN_DB_PATH: join(dir, 'kb.db'),
      OPENAI_API_KEY: 'sk-test-not-a-real-key',
      DEAR_STEVEN_FREE_QUESTIONS: '3',
    });
    const req = new Request('https://x.test/api/ask', {
      headers: {
        'x-forwarded-for': '203.0.113.9',
        cookie: `${VISITOR_COOKIE}=AAAAAAAAAAAAAAAAAAAAAA`,
      },
    });
    expect(takeFreeQuestion(config, req).ok).toBe(true);
    resetFreeQuestions(); // writes the ledger out
    const saved = readFileSync(join(dir, 'free-questions.json'), 'utf8');
    expect(saved).not.toContain('203.0.113');
    expect(saved).not.toContain('AAAAAAAAAAAAAAAAAAAAAA');
  });

  it('fails closed when its file is unreadable, or when it is full', () => {
    const path = join(dir, 'free.json');
    writeFileSync(path, '{"v": 1, "visitors": "nope"}');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(new FreeLedger(path).take(visitor('sam'), 3)).toBe(false);

    const full = new FreeLedger(null);
    for (let i = 0; i < MAX_ENTRIES; i++) full.take(visitor(`v${i}`, `n${i}`), 3);
    expect(full.take(visitor('one-more', 'another'), 3)).toBe(false);
    // Those already counted carry on.
    expect(full.take(visitor('v0', 'n0'), 3)).toBe(true);
  });
});

describe('the visitor and their status', () => {
  const config = () =>
    readConfig({
      DEAR_STEVEN_DB_PATH: join(dir, 'kb.db'),
      OPENAI_API_KEY: 'sk-test-not-a-real-key',
      DEAR_STEVEN_FREE_QUESTIONS: '3',
    });

  it('is a new visitor without a well-formed cookie, and the same one with it', () => {
    const c = config();
    const fresh = visitorOf(
      c,
      new Request('https://x.test/', { headers: { cookie: `${VISITOR_COOKIE}=<script>` } }),
    );
    expect(fresh.isNew).toBe(true);
    expect(fresh.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const back = visitorOf(
      c,
      new Request('https://x.test/', { headers: { cookie: `a=1; ${VISITOR_COOKIE}=${fresh.id}` } }),
    );
    expect(back).toMatchObject({ id: fresh.id, isNew: false, key: fresh.key });
  });

  it('sets the cookie with the first counted question, HttpOnly, Secure, SameSite', () => {
    const taken = takeFreeQuestion(config(), new Request('https://x.test/api/ask'));
    expect(taken.ok && taken.cookie).toMatch(
      new RegExp(
        `^${VISITOR_COOKIE}=[A-Za-z0-9_-]{22}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax$`,
      ),
    );
  });

  it('reports what is left, and nothing at all where no limit applies', () => {
    const c = config();
    const req = new Request('https://x.test/', {
      headers: { cookie: `${VISITOR_COOKIE}=BBBBBBBBBBBBBBBBBBBBBB` },
    });
    expect(freeStatus(c, req)).toEqual({ limit: 3, used: 0, remaining: 3 });
    takeFreeQuestion(c, req);
    expect(freeStatus(c, req)).toEqual({ limit: 3, used: 1, remaining: 2 });
    expect(freeStatus({ ...c, freeQuestions: null }, req)).toBe(null);
    expect(freeStatus({ ...c, keySource: 'visitor' }, req)).toBe(null);
  });
});

describe('interview tickets', () => {
  const config = () =>
    readConfig({
      DEAR_STEVEN_DB_PATH: join(dir, 'kb.db'),
      OPENAI_API_KEY: 'sk-test-not-a-real-key',
    });

  it('cover one interview, for its usual length', () => {
    const c = config();
    const sam = visitor('sam');
    const ticket = issueTicket(c, sam);
    let steps = 1;
    while (spendTicket(c, sam, ticket)) steps += 1;
    expect(steps).toBe(TICKET_STEPS);
  });

  it('are refused when forged, expired, someone else’s, or missing', () => {
    const c = config();
    const sam = visitor('sam');
    const now = Date.now();
    const ticket = issueTicket(c, sam, now);
    const [v, id, expires, signature] = ticket.split('.');
    expect(spendTicket(c, sam, `${v}.${id}.${Number(expires) + 60_000}.${signature}`)).toBe(false);
    expect(spendTicket(c, sam, `${v}.${id}.${expires}.${signature?.replace(/^./, 'A')}x`)).toBe(
      false,
    );
    expect(spendTicket(c, visitor('someone-else'), ticket)).toBe(false);
    expect(spendTicket(c, sam, ticket, Number(expires) + 1)).toBe(false);
    expect(spendTicket(c, sam, null)).toBe(false);
    expect(spendTicket(c, sam, 'v1.made-up.9999999999999.sig')).toBe(false);
    // The real one still works.
    expect(spendTicket(c, sam, ticket)).toBe(true);
  });
});
