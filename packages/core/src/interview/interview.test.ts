import { describe, expect, it } from 'vitest';
import type { AnswerModel, ModelRequest } from '../answer/model.ts';
import type { InterviewRequest, InterviewTurn } from '../schema/index.ts';
import { InterviewRequestSchema } from '../schema/index.ts';
import { seedEpisode, tempStore } from '../test/fixtures.ts';
import { FALLBACK_QUESTIONS } from './fallbacks.ts';
import {
  checkLearned,
  interviewLanguage,
  interviewStep,
  questionProblems,
  styleExamples,
} from './interview.ts';
import { INTERVIEWER_INSTRUCTIONS, LEARNED_INSTRUCTIONS } from './prompt.ts';

/** A model that answers each completeJson call with the next scripted reply, and records it. */
function scripted(...replies: unknown[]) {
  const seen: (ModelRequest & { format: { name: string } })[] = [];
  const model: AnswerModel = {
    // biome-ignore lint/correctness/useYield: the interview never streams
    async *streamJson() {
      throw new Error('not used');
    },
    async completeJson(request) {
      seen.push(request);
      const next = replies.shift();
      if (next === undefined) throw new Error('no reply scripted');
      return typeof next === 'string' ? next : JSON.stringify(next);
    },
    async completeText() {
      throw new Error('not used');
    },
  };
  return { model, seen };
}

const turn = (answer: string, over: Partial<InterviewTurn> = {}): InterviewTurn => ({
  question: 'What do you do?',
  stage: 'opening',
  answer,
  ...over,
});

const request = (over: Partial<InterviewRequest> = {}): InterviewRequest => ({
  setup: { name: 'Sam', about: 'I run a small design studio.' },
  turns: [],
  action: 'next',
  ...over,
});

const signal = new AbortController().signal;

describe('interviewStep: the next question (P7-06)', () => {
  it('asks the planned stage, with the guest, the interview so far and the language', async () => {
    const { model, seen } = scripted({
      question: 'What made you start the studio rather than join one?',
      stage: 'story',
    });
    const reply = await interviewStep(
      { model, store: null },
      request({ turns: [turn('I run a studio of four people, mostly brand work for start-ups.')] }),
      signal,
    );
    expect(reply).toMatchObject({
      type: 'question',
      question: 'What made you start the studio rather than join one?',
      stage: 'story',
      index: 1,
      total: 7,
      language: 'en',
    });
    expect(seen[0]?.instructions).toBe(INTERVIEWER_INSTRUCTIONS);
    const input = seen[0]?.input.map((m) => m.content).join('\n') ?? '';
    expect(input).toContain('Name: Sam');
    expect(input).toContain('A1: I run a studio of four people');
    expect(input).toMatch(/<stage>\nstory: /);
    expect(input).toContain('<language>en</language>');
    expect(input).toContain('Ask question 2 of 7.');
  });

  it('allows one follow-up on the previous stage, and otherwise keeps to the plan', async () => {
    const follow = await interviewStep(
      {
        model: scripted({ question: 'Why four people and not five?', stage: 'opening' }).model,
        store: null,
      },
      request({ turns: [turn('A studio of four.')] }),
      signal,
    );
    expect(follow).toMatchObject({ type: 'question', stage: 'opening' });
    const drift = await interviewStep(
      {
        model: scripted({ question: 'What would you tell someone starting?', stage: 'advice' })
          .model,
        store: null,
      },
      request({ turns: [turn('A studio of four.')] }),
      signal,
    );
    expect(drift).toMatchObject({ type: 'question', stage: 'story' });
  });

  it('retries a question that breaks the rules once, then falls back to a fixed one', async () => {
    const long = `${'Why '.repeat(45)}?`;
    const retried = scripted(
      { question: 'Two questions? Really?', stage: 'opening' },
      {
        question: 'What do you love about the work?',
        stage: 'opening',
      },
    );
    const ok = await interviewStep({ model: retried.model, store: null }, request(), signal);
    expect(ok).toMatchObject({ question: 'What do you love about the work?' });
    expect(retried.seen[1]?.input[0]?.content).toMatch(/Ask exactly one question/);

    const failing = scripted({ question: long, stage: 'opening' }, 'not json');
    const fallback = await interviewStep({ model: failing.model, store: null }, request(), signal);
    expect(fallback).toMatchObject({ type: 'question', question: FALLBACK_QUESTIONS.en.opening });
  });

  it('asks in the language the visitor writes in', async () => {
    const { model, seen } = scripted({ question: 'Wie hat das angefangen?', stage: 'story' });
    const reply = await interviewStep(
      { model, store: null },
      request({
        setup: {},
        turns: [turn('Ich leite ein kleines Designstudio in Berlin, seit sechs Jahren schon.')],
      }),
      signal,
    );
    expect(reply).toMatchObject({ language: 'de' });
    expect(seen[0]?.input[0]?.content).toContain('<language>de</language>');
  });
});

describe('interviewStep: the safety rails see every answer (P7-06)', () => {
  it('ends the interview with the crisis reply, and asks the model nothing', async () => {
    const { model, seen } = scripted();
    const reply = await interviewStep(
      { model, store: null },
      request({ turns: [turn('Honestly, I want to kill myself most days.')], locale: 'en-GB' }),
      signal,
    );
    expect(reply.type).toBe('ended');
    if (reply.type === 'ended') {
      expect(reply.reason).toBe('crisis');
      expect(JSON.stringify(reply.blocks)).toMatch(/Samaritans|116 123/);
    }
    expect(seen).toHaveLength(0);
  });

  it('checks the setup line before the first question, and moderation when there is one', async () => {
    const { model, seen } = scripted();
    const flagged = await interviewStep(
      {
        model,
        store: null,
        moderate: async () => ({
          flagged: true,
          categories: { 'self-harm/intent': true },
          scores: { 'self-harm/intent': 0.9 },
        }),
      },
      request({ setup: { about: 'I am not doing well at all lately.' } }),
      signal,
    );
    expect(flagged).toMatchObject({ type: 'ended', reason: 'crisis' });
    expect(seen).toHaveLength(0);
  });
});

describe('what I learned about you (P7-06)', () => {
  const turns = [
    turn('I started the studio the week my daughter was born, which was terrifying.'),
    turn('', { stage: 'story' }),
    turn('Our first client paid us in pizza and a reference.', { stage: 'turning-point' }),
  ];

  it('keeps only lines whose evidence is the visitor’s own words, shown as they said them', () => {
    const lines = checkLearned(
      [
        {
          text: 'You started the studio when your daughter was born.',
          evidence: 'the week my daughter was born',
          turn: 0,
        },
        {
          text: 'Your first client paid in pizza.',
          evidence: 'first client PAID us in pizza',
          turn: 2,
        },
        { text: 'You doubted yourself.', evidence: 'I was full of doubt', turn: 0 },
        { text: 'You skipped this.', evidence: 'anything at all here', turn: 1 },
        { text: 'Out of range.', evidence: 'the week my daughter was born', turn: 9 },
      ],
      turns,
    );
    expect(lines).toEqual([
      {
        text: 'You started the studio when your daughter was born.',
        evidence: 'the week my daughter was born',
        turn: 0,
      },
      {
        text: 'Your first client paid in pizza.',
        evidence: 'first client paid us in pizza',
        turn: 2,
      },
    ]);
  });

  it('ends with the checked lines once the arc is done, numbering answers from A1', async () => {
    const { model, seen } = scripted({
      lines: [
        {
          text: 'You started the studio when your daughter was born.',
          evidence: 'the week my daughter was born',
          turn: 1,
        },
        { text: 'You were paid in pizza.', evidence: 'paid us in pizza and a reference', turn: 1 },
      ],
    });
    const reply = await interviewStep(
      { model, store: null },
      request({ turns, action: 'finish' }),
      signal,
    );
    expect(seen[0]?.instructions).toBe(LEARNED_INSTRUCTIONS);
    expect(reply).toMatchObject({
      type: 'learned',
      lines: [{ evidence: 'the week my daughter was born', turn: 0 }],
    });
  });

  it('learns nothing, without a model call, when every question was skipped', async () => {
    const { model, seen } = scripted();
    const reply = await interviewStep(
      { model, store: null },
      request({ turns: [turn(''), turn('', { stage: 'story' })], action: 'finish' }),
      signal,
    );
    expect(reply).toMatchObject({ type: 'learned', lines: [] });
    expect(seen).toHaveLength(0);
  });
});

describe('questionProblems', () => {
  it('wants one short question, in voice, of our own', () => {
    expect(questionProblems('What made you start?')).toEqual([]);
    expect(questionProblems('What made you start? And why?')).toHaveLength(1);
    expect(questionProblems('Tell me about it.')).toHaveLength(1);
    expect(questionProblems(`${'word '.repeat(41)}?`)).toHaveLength(1);
    expect(questionProblems('Great question, but what made you start?')).toHaveLength(1);
    expect(
      questionProblems('So what was the moment you knew it would work?', [
        'What was the moment you knew it would work?',
      ]),
    ).toHaveLength(1);
  });
});

describe('styleExamples', () => {
  it('takes whole questions from the transcripts, verified host turns first', () => {
    expect(styleExamples(null)).toEqual([]);
    const store = tempStore();
    const segments = [
      {
        speaker: 'guest',
        text: 'And then my mentor asked me, what are you actually afraid of here?',
      },
      {
        speaker: 'host',
        text: 'That makes sense. What did that moment cost you, really, at the time?',
      },
      { speaker: 'unknown', text: 'we were... so why?' },
      { speaker: 'host', text: 'No question here at all, just a statement about the work.' },
    ].map((s, idx) => ({
      idx,
      startMs: idx * 5000,
      endMs: idx * 5000 + 4000,
      speaker: s.speaker as 'host' | 'guest' | 'unknown',
      speakerName: null,
      attributionMethod: 'diarization' as const,
      attributionConfidence: 0.9,
      text: s.text,
    }));
    seedEpisode(store, 1, [], segments);
    expect(styleExamples(store)).toEqual(['What did that moment cost you, really, at the time?']);
  });
});

describe('interviewLanguage', () => {
  it('follows what the visitor writes, else the interface', () => {
    expect(interviewLanguage(request({ setup: {}, uiLocale: 'de' }))).toBe('de');
    expect(
      interviewLanguage(
        request({
          setup: {},
          turns: [turn('I build furniture for small flats in London.')],
          uiLocale: 'de',
        }),
      ),
    ).toBe('en');
  });
});

describe('InterviewRequestSchema', () => {
  it('bounds what a client can send', () => {
    expect(InterviewRequestSchema.safeParse(request()).success).toBe(true);
    expect(
      InterviewRequestSchema.safeParse(
        request({ turns: Array.from({ length: 11 }, () => turn('x')) }),
      ).success,
    ).toBe(false);
    expect(
      InterviewRequestSchema.safeParse({ ...request(), setup: { about: 'x'.repeat(241) } }).success,
    ).toBe(false);
    expect(InterviewRequestSchema.safeParse({ ...request(), extra: true }).success).toBe(false);
  });
});
