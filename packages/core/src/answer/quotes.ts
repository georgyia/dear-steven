/**
 * Locates a model-proposed quotation inside the stored passage text (plan §E.3). The UI always
 * renders the stored span this returns — never the model's string — so a quote on screen is, by
 * construction, a substring of the transcript.
 *
 * Matching is done on a normalised copy (case, punctuation, quote marks and whitespace folded)
 * with a map back to original offsets. Exact containment first; then the longest common
 * substring, accepted only when it covers at least `minCoverage` of the quote.
 */

export interface QuoteSpan {
  start: number;
  end: number;
  /** The stored text between start and end. */
  text: string;
  exact: boolean;
  coverage: number;
}

interface Normalised {
  text: string;
  /** For each normalised character, its index in the original string. */
  map: number[];
}

const FOLD: Record<string, string> = {
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '–': '-',
  '—': '-',
  '…': '.',
};

export function normalise(input: string): Normalised {
  let text = '';
  const map: number[] = [];
  let lastSpace = true;
  for (let i = 0; i < input.length; i += 1) {
    const raw = input[i] ?? '';
    const ch = (FOLD[raw] ?? raw).toLowerCase();
    if (ch === "'") continue; // apostrophes vanish: "don’t" and "dont" match
    if (/[a-z0-9]/.test(ch) || /\p{L}|\p{N}/u.test(ch)) {
      text += ch;
      map.push(i);
      lastSpace = false;
    } else if (/\s/.test(ch) || /[-"/]/.test(ch)) {
      if (!lastSpace) {
        text += ' ';
        map.push(i);
        lastSpace = true;
      }
    }
    // Other punctuation is dropped entirely.
  }
  if (text.endsWith(' ')) {
    text = text.slice(0, -1);
    map.pop();
  }
  return { text, map };
}

function longestCommonSubstring(a: string, b: string): { aStart: number; length: number } {
  let best = 0;
  let bestEnd = 0;
  let prev = new Uint16Array(b.length + 1);
  let cur = new Uint16Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      if (a.charCodeAt(i - 1) === b.charCodeAt(j - 1)) {
        const v = (prev[j - 1] ?? 0) + 1;
        cur[j] = v;
        if (v > best) {
          best = v;
          bestEnd = i;
        }
      } else {
        cur[j] = 0;
      }
    }
    [prev, cur] = [cur, prev];
  }
  return { aStart: bestEnd - best, length: best };
}

/** Widens [start, end) in the original text to whole words and trims surrounding space. */
function toWordSpan(original: string, start: number, end: number): { start: number; end: number } {
  let s = start;
  let e = end;
  while (s > 0 && /[\p{L}\p{N}'’]/u.test(original[s - 1] ?? '')) s -= 1;
  while (e < original.length && /[\p{L}\p{N}'’]/u.test(original[e] ?? '')) e += 1;
  // Keep a closing punctuation mark that ends the sentence.
  if (/[.!?]/.test(original[e] ?? '')) e += 1;
  while (s < e && /\s/.test(original[s] ?? '')) s += 1;
  while (e > s && /\s/.test(original[e - 1] ?? '')) e -= 1;
  return { start: s, end: e };
}

export function locateQuote(
  passageText: string,
  quote: string,
  minCoverage = 0.85,
): QuoteSpan | null {
  const hay = normalise(passageText);
  const needle = normalise(quote).text;
  if (needle.length < 12 || hay.text.length === 0) return null;

  const at = hay.text.indexOf(needle);
  let nStart: number;
  let nLength: number;
  let exact = false;
  if (at !== -1) {
    nStart = at;
    nLength = needle.length;
    exact = true;
  } else {
    const lcs = longestCommonSubstring(hay.text, needle);
    if (lcs.length / needle.length < minCoverage) return null;
    nStart = lcs.aStart;
    nLength = lcs.length;
  }

  const first = hay.map[nStart];
  const last = hay.map[nStart + nLength - 1];
  if (first === undefined || last === undefined) return null;
  const span = toWordSpan(passageText, first, last + 1);
  return {
    ...span,
    text: passageText.slice(span.start, span.end),
    exact,
    coverage: exact ? 1 : nLength / needle.length,
  };
}
