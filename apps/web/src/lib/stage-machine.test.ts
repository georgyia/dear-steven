import { describe, expect, it } from 'vitest';
import {
  ambientLevel,
  initialStage,
  isBusy,
  isVoiceActive,
  type StageEvent,
  type StageState,
  transition,
} from './stage-machine.ts';

const run = (events: StageEvent[], from: StageState = initialStage) =>
  events.reduce<StageState>((s, e) => transition(s, e), from);

describe('stage machine — text path', () => {
  it('goes idle → searching → found → writing → answered', () => {
    expect(run([{ type: 'ASK' }])).toEqual({ kind: 'composing', step: 'searching' });
    expect(run([{ type: 'ASK' }, { type: 'FOUND' }])).toEqual({ kind: 'composing', step: 'found' });
    expect(run([{ type: 'ASK' }, { type: 'FOUND' }, { type: 'WRITING' }])).toEqual({
      kind: 'composing',
      step: 'writing',
    });
    expect(
      run([
        { type: 'ASK' },
        { type: 'FOUND' },
        { type: 'WRITING' },
        { type: 'ANSWERED', insufficient: false },
      ]),
    ).toEqual({ kind: 'answered' });
  });

  it('can write without an explicit FOUND (empty knowledge base short-circuit)', () => {
    expect(run([{ type: 'ASK' }, { type: 'WRITING' }])).toEqual({
      kind: 'composing',
      step: 'writing',
    });
  });

  it('ends in insufficient when the sources do not support an answer', () => {
    expect(run([{ type: 'ASK' }, { type: 'ANSWERED', insufficient: true }])).toEqual({
      kind: 'insufficient',
    });
  });

  it('records errors and allows asking again', () => {
    const failed = run([{ type: 'ASK' }, { type: 'FAILED', error: 'network' }]);
    expect(failed).toEqual({ kind: 'error', error: 'network' });
    expect(transition(failed, { type: 'ASK' })).toEqual({ kind: 'composing', step: 'searching' });
  });

  it('ignores a second ASK while composing', () => {
    const composing = run([{ type: 'ASK' }, { type: 'FOUND' }]);
    expect(transition(composing, { type: 'ASK' })).toBe(composing);
  });

  it('treats STOPPED as a settled answer', () => {
    expect(run([{ type: 'ASK' }, { type: 'STOPPED' }])).toEqual({ kind: 'answered' });
  });

  it('never goes backwards from writing to found', () => {
    const writing = run([{ type: 'ASK' }, { type: 'WRITING' }]);
    expect(transition(writing, { type: 'FOUND' })).toBe(writing);
  });
});

describe('stage machine — voice path', () => {
  it('goes idle → requestingMic → listening → transcribing → idle', () => {
    const states = [
      { type: 'MIC_REQUESTED' },
      { type: 'MIC_GRANTED' },
      { type: 'LISTEN_STOPPED' },
      { type: 'TRANSCRIBED' },
    ] as const satisfies StageEvent[];
    let s: StageState = initialStage;
    const kinds = states.map((e) => {
      s = transition(s, e);
      return s.kind;
    });
    expect(kinds).toEqual(['requestingMic', 'listening', 'transcribing', 'idle']);
  });

  it('recovers from a denied microphone', () => {
    const denied = run([{ type: 'MIC_REQUESTED' }, { type: 'MIC_FAILED', error: 'micDenied' }]);
    expect(denied).toEqual({ kind: 'error', error: 'micDenied' });
    expect(transition(denied, { type: 'MIC_REQUESTED' })).toEqual({ kind: 'requestingMic' });
    expect(transition(denied, { type: 'ASK' }).kind).toBe('composing');
  });

  it('cancelling listening returns to idle without transcribing', () => {
    expect(
      run([{ type: 'MIC_REQUESTED' }, { type: 'MIC_GRANTED' }, { type: 'LISTEN_CANCELLED' }]),
    ).toEqual(initialStage);
  });

  it('cannot start the mic while an answer is composing', () => {
    const composing = run([{ type: 'ASK' }]);
    expect(transition(composing, { type: 'MIC_REQUESTED' })).toBe(composing);
  });
});

describe('stage machine — speaking', () => {
  it('speaks after an answer and returns to answered', () => {
    const answered = run([{ type: 'ASK' }, { type: 'ANSWERED', insufficient: false }]);
    const speaking = transition(answered, { type: 'SPEAK_STARTED' });
    expect(speaking).toEqual({ kind: 'speaking' });
    expect(transition(speaking, { type: 'SPEAK_ENDED' })).toEqual({ kind: 'answered' });
  });

  it('lets a new question or the mic interrupt speech', () => {
    const speaking: StageState = { kind: 'speaking' };
    expect(transition(speaking, { type: 'ASK' }).kind).toBe('composing');
    expect(transition(speaking, { type: 'MIC_REQUESTED' }).kind).toBe('requestingMic');
  });

  it('never starts speaking in the middle of composing', () => {
    const composing = run([{ type: 'ASK' }]);
    expect(transition(composing, { type: 'SPEAK_STARTED' })).toBe(composing);
  });
});

describe('derived flags', () => {
  it('busy while composing or transcribing', () => {
    expect(isBusy({ kind: 'composing', step: 'writing' })).toBe(true);
    expect(isBusy({ kind: 'transcribing' })).toBe(true);
    expect(isBusy({ kind: 'answered' })).toBe(false);
  });

  it('voice active while the mic owns the interaction', () => {
    expect(isVoiceActive({ kind: 'listening' })).toBe(true);
    expect(isVoiceActive({ kind: 'idle' })).toBe(false);
  });

  it('ambient brightens while listening and dims in conversation', () => {
    expect(ambientLevel({ kind: 'listening' }, false)).toBeGreaterThan(
      ambientLevel(initialStage, false),
    );
    expect(ambientLevel(initialStage, true)).toBeLessThan(ambientLevel(initialStage, false));
  });
});
