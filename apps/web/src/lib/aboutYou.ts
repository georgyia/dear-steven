import { LIMITS } from '@dear-steven/core/limits';
import type { LearnedLine } from '@dear-steven/core/schema';

/**
 * What Dear Steven keeps about you (P7-08), on this device only: a short text, built from "What I
 * learned about you" when you choose to keep it, editable, and sent with your questions exactly as
 * shown. Nothing is written until you choose to keep it; Forget deletes the database at once.
 */

export interface StoredAbout {
  version: 1;
  savedAt: string;
  text: string;
}

export const ABOUT_DB = 'dear-steven-about-you';
const STORE = 'about';
const KEY = 'current';

/** Tidy and bound what will be kept and sent: one space between words, at most 600 characters. */
export function cleanAbout(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, LIMITS.aboutChars).trim();
}

/**
 * The learned lines as one short text, whole lines only, within the limit. From each line's text,
 * or, for demo lines (whose text is a fixed heading), from the visitor's own words beneath it.
 */
export function aboutFromLearned(
  lines: Pick<LearnedLine, 'text' | 'evidence'>[],
  from: 'text' | 'evidence' = 'text',
): string {
  let out = '';
  for (const line of lines) {
    const part = from === 'evidence' ? line.evidence : line.text;
    const next = cleanAbout(out ? `${out} ${part}` : part);
    if (next.length >= LIMITS.aboutChars && out) break;
    out = next;
  }
  return out;
}

/** Reads what was stored as untrusted input: anything that isn't a short text is dropped. */
export function parseAbout(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<StoredAbout>;
  if (o.version !== 1 || typeof o.text !== 'string') return null;
  const text = cleanAbout(o.text);
  return text && o.text.trim().length <= LIMITS.aboutChars ? text : null;
}

const promised = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Opens the database; with `create: false`, one that doesn't exist yet is never made. */
function open(create: boolean): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(ABOUT_DB, 1);
    req.onupgradeneeded = (e) => {
      if (!create && e.oldVersion === 0) {
        req.transaction?.abort();
        return;
      }
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => (create ? reject(req.error) : resolve(null));
  });
}

/** What is kept, or `null` if nothing is (or storage is blocked). */
export async function loadAbout(): Promise<string | null> {
  try {
    const db = await open(false);
    if (!db) return null;
    try {
      return parseAbout(await promised(db.transaction(STORE).objectStore(STORE).get(KEY)));
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function saveAbout(text: string, now = new Date()): Promise<boolean> {
  const clean = cleanAbout(text);
  if (!clean) return false;
  try {
    const db = await open(true);
    if (!db) return false;
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(
        { version: 1, savedAt: now.toISOString(), text: clean } satisfies StoredAbout,
        KEY,
      );
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      return true;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

/** Deletes the whole database: the text, and the fact that anything was kept. */
export async function forgetAbout(): Promise<boolean> {
  try {
    await promised(indexedDB.deleteDatabase(ABOUT_DB) as IDBRequest<unknown>);
    return true;
  } catch {
    return false;
  }
}
