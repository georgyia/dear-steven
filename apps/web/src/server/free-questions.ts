import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AppConfig } from '@dear-steven/core/config';
import { INTERVIEW_LIMITS, type KnowledgeStatus } from '@dear-steven/core/schema';
import { clientAddress } from './client-address';
import { deploymentSecret } from './deployment-secret';

/**
 * Free questions on the operator's key (P8-02, SR-02). With `DEAR_STEVEN_FREE_QUESTIONS=n`, a visitor
 * without a key of their own gets n questions; then `/api/ask` and `/api/interview` answer
 * `needs_key` and make no OpenAI call. Each Ask or Talk question counts; a whole interview counts
 * once, at its first question, and carries a signed ticket for the rest of it.
 *
 * Who is counted twice over, so that clearing cookies doesn't reset anything for long:
 *  - the visitor: an anonymous cookie, a random id and nothing else, n questions;
 *  - the network it comes from (the client address, IPv6 by /64): 3n, so a shared office still
 *    gets several people's worth.
 * Both are kept for 30 days from their first question, only as HMACs under a deployment secret, in
 * `data/free-questions.json` beside the spend ledger. A determined visitor with many addresses gets
 * more; the daily cap (P6-08) is what bounds the operator's bill, so without one there are no free
 * questions at all (P8-09).
 */
export const VISITOR_COOKIE = 'ds_visitor';
export const TICKET_HEADER = 'x-interview-ticket';
export const NETWORK_FACTOR = 3;
export const WINDOW_MS = 30 * 86_400_000;
/** Beyond this many visitors (or networks) in 30 days, new ones get no free questions. */
export const MAX_ENTRIES = 50_000;
const TICKET_MS = 2 * 3_600_000;
/** An interview's steps: its questions, what was learned, the ending. */
export const TICKET_STEPS = INTERVIEW_LIMITS.maxQuestions + 4;
const VISITOR_ID = /^[A-Za-z0-9_-]{22}$/;

interface Count {
  used: number;
  since: number;
}

interface Saved {
  v: 1;
  visitors: Record<string, Count>;
  networks: Record<string, Count>;
}

/** Who a request is, for counting: hashed, never the raw id or address. */
export interface Visitor {
  /** The raw cookie id, only to set the cookie; never stored. */
  id: string;
  isNew: boolean;
  key: string;
  network: string;
}

export class FreeLedger {
  private readonly path: string | null;
  private readonly now: () => number;
  private readonly visitors = new Map<string, Count>();
  private readonly networks = new Map<string, Count>();
  /** An unreadable ledger fails closed: no free questions until it is fixed or deleted. */
  private readonly broken: boolean;
  private lastPrune = Number.NEGATIVE_INFINITY;
  private saving: ReturnType<typeof setTimeout> | null = null;

  constructor(path: string | null, now: () => number = Date.now) {
    this.path = path;
    this.now = now;
    this.broken = !this.load();
  }

  private load(): boolean {
    if (!this.path || !existsSync(this.path)) return true;
    try {
      const saved = JSON.parse(readFileSync(this.path, 'utf8')) as Partial<Saved>;
      const valid = (r: unknown): r is Record<string, Count> =>
        typeof r === 'object' &&
        r !== null &&
        Object.values(r).every(
          (c) =>
            typeof c === 'object' &&
            c !== null &&
            Number.isInteger((c as Count).used) &&
            (c as Count).used >= 0 &&
            Number.isFinite((c as Count).since),
        );
      if (saved.v !== 1 || !valid(saved.visitors) || !valid(saved.networks)) {
        throw new Error('unexpected contents');
      }
      for (const [k, c] of Object.entries(saved.visitors)) this.visitors.set(k, c);
      for (const [k, c] of Object.entries(saved.networks)) this.networks.set(k, c);
      return true;
    } catch (error) {
      console.error(
        `[free] ${this.path} is unreadable (${error instanceof Error ? error.message : error}); no free questions until it is deleted.`,
      );
      return false;
    }
  }

  /** Written at most once a second, off the request: a restart can lose only the last second. */
  private save() {
    if (!this.path || this.saving) return;
    this.saving = setTimeout(() => this.flush(), 1000);
    this.saving.unref?.();
  }

  flush() {
    if (this.saving) clearTimeout(this.saving);
    this.saving = null;
    if (!this.path) return;
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      const tmp = `${this.path}.tmp`;
      const saved: Saved = {
        v: 1,
        visitors: Object.fromEntries(this.visitors),
        networks: Object.fromEntries(this.networks),
      };
      writeFileSync(tmp, JSON.stringify(saved), { mode: 0o600 });
      renameSync(tmp, this.path);
    } catch (error) {
      // The counts still hold in memory; only a restart would forget them.
      console.error(
        '[free] could not save the ledger:',
        error instanceof Error ? error.name : error,
      );
    }
  }

  /** Drops what is more than 30 days old; at most once an hour, so a question stays cheap. */
  private prune(force = false) {
    const now = this.now();
    if (!force && now - this.lastPrune < 3_600_000) return;
    this.lastPrune = now;
    const cutoff = now - WINDOW_MS;
    for (const map of [this.visitors, this.networks]) {
      for (const [key, c] of map) if (c.since <= cutoff) map.delete(key);
    }
  }

  private count(map: Map<string, Count>, key: string): number {
    const c = map.get(key);
    return c && c.since > this.now() - WINDOW_MS ? c.used : 0;
  }

  /** How many of `limit` this visitor has left, by the stricter of their two counts. */
  remaining(visitor: Visitor, limit: number): number {
    if (this.broken) return 0;
    return Math.max(
      0,
      Math.min(
        limit - this.count(this.visitors, visitor.key),
        limit * NETWORK_FACTOR - this.count(this.networks, visitor.network),
      ),
    );
  }

  /** Counts one question, if there is one left. */
  take(visitor: Visitor, limit: number): boolean {
    if (this.remaining(visitor, limit) < 1) return false;
    const unknown = (map: Map<string, Count>, key: string) => !map.has(key);
    const full = () =>
      (unknown(this.visitors, visitor.key) && this.visitors.size >= MAX_ENTRIES) ||
      (unknown(this.networks, visitor.network) && this.networks.size >= MAX_ENTRIES);
    this.prune();
    if (full()) this.prune(true);
    if (full()) return false;
    const now = this.now();
    for (const [map, key] of [
      [this.visitors, visitor.key],
      [this.networks, visitor.network],
    ] as const) {
      const c = map.get(key);
      map.set(
        key,
        c && c.since > now - WINDOW_MS
          ? { used: c.used + 1, since: c.since }
          : { used: 1, since: now },
      );
    }
    this.save();
    return true;
  }

  /** Gives a counted question back: it cost nothing after all, or failed on our side (P10-05). */
  giveBack(visitor: Visitor) {
    for (const [map, key] of [
      [this.visitors, visitor.key],
      [this.networks, visitor.network],
    ] as const) {
      const c = map.get(key);
      if (c && c.used > 0) map.set(key, { used: c.used - 1, since: c.since });
    }
    this.save();
  }
}

const g = globalThis as typeof globalThis & {
  __dearStevenFree?: Map<string, FreeLedger>;
  __dearStevenTickets?: Map<string, { steps: number; expires: number }>;
  __dearStevenFreeWithoutCap?: boolean;
};

function ledger(config: AppConfig): FreeLedger {
  g.__dearStevenFree ??= new Map();
  const path = join(dirname(config.dbPath), 'free-questions.json');
  let found = g.__dearStevenFree.get(path);
  if (!found) {
    found = new FreeLedger(path);
    g.__dearStevenFree.set(path, found);
  }
  return found;
}

const hmac = (config: AppConfig, what: string) =>
  createHmac('sha256', deploymentSecret(config, 'free-secret'))
    .update(`dear-steven/free/v1/${what}`)
    .digest('base64url')
    .slice(0, 32);

/** Whether this request counts against a limit: the operator's key, with a limit set. */
export const freeLimitApplies = (config: AppConfig) =>
  config.keySource === 'operator' && config.freeQuestions !== null;

/**
 * How many free questions each visitor gets: as many as set, but none without a daily cap (P8-09).
 * Someone with many addresses gets more than n, and only the cap bounds what that costs. Said once
 * in the log, so the operator knows why.
 */
export function freeAllowance(config: AppConfig): number {
  const asked = config.freeQuestions ?? 0;
  if (config.dailyBudgetUsd !== null) return asked;
  if (asked > 0 && !g.__dearStevenFreeWithoutCap) {
    g.__dearStevenFreeWithoutCap = true;
    console.error(
      '[free] DEAR_STEVEN_FREE_QUESTIONS is set without DEAR_STEVEN_DAILY_BUDGET_USD: no free questions until a daily cap bounds what they can cost.',
    );
  }
  return 0;
}

function cookieValue(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

export function visitorOf(config: AppConfig, req: Request): Visitor {
  const sent = cookieValue(req, VISITOR_COOKIE);
  const id = sent && VISITOR_ID.test(sent) ? sent : randomBytes(16).toString('base64url');
  return {
    id,
    isNew: id !== sent,
    key: hmac(config, `visitor:${id}`),
    network: hmac(config, `network:${clientAddress(req)}`),
  };
}

/** Set on a visitor's first free question. Always Secure: browsers accept it from localhost too. */
export const visitorCookie = (id: string) =>
  `${VISITOR_COOKIE}=${id}; Path=/; Max-Age=${Math.floor(WINDOW_MS / 1000)}; HttpOnly; Secure; SameSite=Lax`;

/** This visitor's free questions, for `/api/status`; `null` where no limit applies. */
export function freeStatus(config: AppConfig, req: Request): KnowledgeStatus['free'] {
  if (!freeLimitApplies(config)) return null;
  const limit = freeAllowance(config);
  const remaining = ledger(config).remaining(visitorOf(config, req), limit);
  return { limit, used: limit - remaining, remaining };
}

export type FreeQuestion =
  | { ok: true; visitor: Visitor; giveBack: () => void; cookie: string | null }
  | { ok: false; limit: number };

/** Counts one free question for this request, if it has one left. */
export function takeFreeQuestion(config: AppConfig, req: Request): FreeQuestion {
  const limit = freeAllowance(config);
  const visitor = visitorOf(config, req);
  const book = ledger(config);
  if (!book.take(visitor, limit)) return { ok: false, limit };
  let given = false;
  return {
    ok: true,
    visitor,
    cookie: visitor.isNew ? visitorCookie(visitor.id) : null,
    giveBack: () => {
      if (given) return;
      given = true;
      book.giveBack(visitor);
    },
  };
}

// Interview tickets: `v1.<id>.<expires>.<signature>`, bound to the visitor, good for one interview.

function tickets() {
  g.__dearStevenTickets ??= new Map();
  return g.__dearStevenTickets;
}

const signTicket = (config: AppConfig, id: string, expires: number, visitor: Visitor) =>
  hmac(config, `ticket:${id}.${expires}.${visitor.key}`);

export function issueTicket(config: AppConfig, visitor: Visitor, now = Date.now()): string {
  const id = randomBytes(12).toString('base64url');
  const expires = now + TICKET_MS;
  const open = tickets();
  for (const [k, t] of open) if (t.expires <= now) open.delete(k);
  open.set(id, { steps: 1, expires });
  return `v1.${id}.${expires}.${signTicket(config, id, expires, visitor)}`;
}

/** One more step of a free interview, if `ticket` is this visitor's, unexpired and not used up. */
export function spendTicket(
  config: AppConfig,
  visitor: Visitor,
  ticket: string | null,
  now = Date.now(),
): boolean {
  const [version, id, expiresText, signature, ...rest] = (ticket ?? '').split('.');
  if (version !== 'v1' || !id || !signature || rest.length) return false;
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires <= now) return false;
  const expected = Buffer.from(signTicket(config, id, expires, visitor));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  const open = tickets().get(id);
  if (!open || open.steps >= TICKET_STEPS) return false;
  open.steps += 1;
  return true;
}

export function resetFreeQuestions() {
  for (const book of g.__dearStevenFree?.values() ?? []) book.flush();
  g.__dearStevenFree?.clear();
  g.__dearStevenTickets?.clear();
  g.__dearStevenFreeWithoutCap = false;
}
