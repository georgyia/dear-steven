import {
  INTERVIEW_LIMITS,
  INTERVIEW_STAGES,
  type InterviewSetup,
  type InterviewStage,
} from '../schema/index.ts';

const SIX: InterviewStage[] = ['opening', 'story', 'turning-point', 'depth', 'advice', 'closing'];
/** Longer interviews spend the extra questions where the show does: the push, the story, the cost. */
const EXTRA: InterviewStage[] = ['challenge', 'story', 'depth', 'turning-point'];

/**
 * The stages of an interview of `length` questions (6–10), in order: from who you are, through the
 * story and the turning points, to what you'd tell someone starting out (P7-06).
 */
export function interviewArc(length: number = INTERVIEW_LIMITS.defaultQuestions): InterviewStage[] {
  const n = Math.min(
    INTERVIEW_LIMITS.maxQuestions,
    Math.max(INTERVIEW_LIMITS.minQuestions, Math.round(length)),
  );
  return [...SIX, ...EXTRA.slice(0, n - SIX.length)].sort(
    (a, b) => INTERVIEW_STAGES.indexOf(a) - INTERVIEW_STAGES.indexOf(b),
  );
}

/**
 * Practising how to present an expertise (P7-07): six questions that go past the pitch, from a
 * one-line version for the audience to the one thing they should remember.
 */
export const PRACTICE_ARC: InterviewStage[] = [
  'opening',
  'origin',
  'belief',
  'evidence',
  'mistake',
  'takeaway',
];

/** The arc an interview with this setup follows. */
export function arcFor(setup: InterviewSetup): InterviewStage[] {
  return setup.flavour === 'practice' ? PRACTICE_ARC : interviewArc(setup.length);
}

/** What each stage asks about, for the interviewer prompt. */
export const STAGE_GUIDE: Record<InterviewStage, string> = {
  opening: 'who they are and what they do, in their own words; an easy, open door',
  story: 'where it started: a concrete scene, a person, a place, a first attempt',
  'turning-point': 'the moment things changed, and what they decided then',
  depth: 'what it cost them, how it felt, what they were afraid of',
  challenge:
    'push gently on something they said: a contradiction, what they got wrong, what others would disagree with',
  advice: 'what they would tell someone starting out on the same road',
  closing: 'one last reflective question about what matters to them now',
  origin: 'how they came to know this: the moment or experience the expertise grew from',
  belief: 'something they believe about their field that most people in it would disagree with',
  evidence: 'the proof: a result, a number, a case or a person that shows they are right',
  mistake: 'a mistake they made with it, or a time it did not work, and what it taught them',
  takeaway: 'the one thing the audience should remember, said in a sentence',
};
