import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** The variables the guided setup (P6-04) may write. Every other line of `.env` is left as it is. */
export const SETUP_ENV_KEYS = [
  'OPENAI_API_KEY',
  'YOUTUBE_API_KEY',
  'DEAR_STEVEN_DAILY_BUDGET_USD',
] as const;
export type SetupEnvKey = (typeof SETUP_ENV_KEYS)[number];
/** A value to write, or `null` to remove the variable. */
export type SetupEnvValues = Partial<Record<SetupEnvKey, string | null>>;

/** Keys, ids and amounts only: nothing that could end a line, open a quote or start a comment. */
const SAFE_VALUE = /^[A-Za-z0-9_.-]+$/;
const ASSIGNMENT = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/;

/**
 * `text` with each variable set (or removed): the first assignment is rewritten in place, later
 * duplicates are dropped, new variables are appended. Comments, blank lines and every other
 * variable stay exactly as they were.
 */
export function withEnvValues(text: string, values: SetupEnvValues): string {
  const updates = new Map(Object.entries(values) as [SetupEnvKey, string | null][]);
  for (const [key, value] of updates) {
    if (value !== null && !SAFE_VALUE.test(value)) {
      throw new Error(`Refusing to write ${key}: it has characters a key never has.`);
    }
  }
  const body = text.endsWith('\n') ? text.slice(0, -1) : text;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of body ? body.split('\n') : []) {
    const key = ASSIGNMENT.exec(line)?.[1] as SetupEnvKey | undefined;
    if (!key || !updates.has(key)) {
      out.push(line);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const value = updates.get(key);
    if (value) out.push(`${key}=${value}`);
  }
  for (const [key, value] of updates) if (!seen.has(key) && value) out.push(`${key}=${value}`);
  return out.length ? `${out.join('\n')}\n` : '';
}

/**
 * Writes `values` into the env file at `path` atomically: the new file is written beside it,
 * owner-only, then renamed over the old one, so a crash never leaves half a file of secrets.
 */
export function writeEnvFile(path: string, values: SetupEnvValues): void {
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const next = withEnvValues(current, values);
  const temp = join(dirname(path), `.${basename(path)}.${randomBytes(6).toString('hex')}.tmp`);
  try {
    writeFileSync(temp, next, { mode: 0o600, flag: 'wx' });
    renameSync(temp, path);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
}
