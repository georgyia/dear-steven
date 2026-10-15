import 'server-only';
import { accessSync, constants, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AppConfig } from '@dear-steven/core/config';
import { getStore } from './knowledge';

/** Why this deployment can't do what it was configured to do (P10-02). */
export type HealthReason =
  | 'no_database'
  | 'empty'
  | 'store_error'
  | 'data_dir_read_only'
  | 'no_daily_cap';

export type Health = { ok: true } | { ok: false; reason: HealthReason };

const failed = (reason: HealthReason): Health => ({ ok: false, reason });

/**
 * Whether this deployment can answer as configured, for the container's and the platform's health
 * checks (P10-02). Forced demo needs nothing. Otherwise, live or keyless on purpose (visitors
 * bring their own key), the knowledge base must be ready: the database opens and has passages,
 * and the folder it lives in can be written, or the spend ledger, the free-question counts and
 * the share-link secret fail on every save. A production server holding back the operator's key
 * (P10-01) is not healthy either. Never calls OpenAI: a poll must cost nothing.
 */
export function healthOf(config: AppConfig): Health {
  if (config.demoReason === 'forced') return { ok: true };
  if (config.demoReason === 'no_daily_cap') return failed('no_daily_cap');
  if (!existsSync(config.dbPath)) return failed('no_database');
  if (!writable(dirname(config.dbPath))) return failed('data_dir_read_only');
  let passages: number;
  try {
    const store = getStore(config);
    if (!store) return failed('no_database');
    passages = store.stats().passages;
  } catch {
    // The reason is all a public check may say; `/api/status` logs the detail.
    return failed('store_error');
  }
  return passages > 0 ? { ok: true } : failed('empty');
}

function writable(dir: string): boolean {
  try {
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
