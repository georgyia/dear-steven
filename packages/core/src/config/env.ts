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
  demoReason: DemoReason | null;
  logAnswers: boolean;
  /**
   * `DEAR_STEVEN_DAILY_BUDGET_USD`: paid calls stop for the rest of the UTC day once the estimated
   * spend reaches it (P6-08). `null` = no cap. Set but unreadable (`5$`, `-1`) fails closed: 0.
   */
  dailyBudgetUsd: number | null;
  /**
   * `DEAR_STEVEN_FREE_QUESTIONS` (P8-02): how many questions a visitor without a key of their own
   * may ask on the operator's key before they need one. `null` (unset) = no per-visitor limit, as a
   * local copy always had. Set but unreadable (`three`, `-1`) fails closed: 0.
   */
  freeQuestions: number | null;
  /** `DEAR_STEVEN_ACCESS_CODE`: when set, only browsers that entered it can use the API. */
  accessCode: string | null;
  /**
   * Where the keys live: `.env` at the repository root, or `DEAR_STEVEN_ENV_FILE`. Read by the web
   * app and the CLI at start-up; written only by the guided local setup (P6-04).
   */
  envFile: string;
  /** `DEAR_STEVEN_FEED_URL`: the podcast feed to discover, instead of looking it up (a mirror, tests). */
  feedUrl: string | null;
  /**
   * `DEAR_STEVEN_PUBLIC_URL`: the deployment's public origin, for absolute links in link previews
   * (P10-10). Only an https origin, or http on localhost; anything else counts as unset.
   */
  publicUrl: string | null;
}

export type KeySource = 'operator' | 'visitor';

/**
 * Why answers are demo fixtures: no key to run on, the operator's key held back by a production
 * web server for want of a daily cap (P10-01), or `DEAR_STEVEN_DEMO`.
 */
export type DemoReason = 'no_openai_key' | 'no_daily_cap' | 'forced';

/**
 * The web server a request's configuration is for (P10-01). `production` is a built server
 * (`next start`, the image), not `pnpm dev`. The web app says which; the CLI never builds a
 * request's configuration, so nothing here changes what it runs on.
 */
export interface WebServer {
  production: boolean;
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
  const root = findRepoRoot(cwd);
  const inRoot = (raw: string | null, fallback: string) =>
    raw ? (isAbsolute(raw) ? raw : resolve(root, raw)) : join(root, fallback);
  const dbPath = inRoot(clean(env.DEAR_STEVEN_DB_PATH), join('data', 'dear-steven.db'));

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
    freeQuestions: allowance(env.DEAR_STEVEN_FREE_QUESTIONS),
    accessCode: accessCodeFrom(env),
    envFile: inRoot(clean(env.DEAR_STEVEN_ENV_FILE), '.env'),
    feedUrl: clean(env.DEAR_STEVEN_FEED_URL),
    publicUrl: publicOrigin(env.DEAR_STEVEN_PUBLIC_URL),
  };
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The origin of an https URL (or http on this machine), else `null`: never a path or a typo. */
function publicOrigin(value: string | undefined): string | null {
  const v = clean(value);
  if (!v) return null;
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return null;
  }
  const local = url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  return url.protocol === 'https:' || local ? url.origin : null;
}

function allowance(value: string | undefined): number | null {
  const v = value?.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 1000 ? n : 0;
}

function budget(value: string | undefined): number | null {
  const v = value?.trim();
  if (!v) return null;
  const usd = Number(v);
  return Number.isFinite(usd) && usd >= 0 ? usd : 0;
}

/**
 * Why a web server won't spend the operator's key although it is set and offered to visitors
 * (P10-01, SR-02): in production, only under a daily cap, since without
 * `DEAR_STEVEN_DAILY_BUDGET_USD` nothing but the per-network rate limit bounds what anyone can
 * spend on it. Any value counts as a cap: an unreadable one is already 0, which spends nothing.
 * `null` when the key may be used, or when there is none to hold back (unset,
 * `DEAR_STEVEN_ALLOW_OPERATOR_KEY=0`, or forced demo).
 */
export function operatorKeyHeldBack(config: AppConfig, server: WebServer): 'no_daily_cap' | null {
  const offered =
    config.demoReason !== 'forced' && config.allowOperatorKey && config.openaiApiKey !== null;
  return server.production && offered && config.dailyBudgetUsd === null ? 'no_daily_cap' : null;
}

/**
 * The configuration for one web request (P6-03). A visitor's own key (already validated against
 * `VisitorKeySchema`) wins; without one, the operator's key only if the operator allows it and,
 * on a production server, has set a daily cap (`operatorKeyHeldBack`). Forced demo mode stays
 * forced, and then a visitor's key is not used at all. The CLI uses `readConfig()` as it is.
 */
export function forVisitor(
  config: AppConfig,
  visitorKey: string | null,
  server: WebServer,
): AppConfig {
  const forced = config.demoReason === 'forced';
  const own = forced ? null : visitorKey;
  const heldBack = operatorKeyHeldBack(config, server);
  const operator = config.allowOperatorKey && !heldBack ? config.openaiApiKey : null;
  const openaiApiKey = own ?? operator;
  const demoReason = forced ? 'forced' : openaiApiKey ? null : (heldBack ?? 'no_openai_key');
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

/**
 * Where the web app finds a request's client address (P8-01), for rate limits. Read per request,
 * like the access code, so it never touches the filesystem.
 *
 * - `DEAR_STEVEN_CLIENT_IP_HEADER`: a header the platform sets and the client can't
 *   (`fly-client-ip`, `cf-connecting-ip`). When set, it is the only source.
 * - Otherwise `X-Forwarded-For`, counted from the right: each proxy appends the address it saw, so
 *   only the last `DEAR_STEVEN_TRUSTED_PROXIES` entries (default 1) were written by this
 *   deployment. The first entry is whatever the client chose to send.
 */
export interface ClientAddressPolicy {
  header: string | null;
  trustedProxies: number;
}

export function clientAddressFrom(env: Env = process.env): ClientAddressPolicy {
  const header = clean(env.DEAR_STEVEN_CLIENT_IP_HEADER)?.toLowerCase() ?? null;
  const proxies = Number(env.DEAR_STEVEN_TRUSTED_PROXIES?.trim() || '1');
  return {
    header: header && /^[a-z0-9-]{1,64}$/.test(header) ? header : null,
    trustedProxies: Number.isInteger(proxies) && proxies >= 1 && proxies <= 10 ? proxies : 1,
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

export {
  SETUP_ENV_KEYS,
  type SetupEnvKey,
  type SetupEnvValues,
  withEnvValues,
  writeEnvFile,
} from './env-file.ts';
