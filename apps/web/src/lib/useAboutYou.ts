'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cleanAbout, forgetAbout, loadAbout, saveAbout } from './aboutYou';
import { memorySupported } from './memory';

/** How long a forgotten text can be brought back (matches Forget's undo window, plus a beat). */
const UNDO_MS = 6000;

/**
 * What Dear Steven keeps about you (P7-08): loaded once, kept or edited only on request, forgotten
 * at once. `text` is exactly what is sent with questions; `undo` holds a forgotten text for a few
 * seconds, in memory only, so Forget can be taken back.
 */
export function useAboutYou() {
  const [text, setText] = useState<string | null>(null);
  const [undo, setUndo] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [failed, setFailed] = useState(false);
  const textRef = useRef(text);
  textRef.current = text;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!memorySupported()) {
      setSupported(false);
      return;
    }
    let live = true;
    void loadAbout().then((kept) => {
      if (live) setText(kept);
    });
    return () => {
      live = false;
      clearTimeout(timer.current);
    };
  }, []);

  const keep = useCallback(async (next: string) => {
    const clean = cleanAbout(next);
    const ok = clean ? await saveAbout(clean) : false;
    setFailed(!ok);
    if (ok) {
      clearTimeout(timer.current);
      setUndo(null);
      setText(clean);
    }
    return ok;
  }, []);

  const forget = useCallback(async () => {
    const previous = textRef.current;
    setText(null);
    setFailed(false);
    setUndo(previous);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setUndo(null), UNDO_MS);
    await forgetAbout();
  }, []);

  return { text, undo, supported, failed, keep, forget };
}
