import type { AnswerModel } from '../answer/model.ts';
import { locateQuote, normalise } from '../answer/quotes.ts';
import { detectLanguage } from '../language/detect.ts';
import { RESTING_REPLY } from '../persona/copy.ts';
import { personaLint } from '../persona/persona.ts';
import {
  ModerationUnavailableError,
  type Moderator,
  moderationVerdict,
  routeQuestion,
  safetyReply,
  UNAVAILABLE,
} from '../safety/index.ts';
import {
  type Debrief,
  type DebriefScores,
  INTERVIEW_LIMITS,
  type InterviewReply,
  type InterviewRequest,
  type InterviewStage,
  type InterviewTurn,
  type LearnedLine,
  type ResolvedBlock,
} from '../schema/index.ts';
import type { KnowledgeStore } from '../store/index.ts';
import { arcFor } from './arc.ts';
import { FALLBACK_QUESTIONS } from './fallbacks.ts';
import {
  DEBRIEF_FORMAT,
  DEBRIEF_INSTRUCTIONS,
  DebriefModelSchema,
  debriefInput,
  INTERVIEW_CACHE_KEY,
  INTERVIEWER_INSTRUCTIONS,
  LEARNED_FORMAT,
  LEARNED_INSTRUCTIONS,
  LearnedModelSchema,
  learnedInput,
  NEXT_QUESTION_FORMAT,
  NextQuestionSchema,
  questionInput,
} from './prompt.ts';

export interface InterviewDeps {
  model: AnswerModel;
  /** For style examples; an interview works without one. */
  store: KnowledgeStore | null;
  /** Without it (demo mode), the phrase rules decide alone; with it, no verdict means no step. */
  moderate?: Moderator;
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Questions from the show's transcripts, whole sentences only, for tone. Never shown or quoted. */
export function styleExamples(store: KnowledgeStore | null, count = 6): string[] {
  if (!store) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of store.questionLines(count * 8)) {
    for (const sentence of line.match(/[^.!?]+\?/g) ?? []) {
      const s = sentence.trim();
      const n = words(s);
      const key = normalise(s).text;
      if (n < 6 || n > 30 || !/^[A-Z]/.test(s) || seen.has(key)) continue;
      seen.add(key);
      out.push(s);
      if (out.length === count) return out;
    }
  }
  return out;
}

/** What is wrong with a proposed question, if anything: one question, short, in voice, our own. */
export function questionProblems(question: string, examples: string[] = []): string[] {
  const q = question.trim();
  const problems: string[] = [];
  if (!q) return ['The question is empty.'];
  if (words(q) > INTERVIEW_LIMITS.questionWords || q.length > INTERVIEW_LIMITS.questionChars) {
    problems.push(`It is longer than ${INTERVIEW_LIMITS.questionWords} words.`);
  }
  const marks = (q.match(/\?/g) ?? []).length;
  if (marks !== 1 || !/\?["”’)]*$/.test(q)) {
    problems.push('Ask exactly one question, ending with its question mark.');
  }
  for (const reason of personaLint(q)) problems.push(`It ${reason}.`);
  const mine = normalise(q).text;
  for (const example of examples) {
    const theirs = normalise(example).text;
    if (theirs.length >= 20 && (mine.includes(theirs) || theirs.includes(mine))) {
      problems.push('It repeats one of the style examples; write your own question.');
      break;
    }
  }
  return problems;
}

/**
 * Keeps only the lines whose evidence is a verbatim span of the visitor's answer (located like a
 * transcript quote; the stored span is what is shown), at most five, in voice.
 */
export function checkLearned(
  lines: { text: string; evidence: string; turn: number }[],
  turns: InterviewTurn[],
): LearnedLine[] {
  const out: LearnedLine[] = [];
  for (const line of lines) {
    const answer = turns[line.turn]?.answer ?? '';
    const text = line.text.trim();
    if (!answer || !text || text.length > 240 || personaLint(text).length) continue;
    // A whole answer, quoted exactly, is verbatim however short ("It depends."); anything else is
    // located like a transcript quote, and must be a few words at least.
    const whole = normalise(line.evidence).text === normalise(answer).text;
    const span = whole ? null : locateQuote(answer, line.evidence);
    if (!whole && (!span || words(span.text) < 3)) continue;
    out.push({ text, evidence: whole ? answer.trim() : (span?.text ?? ''), turn: line.turn });
    if (out.length === INTERVIEW_LIMITS.learnedLines) break;
  }
  return out;
}

const SCORE_KEYS = ['clarity', 'specificity', 'story', 'brevity'] as const;
const score = (n: unknown) => Math.min(5, Math.max(1, Math.round(Number(n) || 1)));
/** Short, common words that carry no facts, in English and German: not counted as content. */
const FUNCTION_WORDS = new Set(
  (
    'that this these those with from your have just what when then than they them their there were ' +
    'will would could should been being into onto over under about after before because which while ' +
    'also very really more most much many some every each only even still back down here where why how ' +
    'dass diese dieser dieses eine einer einem einen nicht auch noch schon wenn weil aber oder sind ' +
    'habe hast haben wird werden wurde kann muss mehr sehr ganz dann denn doch nach über unter'
  ).split(' '),
);
const stem = (w: string) => w.replace(/(?:ing|ed|es|s|en|er|e)$/u, '');
const contentWords = (text: string) =>
  (
    text
      .toLowerCase()
      .normalize('NFC')
      .match(/[\p{L}]{4,}/gu) ?? []
  )
    .filter((w) => !FUNCTION_WORDS.has(w))
    .map(stem);

/**
 * How much of a rewrite is the visitor's own vocabulary: the share of its content words found in
 * their answers. A rewrite built from what they said scores near 1; one that brings new substance
 * scores lower.
 */
export function ownWordsShare(rewrite: string, answers: string[]): number {
  const theirs = new Set(answers.flatMap(contentWords));
  const mine = contentWords(rewrite);
  return mine.length ? mine.filter((w) => theirs.has(w)).length / mine.length : 1;
}

/** A rewrite must be at least this much the visitor's own words (P7-07). */
export const REWRITE_OWN_WORDS = 0.8;

/** Every run of digits in a text: a rewrite may not bring numbers the visitor never gave. */
const numbers = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];

/**
 * The debrief, checked (P7-07): strengths and improvements only where their evidence is a verbatim
 * span of the visitor's answers (the span is what is shown); scores clamped to 1–5; the rewrite
 * dropped if it is too long, out of voice, or brings a number the original answer doesn't have;
 * the weakest answer one that was given. A rewrite may use what was said in any answer, nothing
 * else: no number they didn't give, and at least 80% of its content words theirs.
 */
export function checkDebrief(
  raw: {
    headline: string;
    strengths: { text: string; evidence: string; turn: number }[];
    improvements: { text: string; evidence: string; turn: number }[];
    rewrite: { turn: number; answer: string; why: string } | null;
    scores: Record<(typeof SCORE_KEYS)[number], number>;
    weakest: number | null;
  },
  turns: InterviewTurn[],
): Debrief {
  const points = (list: typeof raw.strengths) =>
    checkLearned(list, turns).slice(0, INTERVIEW_LIMITS.debriefItems);
  const scores = Object.fromEntries(
    SCORE_KEYS.map((k) => [k, score(raw.scores[k])]),
  ) as DebriefScores;
  const original = raw.rewrite ? (turns[raw.rewrite.turn]?.answer ?? '') : '';
  const everything = turns.map((t) => t.answer).join('\n');
  const rewrite =
    raw.rewrite &&
    original &&
    words(raw.rewrite.answer) <= INTERVIEW_LIMITS.rewriteWords &&
    personaLint(raw.rewrite.answer).length === 0 &&
    numbers(raw.rewrite.answer).every((n) => everything.includes(n)) &&
    ownWordsShare(
      raw.rewrite.answer,
      turns.map((t) => t.answer),
    ) >= REWRITE_OWN_WORDS
      ? { turn: raw.rewrite.turn, answer: raw.rewrite.answer.trim(), why: raw.rewrite.why.trim() }
      : null;
  const weakest = raw.weakest !== null && turns[raw.weakest]?.answer.trim() ? raw.weakest : null;
  const headline = raw.headline.trim().slice(0, 240);
  return {
    headline: personaLint(headline).length ? '' : headline,
    strengths: points(raw.strengths),
    improvements: points(raw.improvements),
    rewrite,
    scores,
    weakest,
  };
}

/** The interview's language: what the visitor writes in, once there is enough to tell. */
export function interviewLanguage(request: InterviewRequest): string {
  const said = [
    request.setup.about ?? '',
    request.setup.expertise ?? '',
    ...request.turns.map((t) => t.answer),
  ]
    .filter(Boolean)
    .slice(-2)
    .join(' ');
  return said.length >= 20 ? detectLanguage(said) : (request.uiLocale ?? 'en');
}

const ENDINGS = new Set(['crisis', 'refuse']);

async function ended(
  deps: InterviewDeps,
  request: InterviewRequest,
  signal: AbortSignal,
): Promise<InterviewReply | null> {
  const said = (
    request.turns.length ? (request.turns.at(-1)?.answer ?? '') : (request.setup.about ?? '')
  ).trim();
  if (!said) return null;
  let route = routeQuestion(said, null);
  if (!ENDINGS.has(route.kind) && deps.moderate) {
    const verdict = await moderationVerdict(deps.moderate, said, signal);
    if (verdict === UNAVAILABLE) throw new ModerationUnavailableError(request.uiLocale);
    route = routeQuestion(said, verdict);
  }
  if (route.kind !== 'crisis' && route.kind !== 'refuse') return null;
  let blocks: ResolvedBlock[] = [];
  for (const event of safetyReply(route, request.locale) ?? []) {
    if (event.type === 'final') blocks = event.answer.blocks;
  }
  return { type: 'ended', reason: route.kind, blocks };
}

/** The reply once the daily spend cap is reached (P6-08), as an interview ending. */
export function restingInterview(locale: InterviewRequest['uiLocale'] = 'en'): InterviewReply {
  return {
    type: 'ended',
    reason: 'resting',
    blocks: [
      {
        kind: 'paragraph',
        segments: [{ text: RESTING_REPLY[locale].text, attribution: 'synthesis', citationIds: [] }],
      },
    ],
  };
}

/**
 * One step of an interview (P7-06). The safety rails see every answer first: a crisis or refused
 * answer ends the interview with the fixed reply, and an answer moderation gives no verdict on
 * throws `ModerationUnavailableError` before the model is asked anything (P10-06). Then either the
 * next question (checked, retried once, else a fixed question for the stage) or, once the arc is
 * done or the visitor stops, "What I learned about you" with each line's evidence checked against
 * their own words.
 */
export async function interviewStep(
  deps: InterviewDeps,
  request: InterviewRequest,
  signal: AbortSignal,
): Promise<InterviewReply> {
  const stop = await ended(deps, request, signal);
  if (stop) return stop;

  const language = interviewLanguage(request);
  const arc = arcFor(request.setup);
  if (request.action === 'finish' || request.turns.length >= arc.length) {
    if (request.setup.flavour === 'practice') {
      return {
        type: 'debrief',
        debrief: await debrief(deps, request, language, signal),
        language,
        demo: false,
      };
    }
    return {
      type: 'learned',
      lines: await learned(deps, request, language, signal),
      language,
      demo: false,
    };
  }

  const index = request.turns.length;
  const planned = arc[index] as InterviewStage;
  const previous = request.turns.at(-1)?.stage;
  const examples = styleExamples(deps.store);
  let problems: string[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await deps.model.completeJson({
      instructions: INTERVIEWER_INSTRUCTIONS,
      input: questionInput({
        setup: request.setup,
        turns: request.turns,
        stage: planned,
        index,
        total: arc.length,
        language,
        examples,
        problems,
      }),
      format: NEXT_QUESTION_FORMAT,
      cacheKey: INTERVIEW_CACHE_KEY,
      signal,
    });
    const parsed = NextQuestionSchema.safeParse(safeJson(raw));
    if (!parsed.success) {
      problems = ['Return a JSON object with "question" and "stage".'];
      continue;
    }
    problems = questionProblems(parsed.data.question, examples);
    if (problems.length === 0) {
      const stage = parsed.data.stage === previous ? previous : planned;
      return {
        type: 'question',
        question: parsed.data.question.trim(),
        stage,
        index,
        total: arc.length,
        language,
        demo: false,
      };
    }
  }
  const fallback = FALLBACK_QUESTIONS[language === 'de' ? 'de' : 'en'];
  return {
    type: 'question',
    question: fallback[planned],
    stage: planned,
    index,
    total: arc.length,
    language: language === 'de' ? 'de' : 'en',
    demo: false,
  };
}

const NO_DEBRIEF: Debrief = {
  headline: '',
  strengths: [],
  improvements: [],
  rewrite: null,
  scores: { clarity: 1, specificity: 1, story: 1, brevity: 1 },
  weakest: null,
};

async function debrief(
  deps: InterviewDeps,
  request: InterviewRequest,
  language: string,
  signal: AbortSignal,
): Promise<Debrief> {
  if (!request.turns.some((t) => t.answer.trim())) return NO_DEBRIEF;
  const raw = await deps.model.completeJson({
    instructions: DEBRIEF_INSTRUCTIONS,
    input: debriefInput(request.setup, request.turns, language),
    format: DEBRIEF_FORMAT,
    cacheKey: INTERVIEW_CACHE_KEY,
    signal,
  });
  const parsed = DebriefModelSchema.safeParse(safeJson(raw));
  if (!parsed.success) return NO_DEBRIEF;
  // The model numbers answers from 1 (A1); turns are 0-based.
  const zero = <T extends { turn: number }>(x: T) => ({ ...x, turn: x.turn - 1 });
  const d = parsed.data;
  return checkDebrief(
    {
      headline: d.headline,
      strengths: d.strengths.map(zero),
      improvements: d.improvements.map(zero),
      rewrite: zero(d.rewrite),
      scores: d.scores,
      weakest: d.weakest - 1,
    },
    request.turns,
  );
}

async function learned(
  deps: InterviewDeps,
  request: InterviewRequest,
  language: string,
  signal: AbortSignal,
): Promise<LearnedLine[]> {
  if (!request.turns.some((t) => t.answer.trim())) return [];
  const raw = await deps.model.completeJson({
    instructions: LEARNED_INSTRUCTIONS,
    input: learnedInput(request.setup, request.turns, language),
    format: LEARNED_FORMAT,
    cacheKey: INTERVIEW_CACHE_KEY,
    signal,
  });
  const parsed = LearnedModelSchema.safeParse(safeJson(raw));
  if (!parsed.success) return [];
  // The model numbers answers from 1 (A1); turns are 0-based.
  return checkLearned(
    parsed.data.lines.map((l) => ({ ...l, turn: l.turn - 1 })),
    request.turns,
  );
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
