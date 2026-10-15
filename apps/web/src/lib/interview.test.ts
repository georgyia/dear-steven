import type { InterviewReply } from '@dear-steven/core/schema';
import { describe, expect, it } from 'vitest';
import {
  type InterviewAction,
  initialInterview,
  interviewReducer,
  interviewRequest,
} from './interview';

const question = (index: number): InterviewReply => ({
  type: 'question',
  question: `Question ${index + 1}?`,
  stage: index === 0 ? 'opening' : 'story',
  index,
  total: 7,
  language: 'en',
  demo: false,
});

const run = (...actions: InterviewAction[]) => actions.reduce(interviewReducer, initialInterview);

describe('the interview on the page (P7-06)', () => {
  it('starts with a trimmed setup, asks, records answers and skips, and asks again', () => {
    const state = run(
      { type: 'start', setup: { name: '  Sam ', about: '' } },
      { type: 'reply', reply: question(0) },
      { type: 'answer', text: '  I run a studio.  ' },
      { type: 'reply', reply: question(1) },
      { type: 'skip' },
    );
    expect(state.setup).toEqual({ name: 'Sam' });
    expect(state.phase).toBe('waiting');
    expect(state.turns).toEqual([
      { question: 'Question 1?', stage: 'opening', answer: 'I run a studio.' },
      { question: 'Question 2?', stage: 'story', answer: '' },
    ]);
    expect(interviewRequest(state, 'en')).toEqual({
      setup: { name: 'Sam' },
      turns: state.turns,
      action: 'next',
      uiLocale: 'en',
    });
  });

  it('ignores an empty answer and anything out of turn', () => {
    const asking = run({ type: 'start', setup: {} }, { type: 'reply', reply: question(0) });
    expect(interviewReducer(asking, { type: 'answer', text: '   ' })).toBe(asking);
    expect(interviewReducer(initialInterview, { type: 'answer', text: 'hi' })).toBe(
      initialInterview,
    );
    expect(interviewReducer(asking, { type: 'reply', reply: question(1) })).toBe(asking);
  });

  it('can stop early, fail and retry the same step, and end with what was learned', () => {
    let state = run(
      { type: 'start', setup: {} },
      { type: 'reply', reply: question(0) },
      { type: 'finish' },
    );
    expect(state.action).toBe('finish');
    state = interviewReducer(state, { type: 'failed', message: 'OpenAI had a problem.' });
    expect(state).toMatchObject({ phase: 'error', error: 'OpenAI had a problem.' });
    state = interviewReducer(state, { type: 'retry' });
    expect(state).toMatchObject({ phase: 'waiting', action: 'finish', error: null });
    state = interviewReducer(state, {
      type: 'reply',
      reply: { type: 'learned', lines: [], language: 'en', demo: true },
    });
    expect(state).toMatchObject({ phase: 'learned', learned: { lines: [], demo: true } });
  });

  it('keeps why a step failed until it is retried (P10-08)', () => {
    let state = run({ type: 'start', setup: {} });
    state = interviewReducer(state, {
      type: 'failed',
      message: 'No free questions left.',
      code: 'needs_key',
    });
    expect(state).toMatchObject({ phase: 'error', errorCode: 'needs_key' });
    state = interviewReducer(state, { type: 'retry' });
    expect(state).toMatchObject({ phase: 'waiting', error: null, errorCode: null });
  });

  it('ends with the safety reply when the server stops the interview', () => {
    const state = run(
      { type: 'start', setup: {} },
      { type: 'reply', reply: { type: 'ended', reason: 'crisis', blocks: [] } },
    );
    expect(state).toMatchObject({ phase: 'ended', ended: { reason: 'crisis' } });
    expect(interviewReducer(state, { type: 'reset' })).toBe(initialInterview);
  });
});

describe('practice on the page (P7-07)', () => {
  const debrief = (weakest: number | null): InterviewReply => ({
    type: 'debrief',
    debrief: {
      headline: 'Clear, but vague on proof.',
      strengths: [],
      improvements: [],
      rewrite: null,
      scores: { clarity: 4, specificity: 2, story: 3, brevity: 4 },
      weakest,
    },
    language: 'en',
    demo: false,
  });

  it('needs an expertise to start, and keeps the audience', () => {
    expect(run({ type: 'start', setup: { flavour: 'practice', expertise: '  ' } }).phase).toBe(
      'setup',
    );
    expect(
      run({
        type: 'start',
        setup: { flavour: 'practice', expertise: ' Pricing ', audience: 'Founders' },
      }).setup,
    ).toEqual({ flavour: 'practice', expertise: 'Pricing', audience: 'Founders' });
  });

  it('practises the weakest answer again, then asks for a fresh debrief with it replaced', () => {
    let state = run(
      { type: 'start', setup: { flavour: 'practice', expertise: 'Pricing' } },
      { type: 'reply', reply: question(0) },
      { type: 'answer', text: 'First answer.' },
      { type: 'reply', reply: question(1) },
      { type: 'answer', text: 'It depends.' },
      { type: 'reply', reply: debrief(1) },
    );
    expect(state.phase).toBe('debrief');
    state = interviewReducer(state, { type: 'retake' });
    expect(state).toMatchObject({
      phase: 'asking',
      retake: 1,
      current: { question: 'Question 2?' },
    });
    state = interviewReducer(state, {
      type: 'answer',
      text: 'It depends on margin: aim for 60 percent.',
    });
    expect(state.turns.map((t) => t.answer)).toEqual([
      'First answer.',
      'It depends on margin: aim for 60 percent.',
    ]);
    expect(state).toMatchObject({ phase: 'waiting', action: 'finish', retake: null });
  });

  it('has nothing to retake when no answer was weakest', () => {
    const state = run(
      { type: 'start', setup: { flavour: 'practice', expertise: 'Pricing' } },
      { type: 'reply', reply: question(0) },
      { type: 'finish' },
      { type: 'reply', reply: debrief(null) },
    );
    expect(interviewReducer(state, { type: 'retake' })).toBe(state);
  });
});
