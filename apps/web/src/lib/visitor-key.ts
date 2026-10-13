import { VISITOR_KEY_HEADER, VisitorKeySchema } from '@dear-steven/core/schema';

/**
 * The visitor's own OpenAI key (P6-03). Kept in `sessionStorage` (this tab, until it closes), or
 * in `localStorage` for 30 days when they ticked "remember on this device". Never in a cookie, so
 * it is sent only where `keyHeaders()` is spread: this site's own API calls, over HTTPS (or this
 * machine), in the `x-openai-key` header.
 *
 * Never as plain text (P8-01): what storage holds is the key sealed with AES-GCM under a key that
 * lives in IndexedDB and can't be exported, so reading the browser's files (a backup, a program
 * scanning for `sk-`) doesn't reveal it. A script running in this page could still use the
 * sealing key; the CSP is what keeps such scripts out (SR-15).
 */
const STORAGE_KEY = 'dear-steven-openai-key';
export const KEY_VAULT_DB = 'dear-steven-key-vault';
const VAULT_STORE = 'keys';
const VAULT_ID = 'seal';
export const REMEMBER_DAYS = 30;
const REMEMBER_MS = REMEMBER_DAYS * 86_400_000;

export interface StoredKey {
  key: string;
  remembered: boolean;
}

/** False on plain HTTP from another machine: a key must not cross the network unencrypted. */
export const canUseOwnKey = () => typeof window !== 'undefined' && window.isSecureContext;

// Sealing. A sealed key reads `v1.<tab|device>.<expires>.<iv>.<ciphertext>`; where it is kept and
// when it expires are authenticated with it, so neither can be changed or moved.

const base64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const unbase64 = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const place = (remembered: boolean) => (remembered ? 'device' : 'tab');
const bound = (where: string, expires: number) =>
  new TextEncoder().encode(`dear-steven-openai-key|v1|${where}|${expires}`);

/** A new sealing key: AES-GCM, 256 bits, and never exportable. */
export const newSealingKey = () =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);

export async function sealKey(
  key: string,
  sealing: CryptoKey,
  remembered: boolean,
  now: number = Date.now(),
): Promise<string> {
  const where = place(remembered);
  const expires = remembered ? now + REMEMBER_MS : 0;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: bound(where, expires) },
    sealing,
    new TextEncoder().encode(key),
  );
  return ['v1', where, String(expires), base64(iv), base64(new Uint8Array(sealed))].join('.');
}

/** The key, or `null` if it is expired, altered, moved, or sealed under another key. */
export async function openKey(
  sealed: string,
  sealing: CryptoKey,
  remembered: boolean,
  now: number = Date.now(),
): Promise<string | null> {
  const [version, where, expiresText, iv, data, ...rest] = sealed.split('.');
  if (version !== 'v1' || where !== place(remembered) || !iv || !data || rest.length) return null;
  const expires = Number(expiresText);
  const fresh = remembered ? expires > now && expires <= now + REMEMBER_MS : expires === 0;
  if (!Number.isSafeInteger(expires) || !fresh) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unbase64(iv), additionalData: bound(where, expires) },
      sealing,
      unbase64(data),
    );
    const key = new TextDecoder().decode(plain);
    return VisitorKeySchema.safeParse(key).success ? key : null;
  } catch {
    return null;
  }
}

// The sealing key, in IndexedDB.

function openVault(retry = true): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(KEY_VAULT_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(VAULT_STORE);
      req.onsuccess = () => {
        const db = req.result;
        if (db.objectStoreNames.contains(VAULT_STORE)) return resolve(db);
        // A vault without its store (made by something else, or half made): start it again.
        db.close();
        if (!retry) return resolve(null);
        dropVault().then(() => openVault(false).then(resolve));
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function vaultRequest<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest,
) {
  return new Promise<T | null>((resolve) => {
    try {
      const req = run(db.transaction(VAULT_STORE, mode).objectStore(VAULT_STORE));
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** The sealing key; with `create`, made and kept if there is none. `null` without IndexedDB. */
async function sealingKey(create: boolean): Promise<CryptoKey | null> {
  const db = await openVault();
  if (!db) return null;
  try {
    const kept = await vaultRequest<CryptoKey>(db, 'readonly', (s) => s.get(VAULT_ID));
    if (kept || !create) return kept;
    const made = await newSealingKey();
    const saved = await vaultRequest<IDBValidKey>(db, 'readwrite', (s) => s.put(made, VAULT_ID));
    return saved === null ? null : made;
  } finally {
    db.close();
  }
}

function dropVault(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(KEY_VAULT_DB);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

// Storage.

/** Runs `use` on the storage, or returns `null` where the browser blocks it (it can throw). */
function withStorage<T>(remembered: boolean, use: (store: Storage) => T): T | null {
  try {
    return use(remembered ? window.localStorage : window.sessionStorage);
  } catch {
    return null;
  }
}

const removeFrom = (remembered: boolean) =>
  withStorage(remembered, (store) => store.removeItem(STORAGE_KEY));

/** Seals `key` and keeps it; false when the browser won't let it be kept. */
async function keep(key: string, remembered: boolean): Promise<boolean> {
  const sealing = await sealingKey(true);
  if (!sealing) return false;
  const sealed = await sealKey(key, sealing, remembered);
  return withStorage(remembered, (store) => store.setItem(STORAGE_KEY, sealed)) !== null;
}

async function load(): Promise<StoredKey | null> {
  for (const remembered of [false, true]) {
    const kept = withStorage(remembered, (store) => store.getItem(STORAGE_KEY));
    if (kept === null) continue;
    // Kept as plain text before P8-01: sealed now, or dropped.
    if (VisitorKeySchema.safeParse(kept).success) {
      if (await keep(kept, remembered)) return { key: kept, remembered };
      removeFrom(remembered);
      continue;
    }
    const sealing = await sealingKey(false);
    const key = sealing && (await openKey(kept, sealing, remembered));
    if (key) return { key, remembered };
    // Expired, altered, or its sealing key was forgotten in another tab: never sent.
    removeFrom(remembered);
  }
  return null;
}

/** What this page has opened; `undefined` until the first look. */
let current: Promise<StoredKey | null> | undefined;
let watching = false;

function watchOtherTabs() {
  if (watching) return;
  watching = true;
  // Forget (or a new key) in another tab: look again rather than keep sending the old one.
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === null) current = undefined;
  });
}

export function storedKey(): Promise<StoredKey | null> {
  if (!canUseOwnKey()) return Promise.resolve(null);
  watchOtherTabs();
  current ??= load();
  return current;
}

/** False when the browser won't let the key be kept, so it can't be used either. */
export async function saveKey(key: string, remember: boolean): Promise<boolean> {
  if (!canUseOwnKey()) return false;
  removeFrom(false);
  removeFrom(true);
  const kept = await keep(key, remember);
  current = Promise.resolve(kept ? { key, remembered: remember } : null);
  return kept;
}

/** Removes the sealed key and the key that sealed it. */
export async function forgetKey(): Promise<void> {
  removeFrom(false);
  removeFrom(true);
  current = Promise.resolve(null);
  await dropVault();
}

/** Spread into the headers of every request to this site's API. Empty without a key. */
export async function keyHeaders(key?: string): Promise<Record<string, string>> {
  const own = key ?? (await storedKey())?.key;
  return own && canUseOwnKey() ? { [VISITOR_KEY_HEADER]: own } : {};
}
