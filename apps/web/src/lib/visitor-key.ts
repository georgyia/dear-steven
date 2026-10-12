import { VISITOR_KEY_HEADER, VisitorKeySchema } from '@dear-steven/core/schema';

/**
 * The visitor's own OpenAI key (P6-03). Kept in `sessionStorage` (this tab, until it closes), or
 * in `localStorage` only when they ticked "remember on this device". Never in a cookie, so it is
 * sent only where `keyHeaders()` is spread: this site's own API calls, over HTTPS (or this
 * machine), in the `x-openai-key` header.
 */
const STORAGE_KEY = 'dear-steven-openai-key';

export interface StoredKey {
  key: string;
  remembered: boolean;
}

/** False on plain HTTP from another machine: a key must not cross the network unencrypted. */
export const canUseOwnKey = () => typeof window !== 'undefined' && window.isSecureContext;

/** Runs `use` on the storage, or returns `null` where the browser blocks it (it can throw). */
function withStorage<T>(remembered: boolean, use: (store: Storage) => T): T | null {
  try {
    return use(remembered ? window.localStorage : window.sessionStorage);
  } catch {
    return null;
  }
}

export function storedKey(): StoredKey | null {
  if (!canUseOwnKey()) return null;
  for (const remembered of [false, true]) {
    const key = withStorage(remembered, (store) => store.getItem(STORAGE_KEY));
    if (key === null) continue;
    if (VisitorKeySchema.safeParse(key).success) return { key, remembered };
    // A tampered or stale value is dropped rather than sent.
    withStorage(remembered, (store) => store.removeItem(STORAGE_KEY));
  }
  return null;
}

/** False when the browser won't let the key be kept, so it can't be used either. */
export function saveKey(key: string, remember: boolean): boolean {
  forgetKey();
  return withStorage(remember, (store) => store.setItem(STORAGE_KEY, key)) !== null;
}

export function forgetKey(): void {
  for (const remembered of [false, true]) {
    withStorage(remembered, (store) => store.removeItem(STORAGE_KEY));
  }
}

/** Spread into the headers of every request to this site's API. Empty without a key. */
export function keyHeaders(key: string | undefined = storedKey()?.key): Record<string, string> {
  return key && canUseOwnKey() ? { [VISITOR_KEY_HEADER]: key } : {};
}
