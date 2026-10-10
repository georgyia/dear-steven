import { decodeEntities } from './vtt.ts';

/**
 * Pulls guest names out of Diary Of A CEO episode titles, which follow a few house styles:
 *   "Dana White: This Generation Thinks…"            → leading "Name:"
 *   "Human Lie Detector: The #1 Sign… | Dr Leanne ten Brinke" → trailing "| Name"
 *   "Archaeology WARNING: … - Graham Hancock"        → trailing "- Name"
 *   "E39: Jamal Edwards - From Media Student…"       → numbered, then "Name -"
 *   "Moment 112 - Want To Sleep Better?…: Matthew Walker" → trailing ": Name"
 * Precision beats recall: a title like "Creatine Expert: …" yields nothing, and the optional LLM
 * pass (`ingest discover --guests llm`) fills the gaps from the description.
 */

const HONORIFIC = /^(dr\.?|prof\.?|professor|sir|dame|lord|lady)$/i;
const PARTICLE = /^(de|da|del|della|der|den|du|la|le|van|von|ten|ter|bin|al|el|st\.?)$/i;

const ROLE_WORDS = new Set(
  [
    'expert',
    'doctor',
    'scientist',
    'whistleblower',
    'debate',
    'warning',
    'update',
    'urgent',
    'emergency',
    'moment',
    'episode',
    'top',
    'legend',
    'founder',
    'ceo',
    'the',
    'man',
    'woman',
    'billionaire',
    'billionaire’s',
    "billionaire's",
    'researcher',
    'spy',
    'coach',
    'psychologist',
    'therapist',
    'apologist',
    'professor',
    'specialist',
    'surgeon',
    'neuroscientist',
    'detective',
    'investor',
    'agent',
    'negotiator',
    'officer',
    'navy',
    'seal',
    'monk',
    'nun',
    'priest',
    'former',
    'leading',
    'world’s',
    "world's",
    'no.1',
    '#1',
    'number',
    'one',
    'secret',
    'truth',
    'ai',
    'ufc',
    'olympic',
    'champion',
    'author',
    'teacher',
    'guru',
    'master',
    'king',
    'queen',
    'insider',
    'hacker',
    'lawyer',
    'judge',
    'chef',
    'nutritionist',
    'dietitian',
    'physician',
    'nurse',
    'pastor',
    'rabbi',
    'imam',
    'astronaut',
    'economist',
    'historian',
    'philosopher',
    'strategist',
    'diplomat',
    'general',
    'soldier',
    'marine',
    'pilot',
    'trader',
    'banker',
    'analyst',
    'ex',
    'top',
    'best',
    'how',
    'why',
    'what',
    'when',
    'is',
    'are',
    'my',
    'your',
    'this',
    'everything',
    'part',
    'special',
    'live',
    'q&a',
    'bonus',
    'trailer',
    'introducing',
    'compilation',
    'mix',
  ].map((w) => w.toLowerCase()),
);

const clean = (s: string) => decodeEntities(s).replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();

/** True when `candidate` reads like a person's name ("Dr Leanne ten Brinke", "Druski", "JD Vance"). */
export function looksLikePersonName(candidate: string): boolean {
  const text = clean(candidate).replace(/[!?.;)\]]+$/, '');
  if (text.includes(',')) return false;
  const words = text.split(' ').filter(Boolean);
  // Honorifics only count in front ("Professor Jiang", not "Harvard Professor").
  const core = HONORIFIC.test(words[0] ?? '') ? words.slice(1) : words;
  if (core.length === 0 || core.length > 4) return false;
  if (core.length === 1) {
    const w = core[0] ?? '';
    return /^[A-Z][a-z][A-Za-z.'’-]{1,}$/.test(w) && !ROLE_WORDS.has(w.toLowerCase());
  }
  return core.every((w, i) => {
    if (ROLE_WORDS.has(w.toLowerCase())) return false;
    if (i > 0 && i < core.length - 1 && PARTICLE.test(w)) return true;
    // Capitalised word, initials (JD, J.K.) or a dotted lowercase stage name (will.i.am).
    return /^[A-Z][A-Za-z.'’-]*$/.test(w) || /^[a-z]+(\.[a-z]+)+$/.test(w);
  });
}

const POST_NOMINALS = /\s+(CBE|MBE|OBE|KBE|DBE|PhD|MD|QC|KC)\.?$/;

const normaliseName = (s: string) =>
  clean(s)
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/[!?.;)\]]+$/, '')
    .replace(POST_NOMINALS, '')
    .replace(/^dr\.?\s/i, 'Dr ')
    .trim();

export function extractGuestNames(rawTitle: string): string[] {
  const title = clean(rawTitle)
    .replace(/^(E\d+|Moment \d+|Ep\.? ?\d+|Extended Moment|Most Replayed Moment)\s*[:\-–—]\s*/i, '')
    .replace(/^(URGENT UPDATE|EMERGENCY (DEBATE|EPISODE)|BREAKING|LIVE)\s*[:\-–—]\s*/i, '');

  const found: string[] = [];
  const add = (name: string) => {
    const n = normaliseName(name);
    if (looksLikePersonName(n) && !found.some((f) => f.toLowerCase() === n.toLowerCase()))
      found.push(n);
  };

  // "... | Name" — the most reliable form.
  const pipe = title.lastIndexOf('|');
  if (pipe !== -1) add(title.slice(pipe + 1));

  // "... - Name" or "... - Name v Name" (debates) at the end.
  const dash = /\s[-–—]\s([^-–—|:]+)$/.exec(title);
  if (dash?.[1] && found.length === 0 && !dash[1].includes(',')) {
    for (const part of dash[1].split(/\s+(?:v|vs\.?|and|&)\s+/i)) add(part);
  }

  // "...: Name" at the very end (Moment-style titles).
  const tailColon = /:\s([^:|]+)$/.exec(title);
  if (tailColon?.[1] && found.length === 0 && tailColon[1].split(' ').length <= 5)
    add(tailColon[1]);

  // Leading "Name:" or "Name -".
  if (found.length === 0) {
    const lead = /^([^:|\-–—]+?)\s*(?::|\s[-–—]\s)/.exec(title.replace(/\s*\([^)]*\)/g, ''));
    if (lead?.[1]) add(lead[1]);
  }

  return found;
}
