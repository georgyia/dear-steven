import 'server-only';
import {
  arcFor,
  checkDebrief,
  checkLearned,
  FALLBACK_QUESTIONS,
  fixedLanguage,
  interviewLanguage,
} from '@dear-steven/core/interview';
import { routeQuestion, safetyReply } from '@dear-steven/core/safety';
import type {
  Debrief,
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
    origin: 'Where your expertise comes from.',
    belief: 'What you believe that others don’t.',
    evidence: 'Your proof.',
    mistake: 'What went wrong, and what it taught you.',
    takeaway: 'The one thing to remember.',
  },
  de: {
    opening: 'Wie du beschreibst, was du machst.',
    story: 'Wo es für dich angefangen hat.',
    'turning-point': 'Der Moment, in dem sich etwas verändert hat.',
    depth: 'Was es dich gekostet hat.',
    challenge: 'Etwas, bei dem du falschlagst, und dazu stehst.',
    advice: 'Was du jemandem am Anfang sagen würdest.',
    closing: 'Was dir heute wichtig ist.',
    origin: 'Woher deine Expertise kommt.',
    belief: 'Was du glaubst, was andere nicht glauben.',
    evidence: 'Dein Beleg.',
    mistake: 'Was schiefging, und was du daraus gelernt hast.',
    takeaway: 'Das eine, das man sich merken soll.',
  },
};

/** The demo debrief's fixed words (P7-07). Its scores come from plain rules, stated here. */
const DEBRIEF: Record<'en' | 'de', { headline: string; strength: string; improve: string }> = {
  en: {
    headline:
      'Demo debrief: a fixed reading of your answers, quoting your own words. A live model writes the real one, with a rewrite.',
    strength: 'Your fullest answer: this is where you gave the most to go on.',
    improve: 'Your shortest answer: an example, a number or a name would make it land.',
  },
  de: {
    headline:
      'Demo-Auswertung: eine feste Lesart deiner Antworten, mit deinen eigenen Worten zitiert. Ein Live-Modell schreibt die echte, mit einer Neufassung.',
    strength: 'Deine ausführlichste Antwort: Hier hast du am meisten gegeben.',
    improve: 'Deine kürzeste Antwort: Ein Beispiel, eine Zahl oder ein Name würden sie tragen.',
  },
};

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/**
 * Practice in demo mode: the fullest answer as a strength, the shortest as the thing to work on,
 * both quoted from the visitor; scores from length and whether numbers were given; no rewrite,
 * because only a model could write one.
 */
function demoDebrief(request: InterviewRequest, language: 'en' | 'de'): Debrief {
  const given = request.turns
    .map((t, turn) => ({ answer: t.answer.trim(), turn }))
    .filter((x) => x.answer);
  const byLength = [...given].sort((a, b) => b.answer.length - a.answer.length);
  const longest = byLength[0];
  const shortest = byLength.at(-1);
  const copy = DEBRIEF[language];
  const average = given.length ? given.reduce((n, x) => n + words(x.answer), 0) / given.length : 0;
  const withNumbers = given.filter((x) => /\d/.test(x.answer)).length;
  return checkDebrief(
    {
      headline: given.length ? copy.headline : '',
      strengths: longest
        ? [{ text: copy.strength, evidence: opening(longest.answer), turn: longest.turn }]
        : [],
      improvements:
        shortest && shortest !== longest
          ? [{ text: copy.improve, evidence: opening(shortest.answer), turn: shortest.turn }]
          : [],
      rewrite: null,
      scores: {
        clarity: 3,
        specificity: 2 + Math.min(3, withNumbers),
        story: average > 30 ? 4 : 2,
        brevity: average <= 40 ? 4 : average <= 80 ? 3 : 2,
      },
      weakest: shortest?.turn ?? null,
    },
    request.turns,
  );
}

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

  // The live interview's rule (P10-15), in the two languages the demo lines are written in.
  const language = fixedLanguage(interviewLanguage(request), request.uiLocale);
  const arc = arcFor(request.setup);
  if (request.action === 'finish' || request.turns.length >= arc.length) {
    if (request.setup.flavour === 'practice') {
      return { type: 'debrief', debrief: demoDebrief(request, language), language, demo: true };
    }
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
