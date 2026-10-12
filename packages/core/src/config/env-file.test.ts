import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findRepoRoot, readConfig } from './env.ts';
import { withEnvValues, writeEnvFile } from './env-file.ts';

const KEY = `sk-proj-${'A1b2'.repeat(10)}`;

describe('withEnvValues (P6-04)', () => {
  it('rewrites a variable in place and leaves every other line exactly as it was', () => {
    const before =
      '# Keys\nOPENAI_API_KEY=old\n\nexport YOUTUBE_API_KEY = old-too\nOTHER="x y" # kept\n';
    expect(withEnvValues(before, { OPENAI_API_KEY: KEY, YOUTUBE_API_KEY: 'AIzaNew' })).toBe(
      `# Keys\nOPENAI_API_KEY=${KEY}\n\nYOUTUBE_API_KEY=AIzaNew\nOTHER="x y" # kept\n`,
    );
  });

  it('appends what is new, drops duplicates and removes on null', () => {
    const before = 'DEAR_STEVEN_DAILY_BUDGET_USD=1\nA=1\nDEAR_STEVEN_DAILY_BUDGET_USD=9';
    expect(withEnvValues(before, { DEAR_STEVEN_DAILY_BUDGET_USD: null, OPENAI_API_KEY: KEY })).toBe(
      `A=1\nOPENAI_API_KEY=${KEY}\n`,
    );
    expect(withEnvValues('', { DEAR_STEVEN_DAILY_BUDGET_USD: '2.5' })).toBe(
      'DEAR_STEVEN_DAILY_BUDGET_USD=2.5\n',
    );
    expect(withEnvValues('', {})).toBe('');
  });

  it('never writes a value that could add a line, a quote or a comment', () => {
    for (const value of [`${KEY}\nDEAR_STEVEN_DEMO=0`, `${KEY} #`, `"${KEY}"`, '', 'a b']) {
      expect(() => withEnvValues('', { OPENAI_API_KEY: value }), JSON.stringify(value)).toThrow(
        /Refusing to write OPENAI_API_KEY/,
      );
    }
  });
});

describe('writeEnvFile', () => {
  it('replaces the file atomically, owner-only, and leaves nothing behind', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dear-steven-env-'));
    const path = join(dir, '.env');
    writeFileSync(path, 'A=1\n', { mode: 0o644 });
    writeEnvFile(path, { OPENAI_API_KEY: KEY });
    expect(readFileSync(path, 'utf8')).toBe(`A=1\nOPENAI_API_KEY=${KEY}\n`);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(readdirSync(dir)).toEqual(['.env']);
  });

  it('creates the file when there is none, and changes nothing when a value is refused', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dear-steven-env-'));
    const path = join(dir, '.env');
    writeEnvFile(path, { YOUTUBE_API_KEY: 'AIzaKey' });
    expect(readFileSync(path, 'utf8')).toBe('YOUTUBE_API_KEY=AIzaKey\n');
    expect(() => writeEnvFile(path, { OPENAI_API_KEY: 'x\ny' })).toThrow();
    expect(readFileSync(path, 'utf8')).toBe('YOUTUBE_API_KEY=AIzaKey\n');
    expect(readdirSync(dir)).toEqual(['.env']);
  });
});

describe('readConfig: env file and feed', () => {
  it('reads .env at the repository root unless told otherwise', () => {
    const root = findRepoRoot();
    expect(readConfig({}).envFile).toBe(join(root, '.env'));
    expect(readConfig({ DEAR_STEVEN_ENV_FILE: 'data/test.env' }).envFile).toBe(
      join(root, 'data', 'test.env'),
    );
    expect(readConfig({ DEAR_STEVEN_ENV_FILE: '/tmp/x.env' }).envFile).toBe('/tmp/x.env');
    expect(readConfig({}).feedUrl).toBeNull();
    expect(readConfig({ DEAR_STEVEN_FEED_URL: 'http://127.0.0.1:1/feed.xml' }).feedUrl).toBe(
      'http://127.0.0.1:1/feed.xml',
    );
  });
});
