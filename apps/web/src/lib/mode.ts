'use client';

import type { AskMode } from '@dear-steven/core/schema';
import { useCallback, useEffect, useState } from 'react';

export const MODE_KEY = 'dear-steven:mode';

/** What the composer does (P7-05, P7-06): ask or talk to Dear Steven, or be interviewed. */
export type StageMode = AskMode | 'interview';
const MODES: readonly string[] = ['ask', 'talk', 'interview'];

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function session(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** The mode this tab chose earlier in the visit; `ask` when there is none, or storage is blocked. */
export function readMode(store: StorageLike | null = session()): StageMode {
  try {
    const mode = store?.getItem(MODE_KEY) ?? 'ask';
    return MODES.includes(mode) ? (mode as StageMode) : 'ask';
  } catch {
    return 'ask';
  }
}

export function writeMode(mode: StageMode, store: StorageLike | null = session()): void {
  try {
    store?.setItem(MODE_KEY, mode);
  } catch {
    // Blocked storage: the mode still holds until the page reloads.
  }
}

/**
 * How Dear Steven replies, or interviews (P7-05, P7-06), kept for the visit: in this tab's session storage, so a reload keeps
 * it and a new visit starts with Ask. `ask` on the server render and the first client render.
 */
export function useStageMode(): [StageMode, (mode: StageMode) => void] {
  const [mode, setMode] = useState<StageMode>('ask');
  useEffect(() => setMode(readMode()), []);
  const update = useCallback((next: StageMode) => {
    setMode(next);
    writeMode(next);
  }, []);
  return [mode, update];
}
