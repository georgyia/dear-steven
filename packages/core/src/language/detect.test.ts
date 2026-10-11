import { describe, expect, it } from 'vitest';
import { detectLanguage } from './detect.ts';

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
