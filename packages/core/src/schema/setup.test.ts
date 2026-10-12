import { describe, expect, it } from 'vitest';
import { embeddingEstimate } from '../openai/embedder.ts';
import { SetupKeysSchema, SetupRunSchema } from './setup.ts';

const KEY = `sk-${'A1b2'.repeat(8)}`;

describe('SetupKeysSchema (P6-04)', () => {
  it('takes keys and a budget, each optional', () => {
    expect(SetupKeysSchema.safeParse({}).success).toBe(true);
    expect(
      SetupKeysSchema.safeParse({
        openaiApiKey: KEY,
        youtubeApiKey: `AIza${'x'.repeat(35)}`,
        dailyBudgetUsd: 2,
      }).success,
    ).toBe(true);
    expect(SetupKeysSchema.safeParse({ dailyBudgetUsd: null }).success).toBe(true);
  });

  it('refuses anything that could become more than one line of .env', () => {
    for (const body of [
      { openaiApiKey: `${KEY}\nDEAR_STEVEN_DEMO=0` },
      { youtubeApiKey: `AIza${'x'.repeat(35)} #` },
      { dailyBudgetUsd: -1 },
      { dailyBudgetUsd: '5' },
      { DEAR_STEVEN_DEMO: '0' },
    ]) {
      expect(SetupKeysSchema.safeParse(body).success, JSON.stringify(body)).toBe(false);
    }
  });
});

describe('SetupRunSchema', () => {
  it('runs only the known stages, within bounds', () => {
    expect(SetupRunSchema.safeParse({ stage: 'transcribe', limit: 20 }).success).toBe(true);
    expect(SetupRunSchema.safeParse({ stage: 'index', budgetUsd: 0.5 }).success).toBe(true);
    for (const body of [
      { stage: 'purge' },
      { stage: 'transcribe', limit: 0 },
      { stage: 'index', budgetUsd: 500 },
      { stage: 'discover', feed: 'http://evil' },
    ]) {
      expect(SetupRunSchema.safeParse(body).success, JSON.stringify(body)).toBe(false);
    }
  });
});

describe('embeddingEstimate', () => {
  it('counts the context prefix and prices the tokens', () => {
    expect(embeddingEstimate({ passages: 1000, tokens: 470_000 })).toEqual({
      passages: 1000,
      tokens: 500_000,
      usd: 0.01,
    });
    expect(embeddingEstimate({ passages: 0, tokens: 0 }).usd).toBe(0);
  });
});
