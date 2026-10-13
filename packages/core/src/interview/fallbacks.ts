import type { InterviewStage } from '../schema/index.ts';

/**
 * A plain question for each stage, for when the model's question fails its checks twice (P7-06).
 * Written by people, general enough to follow any answer, and never anyone's words but ours.
 */
export const FALLBACK_QUESTIONS: Record<'en' | 'de', Record<InterviewStage, string>> = {
  en: {
    opening:
      'Tell me who you are, in your own words: what do you do, and why does it matter to you?',
    story: 'Take me back to where this started for you. What was the first real step?',
    'turning-point': 'Was there a moment when everything changed? What did you decide then?',
    depth: 'What has this cost you that people don’t see?',
    challenge: 'What’s something you believed early on that turned out to be wrong?',
    advice: 'If someone were starting out on the same road tomorrow, what would you tell them?',
    closing: 'When you look at where you are now, what matters to you most?',
  },
  de: {
    opening:
      'Erzähl mir in deinen eigenen Worten, wer du bist: Was machst du, und warum ist es dir wichtig?',
    story: 'Nimm mich mit an den Anfang. Was war der erste echte Schritt?',
    'turning-point':
      'Gab es einen Moment, in dem sich alles verändert hat? Was hast du damals entschieden?',
    depth: 'Was hat dich das gekostet, was andere nicht sehen?',
    challenge: 'Woran hast du anfangs geglaubt, das sich später als falsch herausgestellt hat?',
    advice: 'Wenn morgen jemand denselben Weg beginnen würde, was würdest du ihm sagen?',
    closing: 'Wenn du darauf schaust, wo du heute stehst: Was ist dir am wichtigsten?',
  },
};
