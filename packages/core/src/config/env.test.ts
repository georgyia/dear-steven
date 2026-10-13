import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { clientAddressFrom, findRepoRoot, forVisitor, readConfig, requireKey } from './env.ts';

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

describe('forVisitor (P6-03)', () => {
  const OWN = 'sk-visitor-0000000000000000000000';
  const operator = (env: Record<string, string> = {}) =>
    readConfig({ OPENAI_API_KEY: 'sk-operator', ...env });

  it("runs on the visitor's own key when there is one", () => {
    for (const config of [readConfig({}), operator()]) {
      const c = forVisitor(config, OWN);
      expect(c).toMatchObject({ openaiApiKey: OWN, keySource: 'visitor', mode: 'live' });
      expect(c.demoReason).toBeNull();
    }
  });

  it("falls back to the operator's key unless the operator says no", () => {
    expect(operator().allowOperatorKey).toBe(true);
    expect(forVisitor(operator(), null)).toMatchObject({
      openaiApiKey: 'sk-operator',
      keySource: 'operator',
      mode: 'live',
    });
    for (const off of ['0', 'false', ' false ']) {
      const config = operator({ DEAR_STEVEN_ALLOW_OPERATOR_KEY: off });
      expect(config.allowOperatorKey).toBe(false);
      expect(config.openaiApiKey).toBe('sk-operator');
      expect(forVisitor(config, null)).toMatchObject({
        openaiApiKey: null,
        keySource: null,
        mode: 'demo',
        demoReason: 'no_openai_key',
      });
      expect(forVisitor(config, OWN).keySource).toBe('visitor');
    }
  });

  it('stays demo with neither key', () => {
    expect(forVisitor(readConfig({}), null)).toMatchObject({ mode: 'demo', keySource: null });
  });

  it("ignores the visitor's key when demo mode is forced", () => {
    const c = forVisitor(operator({ DEAR_STEVEN_DEMO: '1' }), OWN);
    expect(c).toMatchObject({ mode: 'demo', demoReason: 'forced', keySource: 'operator' });
    expect(c.openaiApiKey).not.toBe(OWN);
  });
});

describe('clientAddressFrom (P8-01)', () => {
  it('trusts the last X-Forwarded-For entry by default', () => {
    expect(clientAddressFrom({})).toEqual({ header: null, trustedProxies: 1 });
  });

  it('reads a platform header and a proxy count', () => {
    expect(
      clientAddressFrom({
        DEAR_STEVEN_CLIENT_IP_HEADER: ' Fly-Client-IP ',
        DEAR_STEVEN_TRUSTED_PROXIES: '2',
      }),
    ).toEqual({ header: 'fly-client-ip', trustedProxies: 2 });
  });

  it('ignores values it cannot use rather than trusting more than it should', () => {
    expect(
      clientAddressFrom({
        DEAR_STEVEN_CLIENT_IP_HEADER: 'x-real-ip: 1.2.3.4',
        DEAR_STEVEN_TRUSTED_PROXIES: '0',
      }),
    ).toEqual({ header: null, trustedProxies: 1 });
    expect(clientAddressFrom({ DEAR_STEVEN_TRUSTED_PROXIES: '99' }).trustedProxies).toBe(1);
    expect(clientAddressFrom({ DEAR_STEVEN_TRUSTED_PROXIES: '1.5' }).trustedProxies).toBe(1);
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
