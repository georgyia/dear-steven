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
    origin: 'How did you come to know this so well? What was the moment it started?',
    belief: 'What do you believe about your field that most people in it would disagree with?',
    evidence: 'What’s the strongest proof you’re right: a result, a number, a case?',
    mistake: 'Tell me about a time it didn’t work. What did you get wrong?',
    takeaway: 'If your audience remembers one sentence from you, what should it be?',
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
    origin: 'Wie bist du darin so gut geworden? Was war der Moment, in dem es anfing?',
    belief: 'Was glaubst du über dein Fach, dem die meisten darin widersprechen würden?',
    evidence: 'Was ist der stärkste Beleg, dass du recht hast: ein Ergebnis, eine Zahl, ein Fall?',
    mistake: 'Erzähl mir von einem Mal, als es nicht funktioniert hat. Was lag daneben?',
    takeaway: 'Wenn dein Publikum sich einen Satz von dir merkt, welcher sollte es sein?',
  },
};
