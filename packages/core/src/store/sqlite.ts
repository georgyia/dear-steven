import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { MIGRATIONS } from './migrations.ts';

export type Db = Database.Database;

export interface OpenOptions {
  /** Create the file (and its folder) if missing. The web app never creates; the CLI does. */
  create?: boolean;
}

export class StoreMissingError extends Error {
  constructor(path: string) {
    super(`No knowledge base at ${path}. Run \`pnpm ingest discover\` to create one.`);
  }
}

/** Opens the knowledge base with sqlite-vec loaded, WAL on, and every migration applied. */
export function openDatabase(path: string, options: OpenOptions = {}): Db {
  const memory = path === ':memory:';
  if (!memory && !existsSync(path)) {
    if (!options.create) throw new StoreMissingError(path);
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  sqliteVec.load(db);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  migrate(db);
  return db;
}

export function migrate(db: Db): number {
  const current = Number(db.pragma('user_version', { simple: true }));
  for (let v = current; v < MIGRATIONS.length; v += 1) {
    const sql = MIGRATIONS[v];
    if (!sql) continue;
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
  return MIGRATIONS.length;
}
