import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

/**
 * Server-side configuration. Secrets are read here and nowhere else; this module must never be
 * imported from client components (enforced by `pnpm arch`).
 */
export interface AppConfig {
  openaiApiKey: string | null;
  youtubeApiKey: string | null;
  dbPath: string;
  mode: 'live' | 'demo';
  demoReason: 'no_openai_key' | 'forced' | null;
  logAnswers: boolean;
}

type Env = Record<string, string | undefined>;

const clean = (value: string | undefined): string | null => {
  const v = value?.trim();
  if (!v || v.startsWith('your-') || v === 'sk-...' || v === 'changeme') return null;
  return v;
};

const flag = (value: string | undefined): boolean => value === '1' || value === 'true';

/** Walks up from `start` to the folder holding `pnpm-workspace.yaml` (the repo root). */
export function findRepoRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(start);
    dir = parent;
  }
}

export function readConfig(env: Env = process.env, cwd: string = process.cwd()): AppConfig {
  const openaiApiKey = clean(env.OPENAI_API_KEY);
  const forced = flag(env.DEAR_STEVEN_DEMO);
  const rawDb = clean(env.DEAR_STEVEN_DB_PATH);
  const root = findRepoRoot(cwd);
  const dbPath = rawDb
    ? isAbsolute(rawDb)
      ? rawDb
      : resolve(root, rawDb)
    : join(root, 'data', 'dear-steven.db');

  const demoReason = forced ? 'forced' : openaiApiKey ? null : 'no_openai_key';
  return {
    openaiApiKey,
    youtubeApiKey: clean(env.YOUTUBE_API_KEY),
    dbPath,
    mode: demoReason ? 'demo' : 'live',
    demoReason,
    logAnswers: flag(env.DEAR_STEVEN_LOG_ANSWERS),
  };
}

/** Throws a readable error for CLI commands that cannot run without a key. */
export function requireKey(
  name: 'OPENAI_API_KEY' | 'YOUTUBE_API_KEY',
  value: string | null,
): string {
  if (value) return value;
  throw new Error(
    `${name} is not set. Add it to .env at the repository root (see .env.example), then re-run.`,
  );
}
