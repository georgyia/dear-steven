import 'server-only';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AppConfig } from '@dear-steven/core/config';

/**
 * The daily spend cap (P6-08, SR-02). Every paid call records its estimated cost (core's
 * `PRICES`); once today's total reaches `DEAR_STEVEN_DAILY_BUDGET_USD`, paid routes stop calling
 * OpenAI until midnight UTC. Kept in memory and saved next to the knowledge base after every call,
 * so a restart doesn't reset the day. One process, one file (ADR-001).
 *
 * Requests already running when the cap is reached still finish, so the total can overshoot by
 * what those cost — a fraction of a cent each.
 */

interface Day {
  day: string;
  usd: number;
}

const utcDay = (now: Date) => now.toISOString().slice(0, 10);

export class SpendLedger {
  private readonly path: string | null;
  private readonly now: () => Date;
  private state: Day;

  constructor(path: string | null, now: () => Date = () => new Date()) {
    this.path = path;
    this.now = now;
    this.state = this.load();
  }

  /** A missing file is a fresh day; a file that exists but can't be read fails closed. */
  private load(): Day {
    const today = utcDay(this.now());
    if (!this.path || !existsSync(this.path)) return { day: today, usd: 0 };
    try {
      const saved = JSON.parse(readFileSync(this.path, 'utf8')) as Partial<Day>;
      if (typeof saved.day !== 'string' || typeof saved.usd !== 'number' || !(saved.usd >= 0)) {
        throw new Error('unexpected contents');
      }
      return saved.day === today ? { day: today, usd: saved.usd } : { day: today, usd: 0 };
    } catch (error) {
      console.error(
        `[spend] ${this.path} is unreadable (${error instanceof Error ? error.message : error}); treating today's budget as spent. Delete the file to reset.`,
      );
      return { day: today, usd: Number.POSITIVE_INFINITY };
    }
  }

  private current(): Day {
    const today = utcDay(this.now());
    if (this.state.day !== today) this.state = { day: today, usd: 0 };
    return this.state;
  }

  spentToday(): number {
    return this.current().usd;
  }

  record(usd: number): void {
    if (!Number.isFinite(usd) || usd <= 0) return;
    this.current().usd += usd;
    this.save();
  }

  private save() {
    if (!this.path || !Number.isFinite(this.state.usd)) return;
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      const tmp = `${this.path}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.state));
      renameSync(tmp, this.path);
    } catch (error) {
      // The cap still holds in memory; only a restart would forget today's spend.
      console.error(
        '[spend] could not save the ledger:',
        error instanceof Error ? error.message : error,
      );
    }
  }
}

const g = globalThis as typeof globalThis & { __dearStevenSpend?: Map<string, SpendLedger> };

/** One ledger per knowledge base, beside it: `data/spend.json`. */
export function spendLedger(config: AppConfig): SpendLedger {
  g.__dearStevenSpend ??= new Map();
  const path = join(dirname(config.dbPath), 'spend.json');
  let ledger = g.__dearStevenSpend.get(path);
  if (!ledger) {
    ledger = new SpendLedger(path);
    g.__dearStevenSpend.set(path, ledger);
  }
  return ledger;
}

/** True once today's spend has reached the cap. No cap, never. */
export function overBudget(config: AppConfig): boolean {
  return (
    config.dailyBudgetUsd !== null && spendLedger(config).spentToday() >= config.dailyBudgetUsd
  );
}

export function spendStatus(config: AppConfig): { todayUsd: number; capUsd: number | null } {
  const spent = spendLedger(config).spentToday();
  return {
    // An unreadable ledger counts as the whole budget, so the status says "resting", not "∞".
    todayUsd: Number.isFinite(spent)
      ? Math.round(spent * 10_000) / 10_000
      : (config.dailyBudgetUsd ?? 0),
    capUsd: config.dailyBudgetUsd,
  };
}
