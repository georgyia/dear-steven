import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

/**
 * Server-side configuration. Secrets are read here and nowhere else; this module must never be
 * imported from client components (enforced by `pnpm arch`).
 */
export interface AppConfig {
  openaiApiKey: string | null;
  /** Whose key `openaiApiKey` is: a visitor's own key is used for their request only (P6-03). */
  keySource: KeySource | null;
  /**
   * `DEAR_STEVEN_ALLOW_OPERATOR_KEY`: whether visitors without a key of their own may run on the
   * operator's. On unless set to `0` / `false`, so a local copy keeps working as it did.
   */
  allowOperatorKey: boolean;
  youtubeApiKey: string | null;
  dbPath: string;
  mode: 'live' | 'demo';
  demoReason: 'no_openai_key' | 'forced' | null;
  logAnswers: boolean;
  /**
   * `DEAR_STEVEN_DAILY_BUDGET_USD`: paid calls stop for the rest of the UTC day once the estimated
   * spend reaches it (P6-08). `null` = no cap. Set but unreadable (`5$`, `-1`) fails closed: 0.
   */
  dailyBudgetUsd: number | null;
  /** `DEAR_STEVEN_ACCESS_CODE`: when set, only browsers that entered it can use the API. */
  accessCode: string | null;
}

export type KeySource = 'operator' | 'visitor';

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
    keySource: openaiApiKey ? 'operator' : null,
    allowOperatorKey: !/^(0|false)$/.test(env.DEAR_STEVEN_ALLOW_OPERATOR_KEY?.trim() ?? ''),
    youtubeApiKey: clean(env.YOUTUBE_API_KEY),
    dbPath,
    mode: demoReason ? 'demo' : 'live',
    demoReason,
    logAnswers: flag(env.DEAR_STEVEN_LOG_ANSWERS),
    dailyBudgetUsd: budget(env.DEAR_STEVEN_DAILY_BUDGET_USD),
    accessCode: accessCodeFrom(env),
  };
}

function budget(value: string | undefined): number | null {
  const v = value?.trim();
  if (!v) return null;
  const usd = Number(v);
  return Number.isFinite(usd) && usd >= 0 ? usd : 0;
}

/**
 * The configuration for one web request (P6-03). A visitor's own key (already validated against
 * `VisitorKeySchema`) wins; without one, the operator's key only if the operator allows it.
 * Forced demo mode stays forced, and then a visitor's key is not used at all. The CLI uses
 * `readConfig()` as it is.
 */
export function forVisitor(config: AppConfig, visitorKey: string | null): AppConfig {
  const forced = config.demoReason === 'forced';
  const own = forced ? null : visitorKey;
  const openaiApiKey = own ?? (config.allowOperatorKey ? config.openaiApiKey : null);
  const demoReason = forced ? 'forced' : openaiApiKey ? null : 'no_openai_key';
  return {
    ...config,
    openaiApiKey,
    keySource: own ? 'visitor' : openaiApiKey ? 'operator' : null,
    mode: demoReason ? 'demo' : 'live',
    demoReason,
  };
}

/** Read alone by the request proxy, which must not touch the filesystem on every request. */
export function accessCodeFrom(env: Env = process.env): string | null {
  return clean(env.DEAR_STEVEN_ACCESS_CODE);
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
