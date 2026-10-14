import 'server-only';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AppConfig } from '@dear-steven/core/config';

const SECRET_BYTES = 32;

const g = globalThis as typeof globalThis & { __dearStevenSecrets?: Map<string, Buffer> };

/**
 * A signing secret only this deployment knows: `name` beside the knowledge base, created on first
 * use (owner-only), one per purpose (share links P6-17, free questions P8-02). If it can't be saved,
 * a per-process secret still works, and whatever it signed stops verifying after a restart.
 */
export function deploymentSecret(config: AppConfig, name: string): Buffer {
  g.__dearStevenSecrets ??= new Map();
  const path = join(dirname(config.dbPath), name);
  let key = g.__dearStevenSecrets.get(path) ?? readSecret(path);
  if (!key) {
    key = randomBytes(SECRET_BYTES);
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, key, { mode: 0o600, flag: 'wx' });
    } catch (error) {
      // Another request may have just created it.
      const saved = readSecret(path);
      if (saved) key = saved;
      else {
        console.error(
          `[secret] could not save ${name}; what it signs stops verifying after a restart:`,
          error instanceof Error ? error.name : error,
        );
      }
    }
  }
  g.__dearStevenSecrets.set(path, key);
  return key;
}

function readSecret(path: string): Buffer | null {
  try {
    const saved = readFileSync(path);
    return saved.length >= SECRET_BYTES ? saved : null;
  } catch {
    return null;
  }
}
