import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  clientAddressFrom,
  findRepoRoot,
  forVisitor,
  operatorKeyHeldBack,
  readConfig,
  requireKey,
} from './env.ts';

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

  it('reads the public origin for link previews, and nothing that could mislead (P10-10)', () => {
    const origin = (v?: string) =>
      readConfig(v === undefined ? {} : { DEAR_STEVEN_PUBLIC_URL: v }).publicUrl;
    expect(origin()).toBeNull();
    expect(origin(' ')).toBeNull();
    expect(origin('https://steven.example')).toBe('https://steven.example');
    expect(origin('https://steven.example/some/path?q=1#x')).toBe('https://steven.example');
    expect(origin('https://steven.example:8443/')).toBe('https://steven.example:8443');
    expect(origin('http://localhost:3000')).toBe('http://localhost:3000');
    expect(origin('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
    expect(origin('http://steven.example')).toBeNull();
    expect(origin('steven.example')).toBeNull();
    expect(origin('javascript:alert(1)')).toBeNull();
    expect(origin('ftp://steven.example')).toBeNull();
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

const OWN = 'sk-visitor-0000000000000000000000';
const operator = (env: Record<string, string> = {}) =>
  readConfig({ OPENAI_API_KEY: 'sk-operator', ...env });
const DEV = { production: false };
const PRODUCTION = { production: true };

describe('forVisitor (P6-03)', () => {
  it("runs on the visitor's own key when there is one", () => {
    for (const config of [readConfig({}), operator()]) {
      const c = forVisitor(config, OWN, DEV);
      expect(c).toMatchObject({ openaiApiKey: OWN, keySource: 'visitor', mode: 'live' });
      expect(c.demoReason).toBeNull();
    }
  });

  it("falls back to the operator's key unless the operator says no", () => {
    expect(operator().allowOperatorKey).toBe(true);
    expect(forVisitor(operator(), null, DEV)).toMatchObject({
      openaiApiKey: 'sk-operator',
      keySource: 'operator',
      mode: 'live',
    });
    for (const off of ['0', 'false', ' false ']) {
      const config = operator({ DEAR_STEVEN_ALLOW_OPERATOR_KEY: off });
      expect(config.allowOperatorKey).toBe(false);
      expect(config.openaiApiKey).toBe('sk-operator');
      expect(forVisitor(config, null, DEV)).toMatchObject({
        openaiApiKey: null,
        keySource: null,
        mode: 'demo',
        demoReason: 'no_openai_key',
      });
      expect(forVisitor(config, OWN, DEV).keySource).toBe('visitor');
    }
  });

  it('stays demo with neither key', () => {
    expect(forVisitor(readConfig({}), null, DEV)).toMatchObject({ mode: 'demo', keySource: null });
  });

  it("ignores the visitor's key when demo mode is forced", () => {
    const c = forVisitor(operator({ DEAR_STEVEN_DEMO: '1' }), OWN, DEV);
    expect(c).toMatchObject({ mode: 'demo', demoReason: 'forced', keySource: 'operator' });
    expect(c.openaiApiKey).not.toBe(OWN);
  });
});

describe("the operator's key on a production server needs a daily cap (P10-01)", () => {
  const NO_KEY = { OPENAI_API_KEY: '' };
  const OFF = { DEAR_STEVEN_ALLOW_OPERATOR_KEY: '0' };
  const cap = (usd: string) => ({ DEAR_STEVEN_DAILY_BUDGET_USD: usd });
  const live = (keySource: 'operator' | 'visitor') => ({
    mode: 'live',
    keySource,
    demoReason: null,
  });
  const demo = (demoReason: string) => ({ mode: 'demo', keySource: null, demoReason });

  it.each([
    // server, environment, visitor's key → this request's configuration, and what is held back
    ['production', {}, null, demo('no_daily_cap'), 'no_daily_cap'],
    ['production', {}, OWN, live('visitor'), 'no_daily_cap'],
    ['production', cap('2'), null, live('operator'), null],
    ['production', cap('0'), null, live('operator'), null],
    ['production', cap('5$'), null, live('operator'), null],
    ['production', OFF, null, demo('no_openai_key'), null],
    ['production', OFF, OWN, live('visitor'), null],
    ['production', NO_KEY, null, demo('no_openai_key'), null],
    ['production', { ...NO_KEY, ...cap('2') }, null, demo('no_openai_key'), null],
    ['production', NO_KEY, OWN, live('visitor'), null],
    ['production', { DEAR_STEVEN_DEMO: '1' }, OWN, { mode: 'demo', demoReason: 'forced' }, null],
    ['development', {}, null, live('operator'), null],
    ['development', cap('2'), null, live('operator'), null],
    ['development', OFF, null, demo('no_openai_key'), null],
    ['development', NO_KEY, null, demo('no_openai_key'), null],
    ['development', {}, OWN, live('visitor'), null],
  ] as const)('%s, %o, visitor key %s', (server, env, visitorKey, expected, heldBack) => {
    const where = server === 'production' ? PRODUCTION : DEV;
    const config = operator(env);
    expect(operatorKeyHeldBack(config, where)).toBe(heldBack);
    const c = forVisitor(config, visitorKey, where);
    expect(c).toMatchObject(expected);
    expect(c.openaiApiKey).toBe(
      c.keySource === 'visitor' ? OWN : c.keySource === 'operator' ? 'sk-operator' : null,
    );
  });

  it('leaves what the CLI runs on unchanged: readConfig never reads NODE_ENV', () => {
    const c = readConfig({ OPENAI_API_KEY: 'sk-operator', NODE_ENV: 'production' });
    expect(c).toMatchObject({ openaiApiKey: 'sk-operator', mode: 'live', demoReason: null });
    expect(c.dailyBudgetUsd).toBeNull();
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
