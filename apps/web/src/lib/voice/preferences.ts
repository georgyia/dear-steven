'use client';

import { STOCK_VOICES, type StockVoice } from '@dear-steven/core/schema';
import { useCallback, useEffect, useState } from 'react';

/**
 * Voice preferences (P5-07), kept in this browser only. Every read and write tolerates blocked or
 * full storage: the app then runs on the defaults, and a change still applies for this visit.
 */
export interface VoicePreferences {
  /** Read every answer aloud, typed or spoken — still only after a gesture in this visit. */
  alwaysSpeak: boolean;
  /** Ask Chrome to recognise speech on the device (`processLocally`) where it can. */
  onDevice: boolean;
  /** Stock OpenAI voice for server speech; `null` = the server default. */
  serverVoice: StockVoice | null;
  /** `voiceURI` of a system voice for browser speech; `null` = pick automatically. */
  browserVoice: string | null;
}

export const DEFAULT_PREFERENCES: VoicePreferences = {
  alwaysSpeak: false,
  onDevice: false,
  serverVoice: null,
  browserVoice: null,
};

export const PREFERENCES_KEY = 'dear-steven:voice:v1';

const isStockVoice = (v: unknown): v is StockVoice =>
  typeof v === 'string' && (STOCK_VOICES as readonly string[]).includes(v);

/** Field by field, so one bad value (an old version, a hand edit) never discards the rest. */
export function parsePreferences(raw: string | null): VoicePreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return DEFAULT_PREFERENCES;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_PREFERENCES;
  const o = value as Record<string, unknown>;
  return {
    alwaysSpeak: o.alwaysSpeak === true,
    onDevice: o.onDevice === true,
    serverVoice: isStockVoice(o.serverVoice) ? o.serverVoice : null,
    browserVoice:
      typeof o.browserVoice === 'string' &&
      o.browserVoice.length > 0 &&
      o.browserVoice.length <= 300
        ? o.browserVoice
        : null,
  };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function storage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadPreferences(store: StorageLike | null = storage()): VoicePreferences {
  try {
    return parsePreferences(store?.getItem(PREFERENCES_KEY) ?? null);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** False when the preference could not be stored (it still applies until the tab closes). */
export function savePreferences(
  prefs: VoicePreferences,
  store: StorageLike | null = storage(),
): boolean {
  if (!store) return false;
  try {
    store.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

/** Defaults on the server render and the first client render; stored values right after. */
export function useVoicePreferences() {
  const [prefs, setPrefs] = useState<VoicePreferences>(DEFAULT_PREFERENCES);
  const [persisted, setPersisted] = useState(true);
  useEffect(() => setPrefs(loadPreferences()), []);
  const update = useCallback((patch: Partial<VoicePreferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      setPersisted(savePreferences(next));
      return next;
    });
  }, []);
  return { prefs, update, persisted };
}
