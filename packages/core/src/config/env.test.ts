import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findRepoRoot, readConfig, requireKey } from './env.ts';

const fakeRepo = () => {
  const root = mkdtempSync(join(tmpdir(), 'dear-steven-'));
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n');
  mkdirSync(join(root, 'apps', 'web'), { recursive: true });
  return root;
};

describe('readConfig', () => {
  it('falls back to demo mode without an OpenAI key, instead of crashing', () => {
    const root = fakeRepo();
    const c = readConfig({}, join(root, 'apps', 'web'));
    expect(c.mode).toBe('demo');
    expect(c.demoReason).toBe('no_openai_key');
    expect(c.openaiApiKey).toBe(null);
    expect(c.dbPath).toBe(join(root, 'data', 'dear-steven.db'));
  });

  it('treats .env.example placeholders as missing', () => {
    const c = readConfig({ OPENAI_API_KEY: 'your-openai-api-key', YOUTUBE_API_KEY: ' ' });
    expect(c.openaiApiKey).toBe(null);
    expect(c.youtubeApiKey).toBe(null);
  });

  it('reads the daily budget, and fails closed when it is unreadable', () => {
    expect(readConfig({}).dailyBudgetUsd).toBeNull();
    expect(readConfig({ DEAR_STEVEN_DAILY_BUDGET_USD: ' 2.5 ' }).dailyBudgetUsd).toBe(2.5);
    expect(readConfig({ DEAR_STEVEN_DAILY_BUDGET_USD: '0' }).dailyBudgetUsd).toBe(0);
    expect(readConfig({ DEAR_STEVEN_DAILY_BUDGET_USD: '5$' }).dailyBudgetUsd).toBe(0);
    expect(readConfig({ DEAR_STEVEN_DAILY_BUDGET_USD: '-1' }).dailyBudgetUsd).toBe(0);
  });

  it('reads the access code, ignoring placeholders', () => {
    expect(readConfig({ DEAR_STEVEN_ACCESS_CODE: ' open sesame ' }).accessCode).toBe('open sesame');
    expect(readConfig({ DEAR_STEVEN_ACCESS_CODE: 'changeme' }).accessCode).toBeNull();
    expect(readConfig({}).accessCode).toBeNull();
  });

  it('goes live with a key, unless demo is forced', () => {
    expect(readConfig({ OPENAI_API_KEY: 'sk-test' }).mode).toBe('live');
    const forced = readConfig({ OPENAI_API_KEY: 'sk-test', DEAR_STEVEN_DEMO: '1' });
    expect(forced.mode).toBe('demo');
    expect(forced.demoReason).toBe('forced');
  });

  it('resolves a relative database path against the repo root', () => {
    const root = fakeRepo();
    const c = readConfig({ DEAR_STEVEN_DB_PATH: 'tmp/kb.db' }, join(root, 'apps', 'web'));
    expect(c.dbPath).toBe(join(root, 'tmp', 'kb.db'));
  });
});

describe('findRepoRoot', () => {
  it('finds the workspace root from a nested folder', () => {
    const root = fakeRepo();
    expect(findRepoRoot(join(root, 'apps', 'web'))).toBe(root);
  });
});

describe('requireKey', () => {
  it('explains how to fix a missing key', () => {
    expect(() => requireKey('OPENAI_API_KEY', null)).toThrow(/\.env\.example/);
    expect(requireKey('OPENAI_API_KEY', 'sk')).toBe('sk');
  });
});
