import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  PREFERENCES_KEY,
  parsePreferences,
  savePreferences,
} from './preferences';

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
};
const blocked = {
  getItem: () => {
    throw new DOMException('denied', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('full', 'QuotaExceededError');
  },
};

describe('voice preferences', () => {
  it('round-trips through storage', () => {
    const store = memory();
    const prefs = {
      alwaysSpeak: true,
      talkAloud: false,
      onDevice: true,
      serverVoice: 'coral',
      browserVoice: 'x',
    } as const;
    expect(savePreferences(prefs, store)).toBe(true);
    expect(store.data.has(PREFERENCES_KEY)).toBe(true);
    expect(loadPreferences(store)).toEqual(prefs);
  });

  it('falls back to defaults when storage is missing, blocked or full', () => {
    expect(loadPreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(loadPreferences(blocked)).toEqual(DEFAULT_PREFERENCES);
    expect(savePreferences({ ...DEFAULT_PREFERENCES, alwaysSpeak: true }, blocked)).toBe(false);
    expect(savePreferences(DEFAULT_PREFERENCES, null)).toBe(false);
  });

  it('keeps the good fields of a damaged or older value', () => {
    expect(parsePreferences('{not json')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('[1,2]')).toEqual(DEFAULT_PREFERENCES);
    expect(
      parsePreferences(JSON.stringify({ alwaysSpeak: true, serverVoice: 'voice_custom_clone' })),
    ).toEqual({ ...DEFAULT_PREFERENCES, alwaysSpeak: true });
    expect(parsePreferences(JSON.stringify({ onDevice: 'yes', browserVoice: '' }))).toEqual(
      DEFAULT_PREFERENCES,
    );
  });

  it('reads talk replies aloud unless that was turned off (P7-05)', () => {
    expect(DEFAULT_PREFERENCES.talkAloud).toBe(true);
    expect(parsePreferences(JSON.stringify({ alwaysSpeak: false })).talkAloud).toBe(true);
    expect(parsePreferences(JSON.stringify({ talkAloud: false })).talkAloud).toBe(false);
    expect(parsePreferences(JSON.stringify({ talkAloud: 'no' })).talkAloud).toBe(true);
  });
});
