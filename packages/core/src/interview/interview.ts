import type { AnswerModel } from '../answer/model.ts';
import { locateQuote, normalise } from '../answer/quotes.ts';
import { detectLanguage } from '../language/detect.ts';
import { RESTING_REPLY } from '../persona/copy.ts';
import { personaLint } from '../persona/persona.ts';
import { type ModerationResult, routeQuestion, safetyReply } from '../safety/index.ts';
import {
  INTERVIEW_LIMITS,
  type InterviewReply,
  type InterviewRequest,
  type InterviewStage,
  type InterviewTurn,
  type LearnedLine,
  type ResolvedBlock,
} from '../schema/index.ts';
import type { KnowledgeStore } from '../store/index.ts';
import { interviewArc } from './arc.ts';
import { FALLBACK_QUESTIONS } from './fallbacks.ts';
import {
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
  moderate?: (text: string, signal: AbortSignal) => Promise<ModerationResult>;
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
    const span = locateQuote(answer, line.evidence);
    if (!span || words(span.text) < 3) continue;
    out.push({ text, evidence: span.text, turn: line.turn });
    if (out.length === INTERVIEW_LIMITS.learnedLines) break;
  }
  return out;
}

/** The interview's language: what the visitor writes in, once there is enough to tell. */
export function interviewLanguage(request: InterviewRequest): string {
  const said = [request.setup.about ?? '', ...request.turns.map((t) => t.answer)]
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
    route = routeQuestion(said, await deps.moderate(said, signal).catch(() => null));
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
 * answer ends the interview with the fixed reply. Then either the next question (checked, retried
 * once, else a fixed question for the stage) or, once the arc is done or the visitor stops,
 * "What I learned about you" with each line's evidence checked against their own words.
 */
export async function interviewStep(
  deps: InterviewDeps,
  request: InterviewRequest,
  signal: AbortSignal,
): Promise<InterviewReply> {
  const stop = await ended(deps, request, signal);
  if (stop) return stop;

  const language = interviewLanguage(request);
  const arc = interviewArc(request.setup.length);
  if (request.action === 'finish' || request.turns.length >= arc.length) {
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
