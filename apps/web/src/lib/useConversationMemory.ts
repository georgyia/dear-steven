'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Turn } from './conversation';
import {
  forgetConversation,
  loadConversation,
  memorySupported,
  restoredTurns,
  saveConversation,
  toStored,
} from './memory';

/**
 * Opt-in conversation memory (P5-11). Off until the user switches it on; from then on every
 * finished turn is saved, and the next visit starts where this one ended. Switching it off or
 * pressing Forget deletes the database at once.
 */
export function useConversationMemory(
  turns: Turn[],
  { restore, onRestored }: { restore: (turns: Turn[]) => void; onRestored: () => void },
) {
  const [remember, setRemember] = useState(false);
  const [supported, setSupported] = useState(true);
  const [saveFailed, setSaveFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const latest = useRef({ turns, restore, onRestored });
  latest.current = { turns, restore, onRestored };

  useEffect(() => {
    if (!memorySupported()) {
      setSupported(false);
      setLoaded(true);
      return;
    }
    let live = true;
    void loadConversation().then((stored) => {
      if (!live) return;
      setLoaded(true);
      if (stored === null) return; // never switched on: nothing exists, nothing was created
      setRemember(true);
      if (stored.length > 0) {
        latest.current.restore(restoredTurns(stored));
        latest.current.onRestored();
      }
    });
    return () => {
      live = false;
    };
  }, []);

  // Saved when a turn finishes (or the conversation is reset), not on every streamed event.
  const finished = turns
    .filter((t) => t.status === 'done')
    .map((t) => t.id)
    .join(',');
  // biome-ignore lint/correctness/useExhaustiveDependencies: `finished` is the trigger — save when a turn completes; the turns are read from the ref
  useEffect(() => {
    if (!remember || !loaded) return;
    void saveConversation(toStored(latest.current.turns)).then((ok) => setSaveFailed(!ok));
  }, [remember, loaded, finished]);

  const forget = useCallback(async () => {
    setRemember(false);
    await forgetConversation();
  }, []);

  return {
    remember,
    supported,
    saveFailed,
    setRemember: useCallback((on: boolean) => (on ? setRemember(true) : void forget()), [forget]),
    forget,
  };
}
