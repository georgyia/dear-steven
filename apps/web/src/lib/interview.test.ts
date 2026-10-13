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

  it('ends with the safety reply when the server stops the interview', () => {
    const state = run(
      { type: 'start', setup: {} },
      { type: 'reply', reply: { type: 'ended', reason: 'crisis', blocks: [] } },
    );
    expect(state).toMatchObject({ phase: 'ended', ended: { reason: 'crisis' } });
    expect(interviewReducer(state, { type: 'reset' })).toBe(initialInterview);
  });
});
