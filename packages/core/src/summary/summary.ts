import type { AnswerModel } from '../answer/model.ts';
import { locateQuote } from '../answer/quotes.ts';
import { answerCostUsd, MODELS } from '../config/models.ts';
import {
  type ConversationSummary,
  ConversationSummarySchema,
  type Episode,
  type ModelSummary,
  ModelSummarySchema,
  type Segment,
  SUMMARY_LIMITS,
  SUMMARY_VERSION,
  type SummarySpan,
} from '../schema/index.ts';
import type { StoredPassage } from '../store/index.ts';
import {
  ABOUT_FORMAT,
  aboutRepairInput,
  SUMMARY_CACHE_KEY,
  SUMMARY_FORMAT,
  SUMMARY_INSTRUCTIONS,
  summaryInput,
} from './prompt.ts';

const L = SUMMARY_LIMITS;

/** One episode, as the summary is checked against it. */
export interface SummarySource {
  episode: Episode;
  /** In order: the prompt's `p0`, `p1`, … */
  passages: StoredPassage[];
  /** The episode's segments, to place each quote at the moment it starts. */
  segments: Segment[];
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

// ---------------------------------------------------------------------------- quotes

interface Located {
  span: SummarySpan;
  index: number;
  start: number;
  end: number;
}

/**
 * When in the episode a quote starts: the segment its first character falls in. A passage's text is
 * its segments' trimmed text joined by one character (a space, or a new line between verified
 * turns), so an offset maps back exactly; if it doesn't add up, the passage's own start.
 */
function startOf(source: SummarySource, passage: StoredPassage, offset: number): number {
  const segments = source.segments.filter(
    (s) => s.idx >= passage.segmentStartIdx && s.idx <= passage.segmentEndIdx,
  );
  const texts = segments.map((s) => s.text.trim());
  if (texts.join(' ') !== passage.text.replace(/\n/g, ' ')) return passage.startMs;
  let at = 0;
  for (const [i, text] of texts.entries()) {
    at += text.length + 1;
    if (offset < at) return segments[i]?.startMs ?? passage.startMs;
  }
  return passage.startMs;
}

/** The stored span a model's quote points at, or why there isn't one. */
function locate(
  source: SummarySource,
  ref: { passage: string; quote: string },
  minWords: number = L.quoteMinWords,
): Located | string {
  const index = /^p(\d{1,4})$/.exec(ref.passage.trim())?.[1];
  const passage = index === undefined ? undefined : source.passages[Number(index)];
  if (!passage) return `"${ref.passage}" is not a passage`;
  if (/…|\.\.\./.test(ref.quote)) return 'a quote was shortened or joined with "…"';
  const span = locateQuote(passage.text, ref.quote);
  if (!span) return 'a quote is not in its passage';
  const n = words(span.text);
  if (n < minWords) return `a quote has ${n} words, fewer than ${minWords}`;
  if (n > L.quoteMaxWords) return `a quote has ${n} words, more than ${L.quoteMaxWords}`;
  return {
    span: { passageId: passage.id, startMs: startOf(source, passage, span.start), text: span.text },
    index: Number(index),
    start: span.start,
    end: span.end,
  };
}

const overlaps = (a: Located, b: Located) =>
  a.index === b.index && a.start < b.end && b.start < a.end;

// ------------------------------------------------------------------ machine-written text

/** Verbs that report what someone said or thinks. */
const SAYING =
  /\b(say|says|said|argue|argues|argued|explain|explains|explained|claim|claims|claimed|believe|believes|believed|tell|tells|told|admit|admits|admitted|reveal|reveals|revealed|share|shares|shared|describe|describes|described|recall|recalls|recalled|recount|recounts|recounted|insist|insists|insisted|warn|warns|warned|think|thinks|thought|suggest|suggests|suggested)\b/i;
const PERSONA_LINT = /\bas an ai\b|\blanguage model\b|\bthe host said\b/i;

/** A word as names are compared: lower case, straight apostrophe, no possessive. */
const wordKey = (word: string) => word.toLowerCase().replace(/’/g, "'").replace(/'s$/, '');

/** What the summary may name or count: the words and numbers of the episode's details and transcript. */
function corpus(source: SummarySource): { words: Set<string>; numbers: Set<string> } {
  const { title, description, guestNames } = source.episode;
  const text = [
    title,
    description,
    guestNames.join(' '),
    ...source.passages.map((p) => p.text),
  ].join('\n');
  const words = new Set<string>();
  for (const word of text.match(/[\p{L}\d][\p{L}\d'’-]*/gu) ?? []) {
    words.add(wordKey(word));
    for (const part of word.split('-')) words.add(wordKey(part));
  }
  const numbers = new Set((text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/,/g, '')));
  return { words, numbers };
}

/** Who a sentence could be reporting the words of: the guests, the host, a pronoun. */
function people(episode: Episode): RegExp {
  const names = episode.guestNames
    .flatMap((n) => [n, ...n.split(/\s+/)])
    .filter((n) => n.length >= 3)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(
    `\\b(${[...names, 'steven', 'bartlett', 'host', 'guest', 'guests', 'he', 'she', 'his', 'her'].join('|')})\\b`,
    'i',
  );
}

/**
 * What is wrong with a piece of machine-written text (`about`, a topic title, a moment label):
 * it may not quote, count or name anything the conversation doesn't, and the overview may not
 * report what anyone said.
 */
export function writtenProblems(
  text: string,
  source: SummarySource,
  kind: 'about' | 'title' | 'label',
  known = corpus(source),
): string[] {
  const problems: string[] = [];
  const max = kind === 'about' ? L.aboutWords : kind === 'title' ? L.titleWords : L.labelWords;
  const n = words(text);
  if (n === 0) problems.push('it is empty');
  if (n > max) problems.push(`it has ${n} words, more than ${max}`);
  if (/["“”„«»]/.test(text)) problems.push('it quotes; only the moments may');
  if (PERSONA_LINT.test(text)) problems.push('it talks about itself or the host saying things');
  for (const number of text.match(/\d+(?:[.,]\d+)*/g) ?? []) {
    if (!known.numbers.has(number.replace(/,/g, ''))) {
      problems.push(`the number ${number} is not in the transcript as written`);
    }
  }
  // A capital letter after the first word of a sentence marks a name (or an acronym): it must be
  // one the conversation uses. A sentence's first word is capitalised anyway, so it isn't checked.
  const names = new Set(
    text
      .split(/(?<=[.!?])\s+/)
      .flatMap(
        (sentence) => sentence.match(/(?<![\p{L}\d'’-])\p{Lu}[\p{L}\d'’-]*/gu)?.slice(1) ?? [],
      ),
  );
  for (const name of names) {
    if (!known.words.has(wordKey(name))) {
      problems.push(`"${name}" is not in the episode's details or transcript`);
    }
  }
  if (kind === 'about') {
    const who = people(source.episode);
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
      if (who.test(sentence) && SAYING.test(sentence)) {
        problems.push(`"${sentence.trim()}" reports what someone said; describe the ideas instead`);
      }
    }
  }
  return problems;
}

// -------------------------------------------------------------------------------- check

export interface CheckedSummary {
  about: string | null;
  aboutProblems: string[];
  topics: ConversationSummary['topics'];
  moments: ConversationSummary['moments'];
  exchanges: ConversationSummary['exchanges'];
  /** Why items were left out, for the CLI and the eval. */
  dropped: string[];
}

/**
 * Checks a model's summary against the episode it summarises (P8-03). An item that fails is
 * dropped, never repaired: every moment, question and answer kept is the stored transcript span,
 * never the model's string.
 */
export function checkSummary(raw: ModelSummary, source: SummarySource): CheckedSummary {
  const known = corpus(source);
  const dropped: string[] = [];

  const about = raw.about.trim();
  const aboutProblems = about ? writtenProblems(about, source, 'about', known) : ['it is empty'];

  const topics: (ConversationSummary['topics'][number] & { index: number })[] = [];
  for (const t of raw.topics) {
    const index = /^p(\d{1,4})$/.exec(t.passage.trim())?.[1];
    const passage = index === undefined ? undefined : source.passages[Number(index)];
    const problems = writtenProblems(t.title.trim(), source, 'title', known);
    if (!passage) dropped.push(`topic "${t.title}": "${t.passage}" is not a passage`);
    else if (problems.length) dropped.push(`topic "${t.title}": ${problems.join('; ')}`);
    else if (topics.some((k) => k.index === Number(index)))
      dropped.push(`topic "${t.title}": another topic starts in the same passage`);
    else
      topics.push({
        title: t.title.trim(),
        passageId: passage.id,
        startMs: passage.startMs,
        index: Number(index),
      });
  }

  const kept: Located[] = [];
  const moments: (ConversationSummary['moments'][number] & { at: Located })[] = [];
  for (const m of raw.moments) {
    const at = locate(source, m);
    const problems = writtenProblems(m.label.trim(), source, 'label', known);
    if (typeof at === 'string') dropped.push(`moment "${m.label}": ${at}`);
    else if (problems.length) dropped.push(`moment "${m.label}": ${problems.join('; ')}`);
    else if (kept.some((k) => overlaps(k, at)))
      dropped.push(`moment "${m.label}": it repeats another moment`);
    else {
      kept.push(at);
      moments.push({ ...at.span, label: m.label.trim(), at });
    }
  }

  const exchanges: (ConversationSummary['exchanges'][number] & { at: Located })[] = [];
  for (const e of raw.exchanges) {
    const q = locate(source, e.question, L.questionMinWords);
    const a = locate(source, e.answer);
    const label = `exchange "${e.question.quote.slice(0, 40)}"`;
    if (typeof q === 'string') dropped.push(`${label}: the question: ${q}`);
    else if (typeof a === 'string') dropped.push(`${label}: the answer: ${a}`);
    else if (!q.span.text.includes('?')) dropped.push(`${label}: the question asks nothing`);
    else if (a.index < q.index || a.index > q.index + L.answerWithin)
      dropped.push(`${label}: the answer is not the reply that follows`);
    else if (a.index === q.index && a.start < q.end)
      dropped.push(`${label}: the answer starts before the question ends`);
    else if (kept.some((k) => overlaps(k, q) || overlaps(k, a)))
      dropped.push(`${label}: it repeats a moment or another exchange`);
    else {
      kept.push(q, a);
      exchanges.push({ question: q.span, answer: a.span, at: q });
    }
  }

  const byTime = (x: { startMs: number }, y: { startMs: number }) => x.startMs - y.startMs;
  return {
    about: about || null,
    aboutProblems,
    topics: topics
      .sort((x, y) => x.index - y.index)
      .slice(0, L.topics)
      .map(({ index: _, ...t }) => t),
    moments: moments
      .sort(byTime)
      .slice(0, L.moments)
      .map(({ at: _, ...m }) => m),
    exchanges: exchanges
      .sort((x, y) => byTime(x.question, y.question))
      .slice(0, L.exchanges)
      .map(({ at: _, ...e }) => e),
    dropped,
  };
}

// ---------------------------------------------------------------------------- summarise

/** Instructions, episode details and the framing around the transcript, in tokens. */
const OVERHEAD_TOKENS = 1_200;
/** The `<passage id="p12" at="1:02:03">` around each passage. */
const PER_PASSAGE_TOKENS = 14;
/** The JSON, with the model's low-effort reasoning; and the occasional overview repair. */
const OUTPUT_TOKENS = 3_000;

/** What summarising an episode is expected to cost, from its passages. */
export function summaryEstimateUsd(passages: number, passageTokens: number): number {
  return answerCostUsd({
    inputTokens: passageTokens + passages * PER_PASSAGE_TOKENS + OVERHEAD_TOKENS,
    cachedInputTokens: 0,
    outputTokens: OUTPUT_TOKENS,
  });
}

export interface SummaryOutcome {
  summary: ConversationSummary;
  dropped: string[];
  /** The overview needed a second try (and then passed, or was left out). */
  repaired: boolean;
}

const parse = (raw: string) => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

/**
 * Summarises one episode: one call for the summary and, if its overview fails the checks, one
 * more (without the transcript) to fix it. Throws when the model's reply isn't a summary at all.
 */
export async function summariseEpisode(
  model: AnswerModel,
  source: SummarySource,
  options: { signal?: AbortSignal; now?: () => Date } = {},
): Promise<SummaryOutcome> {
  const raw = await model.completeJson({
    instructions: SUMMARY_INSTRUCTIONS,
    input: summaryInput(source.episode, source.passages),
    format: SUMMARY_FORMAT,
    cacheKey: SUMMARY_CACHE_KEY,
    signal: options.signal,
  });
  const parsed = ModelSummarySchema.safeParse(parse(raw));
  if (!parsed.success) throw new Error('the model did not return a summary');
  const checked = checkSummary(parsed.data, source);

  let about = checked.aboutProblems.length ? null : checked.about;
  const repaired = checked.aboutProblems.length > 0 && checked.about !== null;
  if (repaired && checked.about) {
    const fixed = await model.completeJson({
      instructions: SUMMARY_INSTRUCTIONS,
      input: aboutRepairInput(checked.about, checked.aboutProblems),
      format: ABOUT_FORMAT,
      cacheKey: SUMMARY_CACHE_KEY,
      signal: options.signal,
    });
    const text = (parse(fixed) as { about?: unknown } | null)?.about;
    if (
      typeof text === 'string' &&
      text.trim() &&
      !writtenProblems(text.trim(), source, 'about').length
    ) {
      about = text.trim();
    } else {
      checked.dropped.push(`about: ${checked.aboutProblems.join('; ')}`);
    }
  }

  const transcribed = source.episode.transcriptSource;
  const summary = ConversationSummarySchema.parse({
    version: SUMMARY_VERSION,
    model: MODELS.answer,
    createdAt: (options.now ?? (() => new Date()))().toISOString(),
    speakers:
      transcribed === 'openai-diarize' || transcribed === 'manual' ? 'verified' : 'unverified',
    about,
    topics: checked.topics,
    moments: checked.moments,
    exchanges: checked.exchanges,
  });
  return { summary, dropped: checked.dropped, repaired };
}
