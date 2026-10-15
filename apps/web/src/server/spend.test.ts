import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { forVisitor, readConfig } from '@dear-steven/core/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { overBudget, recordSpend, SpendLedger, spendLedger, spendStatus } from './spend';

const dir = () => mkdtempSync(join(tmpdir(), 'dear-steven-spend-'));
const at = (iso: string) => () => new Date(iso);

describe('SpendLedger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('adds up today and keeps it across a restart', () => {
    const path = join(dir(), 'spend.json');
    const ledger = new SpendLedger(path, at('2026-10-10T12:00:00Z'));
    ledger.record(0.002);
    ledger.record(0.003);
    ledger.record(-1); // never subtracts
    ledger.record(Number.NaN);
    expect(ledger.spentToday()).toBeCloseTo(0.005);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ day: '2026-10-10', usd: 0.005 });
    expect(new SpendLedger(path, at('2026-10-10T23:59:00Z')).spentToday()).toBeCloseTo(0.005);
  });

  it('starts again at midnight UTC', () => {
    let now = new Date('2026-10-10T23:59:00Z');
    const ledger = new SpendLedger(join(dir(), 'spend.json'), () => now);
    ledger.record(1);
    now = new Date('2026-10-11T00:00:01Z');
    expect(ledger.spentToday()).toBe(0);
    expect(new SpendLedger(join(dir(), 'x.json'), () => now).spentToday()).toBe(0);
  });

  it('fails closed on a ledger it cannot read', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const path = join(dir(), 'spend.json');
    writeFileSync(path, '{ not json');
    expect(new SpendLedger(path).spentToday()).toBe(Number.POSITIVE_INFINITY);
    writeFileSync(path, JSON.stringify({ day: '2026-10-10', usd: -3 }));
    expect(new SpendLedger(path, at('2026-10-10T01:00:00Z')).spentToday()).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe('overBudget and spendStatus', () => {
  it('stops at the cap, never without one, and shows a readable status', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const base = dir();
    const config = (budget?: string) =>
      readConfig({
        OPENAI_API_KEY: 'sk-operator',
        DEAR_STEVEN_DB_PATH: join(base, 'kb.db'),
        ...(budget === undefined ? {} : { DEAR_STEVEN_DAILY_BUDGET_USD: budget }),
      });
    expect(overBudget(config('0.01'))).toBe(false);
    spendLedger(config()).record(0.01);
    expect(existsSync(join(base, 'spend.json'))).toBe(true);
    expect(overBudget(config('0.01'))).toBe(true);
    expect(overBudget(config())).toBe(false);
    expect(spendStatus(config('0.5'))).toEqual({ todayUsd: 0.01, capUsd: 0.5 });
    expect(overBudget(config('nonsense'))).toBe(true); // unreadable budget = 0
  });

  it("leaves a visitor's own key out of the operator's cap, both ways (P6-03)", () => {
    const base = dir();
    const operator = readConfig({
      OPENAI_API_KEY: 'sk-operator',
      DEAR_STEVEN_DB_PATH: join(base, 'kb.db'),
      DEAR_STEVEN_DAILY_BUDGET_USD: '0.01',
    });
    const visitor = forVisitor(operator, 'sk-visitor-0000000000000000000000', {
      production: true,
    });
    recordSpend(visitor, 5);
    expect(existsSync(join(base, 'spend.json'))).toBe(false);
    expect(overBudget(operator)).toBe(false);
    recordSpend(operator, 0.01);
    expect(overBudget(operator)).toBe(true);
    expect(overBudget(visitor)).toBe(false);
  });
});
