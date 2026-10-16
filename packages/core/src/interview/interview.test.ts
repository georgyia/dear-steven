import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnswerModel, ModelRequest } from '../answer/model.ts';
import { MODERATION_UNAVAILABLE } from '../persona/copy.ts';
import { ModerationUnavailableError } from '../safety/index.ts';
import type { InterviewRequest, InterviewTurn } from '../schema/index.ts';
import { InterviewRequestSchema } from '../schema/index.ts';
import { seedEpisode, tempStore } from '../test/fixtures.ts';
import { FALLBACK_QUESTIONS } from './fallbacks.ts';
import {
  checkDebrief,
  checkLearned,
  interviewLanguage,
  interviewStep,
  ownWordsShare,
  questionProblems,
  styleExamples,
} from './interview.ts';
import { DEBRIEF_INSTRUCTIONS, INTERVIEWER_INSTRUCTIONS, LEARNED_INSTRUCTIONS } from './prompt.ts';

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

describe('interviewStep: no step without moderation’s verdict (P10-06)', () => {
  afterEach(() => vi.restoreAllMocks());

  /** A moderator that fails `failures` times (a 503), then finds nothing; it counts its calls. */
  const flaky = (failures: number) => {
    const calls = { n: 0 };
    const moderate = async () => {
      calls.n += 1;
      if (calls.n <= failures)
        throw Object.assign(new Error('Service Unavailable'), { status: 503 });
      return { flagged: false, categories: {}, scores: {} };
    };
    return { moderate, calls };
  };
  const PRACTICE = { flavour: 'practice', expertise: 'pricing for small agencies' } as const;
  const answered = [
    turn('I run a small design studio and we mostly make brands for food start-ups.'),
  ];

  it.each([
    ['the interview’s next question', request({ turns: answered })],
    ['what I learned', request({ turns: answered, action: 'finish' })],
    ['practice’s next question', request({ setup: PRACTICE, turns: answered })],
    ['the practice debrief', request({ setup: PRACTICE, turns: answered, action: 'finish' })],
  ])('fails twice before %s: an upstream error, no model call, one log line', async (_, req) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { model, seen } = scripted();
    const moderator = flaky(Number.POSITIVE_INFINITY);
    const step = interviewStep(
      { model, store: null, moderate: moderator.moderate },
      { ...req, uiLocale: 'de' },
      signal,
    );
    await expect(step).rejects.toBeInstanceOf(ModerationUnavailableError);
    await expect(step).rejects.toMatchObject({
      code: 'upstream',
      message: MODERATION_UNAVAILABLE.de,
    });
    expect(moderator.calls.n).toBe(2);
    expect(seen).toHaveLength(0);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toContain('moderation unavailable');
  });

  it.each([
    ['interview', request({ turns: answered })],
    ['practice', request({ setup: PRACTICE, turns: answered })],
  ])(
    '%s: fails once, then gives a verdict, and the next question comes as normal',
    async (_, req) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { model, seen } = scripted({
        question: 'What made you start the studio rather than join one?',
        stage: 'story',
      });
      const moderator = flaky(1);
      const reply = await interviewStep(
        { model, store: null, moderate: moderator.moderate },
        req,
        signal,
      );
      expect(reply).toMatchObject({ type: 'question', index: 1 });
      expect(moderator.calls.n).toBe(2);
      expect(seen).toHaveLength(1);
      expect(log).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['interview', request({ turns: [turn('Honestly, I want to kill myself most days.')] })],
    ['practice', request({ setup: PRACTICE, turns: [turn('I want to end my life.')] })],
  ])('%s: moderation down, a crisis phrase still ends with the crisis reply', async (_, req) => {
    const { model, seen } = scripted();
    const moderator = flaky(Number.POSITIVE_INFINITY);
    const reply = await interviewStep(
      { model, store: null, moderate: moderator.moderate },
      { ...req, locale: 'en-GB' },
      signal,
    );
    expect(reply).toMatchObject({ type: 'ended', reason: 'crisis' });
    expect(JSON.stringify(reply)).toMatch(/116 123/);
    expect(moderator.calls.n).toBe(0);
    expect(seen).toHaveLength(0);
  });

  it.each([401, 403, 429])(
    '%i from moderation fails the step as the model call would, asked once (P10-13)',
    async (status) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const refused = Object.assign(new Error(`${status} from OpenAI`), { status });
      let asked = 0;
      const moderate = async () => {
        asked += 1;
        throw refused;
      };
      const { model, seen } = scripted();
      const step = interviewStep(
        { model, store: null, moderate },
        request({ turns: answered }),
        signal,
      );
      await expect(step).rejects.toBe(refused);
      expect(asked).toBe(1);
      expect(seen).toHaveLength(0);
      expect(log).not.toHaveBeenCalled();
    },
  );
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

  it('accepts a whole short answer quoted exactly, and nothing short that is only part of one', () => {
    const short = [turn('It depends.'), turn('Yes, I think so, mostly.', { stage: 'story' })];
    expect(
      checkLearned(
        [
          { text: 'You hedged.', evidence: 'it depends', turn: 0 },
          { text: 'Too short a part.', evidence: 'I think', turn: 1 },
        ],
        short,
      ),
    ).toEqual([{ text: 'You hedged.', evidence: 'It depends.', turn: 0 }]);
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

describe('practice: a mock interview about an expertise (P7-07)', () => {
  const practice = (over: Partial<InterviewRequest> = {}): InterviewRequest =>
    request({
      setup: { flavour: 'practice', expertise: 'pricing for small agencies', audience: 'founders' },
      ...over,
    });

  it('follows the practice arc, and tells the interviewer what is being practised', async () => {
    const { model, seen } = scripted({
      question: 'How did pricing become your thing?',
      stage: 'origin',
    });
    const reply = await interviewStep(
      { model, store: null },
      practice({ turns: [turn('I help small agencies stop undercharging.')] }),
      signal,
    );
    expect(reply).toMatchObject({ type: 'question', stage: 'origin', index: 1, total: 6 });
    const input = seen[0]?.input[0]?.content ?? '';
    expect(input).toContain(
      '<practice>\nTheir expertise: pricing for small agencies\nTheir audience: founders',
    );
  });

  const answers = [
    turn('I help small agencies stop undercharging, usually by 30 percent.'),
    turn('I ran an agency that went broke in 2019 because we billed by the hour.', {
      stage: 'origin',
    }),
    turn('Things are complicated and it depends on a lot of factors really.', { stage: 'belief' }),
  ];

  it('debriefs with checked evidence, bounded scores and a rewrite that adds no numbers', async () => {
    const { model, seen } = scripted({
      headline: 'Clear when you tell the story; vague when you state the belief.',
      strengths: [
        {
          text: 'A number makes the promise concrete.',
          evidence: 'usually by 30 percent',
          turn: 1,
        },
        { text: 'Invented praise.', evidence: 'you were brilliant throughout', turn: 1 },
      ],
      improvements: [
        { text: 'Say what it depends on.', evidence: 'it depends on a lot of factors', turn: 3 },
      ],
      rewrite: {
        turn: 3,
        answer:
          'Hourly billing is the trap: it broke my agency in 2019, and it costs most agencies 40 percent.',
        why: 'Leads with the belief.',
      },
      scores: { clarity: 4, specificity: 9, story: 0, brevity: 3 },
      weakest: 3,
    });
    const reply = await interviewStep(
      { model, store: null },
      practice({ turns: answers, action: 'finish' }),
      signal,
    );
    if (reply.type !== 'debrief') throw new Error(`expected a debrief, got ${reply.type}`);
    expect(seen[0]?.instructions).toBe(DEBRIEF_INSTRUCTIONS);
    const d = reply.debrief;
    expect(d.strengths).toEqual([
      {
        text: 'A number makes the promise concrete.',
        evidence: 'usually by 30 percent.',
        turn: 0,
      },
    ]);
    expect(d.improvements[0]).toMatchObject({
      evidence: 'it depends on a lot of factors',
      turn: 2,
    });
    expect(d.scores).toEqual({ clarity: 4, specificity: 5, story: 1, brevity: 3 });
    // "2019" was said (in answer 2), but "40 percent" never was: the rewrite would add a fact.
    expect(d.rewrite).toBeNull();
    expect(d.weakest).toBe(2);
  });

  it('keeps a rewrite that only reorders what was said', () => {
    const d = checkDebrief(
      {
        headline: 'Good.',
        strengths: [],
        improvements: [],
        rewrite: {
          turn: 1,
          answer: 'Billing by the hour broke my agency in 2019. That is why I do this.',
          why: 'The lesson first.',
        },
        scores: { clarity: 3, specificity: 3, story: 3, brevity: 3 },
        weakest: 7,
      },
      answers,
    );
    expect(d.rewrite?.turn).toBe(1);
    expect(d.weakest).toBeNull();
  });

  it('debriefs nothing, without a model call, when every question was skipped', async () => {
    const { model, seen } = scripted();
    const reply = await interviewStep(
      { model, store: null },
      practice({ turns: [turn(''), turn('', { stage: 'origin' })], action: 'finish' }),
      signal,
    );
    expect(reply).toMatchObject({
      type: 'debrief',
      debrief: { strengths: [], rewrite: null, weakest: null },
    });
    expect(seen).toHaveLength(0);
  });
});

describe('ownWordsShare (P7-07)', () => {
  const answers = [
    'Rotate shifts forward, never backward.',
    'In a trial across three wards, switching to forward rotation cut sick days by 22 percent.',
  ];

  it('is high for a rewrite built from what they said', () => {
    expect(
      ownWordsShare(
        'Switching to forward rotation cut sick days by 22 percent across three wards. Rotate shifts forward, never backward.',
        answers,
      ),
    ).toBeGreaterThanOrEqual(0.9);
  });

  it('is low for one that brings new substance, and such a rewrite is dropped', () => {
    const invented =
      'Circadian science proves melatonin timing matters; managers must invest in blackout rooms and nutrition coaching.';
    expect(ownWordsShare(invented, answers)).toBeLessThan(0.3);
    const d = checkDebrief(
      {
        headline: 'Good.',
        strengths: [],
        improvements: [],
        rewrite: { turn: 0, answer: invented, why: 'More science.' },
        scores: { clarity: 3, specificity: 3, story: 3, brevity: 3 },
        weakest: null,
      },
      answers.map((answer) => turn(answer)),
    );
    expect(d.rewrite).toBeNull();
  });
});
