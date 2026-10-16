import { describe, expect, it } from 'vitest';
import { clearLanguage, detectLanguage } from './detect.ts';

describe('detectLanguage', () => {
  it.each([
    ['Why do I wake up exhausted even after a full night of sleep?', 'en'],
    ['How do I stay disciplined when the motivation runs out?', 'en'],
    ['What really went wrong at WeWork?', 'en'],
    ['Warum wache ich erschöpft auf, obwohl ich die ganze Nacht geschlafen habe?', 'de'],
    ['Soll ich meinen Job kündigen, um ein Unternehmen zu gründen?', 'de'],
    ['¿Por qué me despierto agotado aunque haya dormido toda la noche?', 'es'],
    ['¿Debería dejar mi trabajo para empezar mi propio negocio?', 'es'],
    ['Pourquoi est-ce que je me réveille épuisé après une nuit complète?', 'fr'],
    ['Почему я просыпаюсь уставшим?', 'ru'],
    ['なぜ疲れて目が覚めるのですか？', 'ja'],
  ])('%s → %s', (text, language) => expect(detectLanguage(text)).toBe(language));

  it('stays English for names and short questions', () => {
    expect(detectLanguage('Dana White')).toBe('en');
    expect(detectLanguage('Bitcoin?')).toBe('en');
    expect(detectLanguage('Was Adam Neumann a fraud?')).toBe('en');
  });
});

describe('clearLanguage (P10-15)', () => {
  it.each([
    ['I started my company because I was tired of working for other people.', 'en'],
    ['Ich habe mit meinem Bruder angefangen, und es war nicht leicht.', 'de'],
    ['Wie fühlt sich das an?', 'de'],
    ['¿Debería dejar mi trabajo para empezar mi propio negocio?', 'es'],
    ['Почему я просыпаюсь уставшим?', 'ru'],
  ])('%s → %s', (text, language) => expect(clearLanguage(text)).toBe(language));

  it('says nothing when the words don’t settle it, where detectLanguage says English', () => {
    for (const text of [
      'Founder of a fintech startup',
      'Ich bin Designer',
      'Product Manager bei Zalando, vorher Consultant',
      'Ich bin Product Manager bei einem Startup, and I love it',
      'Dana White',
      '',
    ]) {
      expect(clearLanguage(text), text).toBeNull();
    }
    expect(detectLanguage('Founder of a fintech startup')).toBe('en');
    expect(detectLanguage('Ich bin Designer')).toBe('en');
  });

  it('asks for more words when told to', () => {
    expect(clearLanguage('What made you start?')).toBe('en');
    expect(clearLanguage('What made you start?', 3)).toBeNull();
  });
});
