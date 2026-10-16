import { arcFor, FALLBACK_QUESTIONS } from '@dear-steven/core/interview';
import type { InterviewRequest, InterviewTurn } from '@dear-steven/core/schema';
import { describe, expect, it } from 'vitest';
import { demoInterviewStep } from './demo-interview';

const request = (over: Partial<InterviewRequest> = {}): InterviewRequest => ({
  setup: { name: 'Sam', about: 'Founder of a fintech startup and the host of a podcast about it' },
  turns: [],
  action: 'next',
  ...over,
});

const turn = (answer: string): InterviewTurn => ({
  question: 'Wer bist du?',
  stage: 'opening',
  answer,
});

describe('the demo interview’s language (P10-15)', () => {
  const second = arcFor(request().setup)[1] as InterviewTurn['stage'];

  it('asks in the language you chose, whatever the setup says', () => {
    expect(demoInterviewStep(request({ uiLocale: 'de' }))).toMatchObject({
      type: 'question',
      question: FALLBACK_QUESTIONS.de.opening,
      language: 'de',
      demo: true,
    });
  });

  it('stays in it unless your answers are clearly in another language', () => {
    expect(
      demoInterviewStep(request({ uiLocale: 'de', turns: [turn('Ich bin Designer')] })),
    ).toMatchObject({
      question: FALLBACK_QUESTIONS.de[second],
      language: 'de',
    });
    expect(
      demoInterviewStep(
        request({
          uiLocale: 'de',
          turns: [turn('I started my company because I was tired of working for other people.')],
        }),
      ),
    ).toMatchObject({ question: FALLBACK_QUESTIONS.en[second], language: 'en' });
  });

  it('asks in the interface language when the answers are in one it has no lines for', () => {
    expect(
      demoInterviewStep(
        request({
          uiLocale: 'de',
          turns: [
            turn('Je travaille avec une petite équipe, mais pas pour une grande entreprise.'),
          ],
        }),
      ),
    ).toMatchObject({ question: FALLBACK_QUESTIONS.de[second], language: 'de' });
  });
});
