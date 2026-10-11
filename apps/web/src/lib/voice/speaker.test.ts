import { describe, expect, it } from 'vitest';
import { browserVoice } from './speaker';

const voice = (name: string, lang: string, isDefault = false) =>
  ({ name, lang, voiceURI: `${name}-${lang}`, default: isDefault }) as SpeechSynthesisVoice;

const VOICES = [
  voice('Samantha', 'en-US', true),
  voice('Daniel', 'en-GB'),
  voice('Anna', 'de-DE'),
  voice('Markus', 'de_DE'),
];

describe('browserVoice (P6-02)', () => {
  it('reads an answer in a voice that speaks its language', () => {
    expect(browserVoice(VOICES, null, 'en')?.name).toBe('Daniel');
    expect(browserVoice(VOICES, null, 'de')?.name).toBe('Anna');
  });

  it('keeps the chosen voice only for text in that voice’s language', () => {
    expect(browserVoice(VOICES, 'Markus-de_DE', 'de')?.name).toBe('Markus');
    expect(browserVoice(VOICES, 'Samantha-en-US', 'de')?.name).toBe('Anna');
  });

  it('leaves it to the browser when no voice speaks the language', () => {
    expect(browserVoice(VOICES, null, 'ja')).toBe(null);
  });
});
