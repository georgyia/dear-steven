/**
 * Words the server streams to the thought line, plus the fixed replies, in each interface language
 * (P6-02). Defined here (the web app's catalogues reuse them) so live and demo answers read the
 * same. Client-safe: plain strings and functions, no I/O.
 */

/** The interface languages. Answers follow the question's language whatever this is (P6-01). */
export const UI_LOCALES = ['en', 'de'] as const;
export type UiLocale = (typeof UI_LOCALES)[number];
export const DEFAULT_UI_LOCALE: UiLocale = 'en';

export const isUiLocale = (v: unknown): v is UiLocale =>
  typeof v === 'string' && (UI_LOCALES as readonly string[]).includes(v);

/**
 * The interface language for an Accept-Language header or a single BCP 47 tag: the supported
 * language the visitor ranks highest (by q-value, then order), else English.
 */
export function uiLocaleFrom(header: string | null | undefined): UiLocale {
  if (!header) return DEFAULT_UI_LOCALE;
  const ranked = header
    .split(',')
    .map((part, order) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => /^\s*q=([0-9.]+)\s*$/.exec(p)?.[1]).find(Boolean);
      return { lang: tag.trim().split('-')[0]?.toLowerCase() ?? '', q: q ? Number(q) : 1, order };
    })
    .filter((r) => r.q > 0 && Number.isFinite(r.q))
    .sort((a, b) => b.q - a.q || a.order - b.order);
  return ranked.map((r) => r.lang).find(isUiLocale) ?? DEFAULT_UI_LOCALE;
}

/** The full BCP 47 tag for each interface language: numbers, and speech when the browser has none. */
export const LOCALE_TAG: Record<UiLocale, string> = { en: 'en-GB', de: 'de-DE' };

export interface ThinkingCopy {
  searching: (episodes: number) => string;
  found: (passages: number, episodes: number) => string;
  writing: string;
  checking: string;
  done: string;
}

const count = (locale: UiLocale) => (x: number) => x.toLocaleString(LOCALE_TAG[locale]);
const plural = (x: number, one: string, other: string) => (x === 1 ? one : other);

export const THINKING_COPY: Record<UiLocale, ThinkingCopy> = {
  en: {
    searching: (episodes) =>
      episodes > 0
        ? `Searching ${count('en')(episodes)} ${plural(episodes, 'conversation', 'conversations')}…`
        : 'Searching my conversations…',
    found: (passages, episodes) =>
      passages === 0
        ? 'Nothing close in the transcripts'
        : `${passages} ${plural(passages, 'passage', 'passages')} from ${episodes} ${plural(episodes, 'episode', 'episodes')}`,
    writing: 'Composing',
    checking: 'Checking every quote against the transcript',
    done: 'Thought for',
  },
  de: {
    searching: (episodes) =>
      episodes > 0
        ? `Durchsuche ${count('de')(episodes)} ${plural(episodes, 'Gespräch', 'Gespräche')}…`
        : 'Durchsuche meine Gespräche…',
    found: (passages, episodes) =>
      passages === 0
        ? 'Nichts Passendes in den Transkripten'
        : `${passages} ${plural(passages, 'Passage', 'Passagen')} aus ${episodes} ${plural(episodes, 'Folge', 'Folgen')}`,
    writing: 'Formuliere',
    checking: 'Prüfe jedes Zitat am Transkript',
    done: 'Nachgedacht:',
  },
};

/** Past the operator's daily spend cap (P6-08). Said in character, and true: no model was asked. */
export const RESTING_REPLY: Record<UiLocale, { text: string; spoken: string }> = {
  en: {
    text: 'I’ve done all the talking I can for today — whoever runs this copy of me set a daily limit, and we’ve reached it. Come back tomorrow and ask me again; I’d rather wait than give you half an answer.',
    spoken:
      'I’ve done all the talking I can for today. Whoever runs this copy of me set a daily limit, and we’ve reached it. Ask me again tomorrow.',
  },
  de: {
    text: 'Für heute habe ich so viel geredet, wie ich darf — wer diese Kopie von mir betreibt, hat ein Tageslimit gesetzt, und das ist erreicht. Komm morgen wieder und frag mich noch einmal; ich warte lieber, als dir eine halbe Antwort zu geben.',
    spoken:
      'Für heute habe ich so viel geredet, wie ich darf. Wer diese Kopie von mir betreibt, hat ein Tageslimit gesetzt, und das ist erreicht. Frag mich morgen noch einmal.',
  },
};

export const EMPTY_KNOWLEDGE_REPLY: Record<
  UiLocale,
  { text: string; hint: string; spoken: string }
> = {
  en: {
    text: 'I haven’t got any of my conversations loaded yet, so anything I said now would be a guess dressed up as a memory — and I’d rather not do that to you.',
    hint: 'Run `pnpm ingest all --limit 20` to load the twenty most recent episodes, then ask me again.',
    spoken:
      'I haven’t got any of my conversations loaded yet, so I’d only be guessing. Load a few episodes with the ingest command and ask me again.',
  },
  de: {
    text: 'Ich habe noch keines meiner Gespräche geladen. Alles, was ich jetzt sage, wäre also eine Vermutung, die sich als Erinnerung ausgibt — und das möchte ich dir nicht antun.',
    hint: 'Führe `pnpm ingest all --limit 20` aus, um die zwanzig neuesten Folgen zu laden, und frag mich dann noch einmal.',
    spoken:
      'Ich habe noch keines meiner Gespräche geladen, ich würde also nur raten. Lade ein paar Folgen mit dem Ingest-Befehl und frag mich dann noch einmal.',
  },
};

/** Shown under the persona's error sentence when the model's answer could not be parsed. */
export const MALFORMED_ANSWER: Record<UiLocale, string> = {
  en: 'The answer came back malformed. Nothing was shown that wasn’t checked.',
  de: 'Die Antwort kam fehlerhaft zurück. Es wurde nichts Ungeprüftes angezeigt.',
};

/**
 * When the safety check (moderation) gave no verdict, even on a second try (P10-06): nothing was
 * answered. Shown under the persona's error sentence in Ask, and on its own in the interview.
 */
export const MODERATION_UNAVAILABLE: Record<UiLocale, string> = {
  en: 'I couldn’t run my safety check just now, so I haven’t replied.',
  de: 'Ich konnte meine Sicherheitsprüfung gerade nicht durchführen, deshalb habe ich nicht geantwortet.',
};
