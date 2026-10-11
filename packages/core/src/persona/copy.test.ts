import { describe, expect, it } from 'vitest';
import {
  EMPTY_KNOWLEDGE_REPLY,
  MALFORMED_ANSWER,
  RESTING_REPLY,
  THINKING_COPY,
  UI_LOCALES,
  uiLocaleFrom,
} from './copy.ts';

describe('uiLocaleFrom (P6-02)', () => {
  it('takes the supported language the visitor ranks highest', () => {
    expect(uiLocaleFrom('de-AT,de;q=0.9,en;q=0.8')).toBe('de');
    expect(uiLocaleFrom('fr-FR,fr;q=0.9,de;q=0.7,en;q=0.5')).toBe('de');
    expect(uiLocaleFrom('en;q=0.4,de;q=0.6')).toBe('de');
    expect(uiLocaleFrom('en-US,en;q=0.9')).toBe('en');
    expect(uiLocaleFrom('de-CH')).toBe('de');
  });

  it('falls back to English for anything unsupported, refused or malformed', () => {
    expect(uiLocaleFrom(undefined)).toBe('en');
    expect(uiLocaleFrom('')).toBe('en');
    expect(uiLocaleFrom('fr-FR,ja;q=0.5')).toBe('en');
    expect(uiLocaleFrom('de;q=0,fr')).toBe('en');
    expect(uiLocaleFrom('*')).toBe('en');
    expect(uiLocaleFrom(';;q=abc,,')).toBe('en');
  });
});

describe('fixed copy in every interface language', () => {
  it('has the same shape in each language, and none of it is left in English', () => {
    for (const locale of UI_LOCALES) {
      const thinking = THINKING_COPY[locale];
      expect(Object.keys(thinking).sort()).toEqual(Object.keys(THINKING_COPY.en).sort());
      expect(Object.keys(RESTING_REPLY[locale]).sort()).toEqual(['spoken', 'text']);
      expect(Object.keys(EMPTY_KNOWLEDGE_REPLY[locale]).sort()).toEqual(['hint', 'spoken', 'text']);
      expect(MALFORMED_ANSWER[locale].length).toBeGreaterThan(10);
    }
    const de = THINKING_COPY.de;
    expect(de.searching(8394)).toBe('Durchsuche 8.394 Gespräche…');
    expect(de.searching(1)).toBe('Durchsuche 1 Gespräch…');
    expect(de.found(3, 1)).toBe('3 Passagen aus 1 Folge');
    expect(de.found(0, 0)).toBe('Nichts Passendes in den Transkripten');
    expect(THINKING_COPY.en.searching(8394)).toBe('Searching 8,394 conversations…');
    expect(RESTING_REPLY.de.text).not.toBe(RESTING_REPLY.en.text);
    expect(EMPTY_KNOWLEDGE_REPLY.de.hint).toContain('pnpm ingest all --limit 20');
  });
});
