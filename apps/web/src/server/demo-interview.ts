import 'server-only';
import { checkLearned, FALLBACK_QUESTIONS, interviewArc } from '@dear-steven/core/interview';
import { detectLanguage } from '@dear-steven/core/language';
import { routeQuestion, safetyReply } from '@dear-steven/core/safety';
import type {
  InterviewReply,
  InterviewRequest,
  InterviewStage,
  ResolvedBlock,
} from '@dear-steven/core/schema';

/** What each demo line is about, in the interface's two languages. */
const ABOUT: Record<'en' | 'de', Record<InterviewStage, string>> = {
  en: {
    opening: 'How you describe what you do.',
    story: 'Where it started for you.',
    'turning-point': 'The moment things changed.',
    depth: 'What it has cost you.',
    challenge: 'Something you got wrong, and own.',
    advice: 'What you’d tell someone starting out.',
    closing: 'What matters to you now.',
  },
  de: {
    opening: 'Wie du beschreibst, was du machst.',
    story: 'Wo es für dich angefangen hat.',
    'turning-point': 'Der Moment, in dem sich etwas verändert hat.',
    depth: 'Was es dich gekostet hat.',
    challenge: 'Etwas, bei dem du falschlagst, und dazu stehst.',
    advice: 'Was du jemandem am Anfang sagen würdest.',
    closing: 'Was dir heute wichtig ist.',
  },
};

/** The first sentence of an answer, at most 20 words, exactly as it was written. */
function opening(answer: string): string {
  const sentence = answer.match(/^[^.!?]+[.!?]?/)?.[0] ?? answer;
  const words = [...sentence.matchAll(/\S+/g)].slice(0, 20);
  const last = words.at(-1);
  return last ? sentence.slice(0, (last.index ?? 0) + last[0].length) : '';
}

/**
 * Interview mode with no API key (P7-06): the same steps and the same safety rails, with the fixed
 * question for each stage, and "what I learned" made only of the visitor's own first sentences.
 * Labelled demo, like every fixture.
 */
export function demoInterviewStep(request: InterviewRequest): InterviewReply {
  const said = (
    request.turns.length ? (request.turns.at(-1)?.answer ?? '') : (request.setup.about ?? '')
  ).trim();
  const route = said ? routeQuestion(said, null) : null;
  if (route && (route.kind === 'crisis' || route.kind === 'refuse')) {
    let blocks: ResolvedBlock[] = [];
    for (const event of safetyReply(route, request.locale) ?? []) {
      if (event.type === 'final') blocks = event.answer.blocks;
    }
    return { type: 'ended', reason: route.kind, blocks };
  }

  const answers = request.turns.map((t) => t.answer).join(' ');
  const language: 'en' | 'de' =
    answers.length >= 20
      ? detectLanguage(answers) === 'de'
        ? 'de'
        : 'en'
      : request.uiLocale === 'de'
        ? 'de'
        : 'en';
  const arc = interviewArc(request.setup.length);
  if (request.action === 'finish' || request.turns.length >= arc.length) {
    const candidates = request.turns
      .map((t, turn) => ({ text: ABOUT[language][t.stage], evidence: opening(t.answer), turn }))
      .filter((l) => l.evidence)
      .sort((a, b) => b.evidence.length - a.evidence.length)
      .slice(0, 3)
      .sort((a, b) => a.turn - b.turn);
    return {
      type: 'learned',
      lines: checkLearned(candidates, request.turns),
      language,
      demo: true,
    };
  }
  const stage = arc[request.turns.length] as InterviewStage;
  return {
    type: 'question',
    question: FALLBACK_QUESTIONS[language][stage],
    stage,
    index: request.turns.length,
    total: arc.length,
    language,
    demo: true,
  };
}
