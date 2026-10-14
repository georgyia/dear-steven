import { describe, expect, it } from 'vitest';
import {
  type ConversationEvent,
  type ConversationState,
  conversationOff,
  conversationReducer,
  micMayBeOpen,
} from './spoken-conversation';

const run = (events: ConversationEvent[], from: ConversationState = conversationOff) =>
  events.reduce(conversationReducer, from);

describe('a spoken conversation (P9-02)', () => {
  it('takes turns: you, then him, then you again, with no tap in between', () => {
    let s = run([{ type: 'start', first: 'yours' }]);
    expect(s).toEqual({ phase: 'yours', words: '' });
    s = run(
      [
        { type: 'words', text: 'why do I' },
        { type: 'words', text: 'why do I wait' },
      ],
      s,
    );
    expect(s).toEqual({ phase: 'yours', words: 'why do I wait' });
    s = run([{ type: 'sent' }], s);
    expect(s).toEqual({ phase: 'his' });
    s = run([{ type: 'replied' }], s);
    expect(s).toEqual({ phase: 'yours', words: '' });
  });

  it('an interview starts with his question (P9-03)', () => {
    expect(run([{ type: 'start', first: 'his' }])).toEqual({ phase: 'his' });
  });

  it('opens the mic only on your turn', () => {
    expect(micMayBeOpen(run([{ type: 'start', first: 'yours' }]))).toBe(true);
    for (const closed of [
      conversationOff,
      run([{ type: 'start', first: 'his' }]),
      run([
        { type: 'start', first: 'yours' },
        { type: 'pause', reason: 'idle' },
      ]),
    ]) {
      expect(micMayBeOpen(closed)).toBe(false);
    }
  });

  it('pauses, and carries on with your turn', () => {
    for (const reason of ['idle', 'hidden', 'failed'] as const) {
      const paused = run([
        { type: 'start', first: 'yours' },
        { type: 'pause', reason },
      ]);
      expect(paused).toEqual({ phase: 'paused', reason });
      expect(run([{ type: 'resume' }], paused)).toEqual({ phase: 'yours', words: '' });
    }
    expect(
      run([
        { type: 'start', first: 'his' },
        { type: 'pause', reason: 'failed' },
      ]),
    ).toEqual({
      phase: 'paused',
      reason: 'failed',
    });
  });

  it('ends from anywhere', () => {
    for (const from of [
      run([{ type: 'start', first: 'yours' }]),
      run([{ type: 'start', first: 'his' }]),
      run([
        { type: 'start', first: 'yours' },
        { type: 'pause', reason: 'idle' },
      ]),
    ]) {
      expect(run([{ type: 'end' }], from)).toBe(conversationOff);
    }
  });

  it('ignores what makes no sense where it is', () => {
    const his = run([{ type: 'start', first: 'his' }]);
    expect(run([{ type: 'words', text: 'late words' }], his)).toBe(his);
    expect(run([{ type: 'sent' }], his)).toBe(his);
    expect(run([{ type: 'resume' }], his)).toBe(his);
    const yours = run([{ type: 'start', first: 'yours' }]);
    expect(run([{ type: 'replied' }], yours)).toBe(yours);
    expect(run([{ type: 'start', first: 'his' }], yours)).toBe(yours);
    expect(
      run([
        { type: 'pause', reason: 'idle' },
        { type: 'words', text: 'x' },
      ]),
    ).toBe(conversationOff);
  });
});
