'use client';

import type { AskMode } from '@dear-steven/core/schema';
import { useCallback, useEffect, useState } from 'react';

export const MODE_KEY = 'dear-steven:mode';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function session(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** The mode this tab chose earlier in the visit; `ask` when there is none, or storage is blocked. */
export function readMode(store: StorageLike | null = session()): AskMode {
  try {
    return store?.getItem(MODE_KEY) === 'talk' ? 'talk' : 'ask';
  } catch {
    return 'ask';
  }
}

export function writeMode(mode: AskMode, store: StorageLike | null = session()): void {
  try {
    store?.setItem(MODE_KEY, mode);
  } catch {
    // Blocked storage: the mode still holds until the page reloads.
  }
}

/**
 * How Steven replies (P7-05), kept for the visit: in this tab's session storage, so a reload keeps
 * it and a new visit starts with Ask. `ask` on the server render and the first client render.
 */
export function useAskMode(): [AskMode, (mode: AskMode) => void] {
  const [mode, setMode] = useState<AskMode>('ask');
  useEffect(() => setMode(readMode()), []);
  const update = useCallback((next: AskMode) => {
    setMode(next);
    writeMode(next);
  }, []);
  return [mode, update];
}
