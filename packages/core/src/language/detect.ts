/**
 * Which language a question is in (P6-01), cheaply and without a model: the script for non-Latin
 * text, otherwise the most frequent everyday words. It only decides whether the search query needs
 * translating into English — the transcripts are English — so "probably English" is the safe
 * default: an English question never pays for a translation step. The answer model itself writes
 * in the question's language and reports which one it used.
 */

const SCRIPTS: [RegExp, string][] = [
  [/[Ѐ-ӿ]/, 'ru'],
  [/[Ͱ-Ͽ]/, 'el'],
  [/[֐-׿]/, 'he'],
  [/[؀-ۿ]/, 'ar'],
  [/[ऀ-ॿ]/, 'hi'],
  [/[぀-ヿ]/, 'ja'],
  [/[가-힯]/, 'ko'],
  [/[一-鿿]/, 'zh'],
];

/** Short, frequent words that are rare in the other languages listed. */
const WORDS: Record<string, string[]> = {
  en: [
    'the',
    'and',
    'what',
    'how',
    'why',
    'should',
    'with',
    'about',
    'when',
    'that',
    'is',
    'my',
    'do',
    'i',
    'you',
    'to',
    'of',
    'it',
  ],
  de: [
    'dem',
    'den',
    'vor',
    'sind',
    'als',
    'sich',
    'auch',
    'noch',
    'oder',
    'bei',
    'nach',
    'wird',
    'hat',
    'haben',
    'mir',
    'mich',
    'uns',
    'gibt',
    'immer',
    'wieder',
    'steht',
    'kurz',
    'der',
    'die',
    'das',
    'und',
    'ich',
    'nicht',
    'wie',
    'warum',
    'soll',
    'sollte',
    'mit',
    'mein',
    'meine',
    'ist',
    'ein',
    'eine',
    'für',
    'wenn',
    'auf',
    'zu',
    'was',
    'kann',
  ],
  es: [
    'el',
    'la',
    'los',
    'las',
    'que',
    'por',
    'qué',
    'cómo',
    'debo',
    'debería',
    'mi',
    'para',
    'con',
    'una',
    'es',
    'del',
    'puedo',
    'cuando',
    'muy',
    'pero',
  ],
  fr: [
    'le',
    'les',
    'des',
    'est',
    'je',
    'pourquoi',
    'comment',
    'dois',
    'mon',
    'ma',
    'pour',
    'avec',
    'une',
    'pas',
    'que',
    'qui',
    'quand',
    'mais',
    'du',
  ],
  it: [
    'il',
    'gli',
    'che',
    'perché',
    'come',
    'devo',
    'dovrei',
    'mio',
    'mia',
    'per',
    'con',
    'una',
    'non',
    'sono',
    'della',
    'quando',
  ],
  pt: [
    'o',
    'os',
    'que',
    'por',
    'porque',
    'como',
    'devo',
    'meu',
    'minha',
    'para',
    'com',
    'uma',
    'não',
    'é',
    'quando',
    'você',
  ],
  nl: [
    'de',
    'het',
    'een',
    'en',
    'ik',
    'niet',
    'waarom',
    'hoe',
    'moet',
    'mijn',
    'met',
    'voor',
    'wat',
    'als',
    'zijn',
  ],
};

/** Letters that settle a tie between Latin-script languages. */
const LETTERS: [RegExp, string][] = [
  [/ß|[äöü]/i, 'de'],
  [/ñ|¿|¡/i, 'es'],
  [/[ãõ]/i, 'pt'],
  [/[çœ]|\bl'|\bd'/i, 'fr'],
];

/** Each Latin-script language by how many of its words and letters `text` has, most first. */
function ranked(text: string): [string, number][] {
  const words =
    text
      .toLowerCase()
      .normalize('NFC')
      .match(/[\p{L}']+/gu) ?? [];
  const score = Object.fromEntries(
    Object.entries(WORDS).map(([language, list]) => [
      language,
      words.filter((w) => list.includes(w)).length,
    ]),
  ) as Record<string, number>;
  for (const [pattern, language] of LETTERS)
    if (pattern.test(text)) score[language] = (score[language] ?? 0) + 2;
  return Object.entries(score).sort((a, b) => b[1] - a[1]);
}

const scriptOf = (text: string) => SCRIPTS.find(([pattern]) => pattern.test(text))?.[1];

/** ISO 639-1 code; `en` unless another language is clearly more likely. */
export function detectLanguage(text: string): string {
  const script = scriptOf(text);
  if (script) return script;
  const scores = ranked(text);
  const [best, bestScore] = scores[0] ?? ['en', 0];
  const english = scores.find(([language]) => language === 'en')?.[1] ?? 0;
  return best !== 'en' && bestScore >= 2 && bestScore > english ? best : 'en';
}

/**
 * The language `text` is clearly in, or null when it doesn't say (P10-15). Unlike
 * `detectLanguage`, English isn't the default: every language, English too, needs `min` of its
 * words or letters, and twice as many as the next language.
 */
export function clearLanguage(text: string, min = 2): string | null {
  const script = scriptOf(text);
  if (script) return script;
  const [first, second] = ranked(text);
  if (!first || first[1] < min) return null;
  return first[1] >= 2 * (second?.[1] ?? 0) ? first[0] : null;
}
