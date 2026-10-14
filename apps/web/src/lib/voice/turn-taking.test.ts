import { describe, expect, it } from 'vitest';
import {
  type Heard,
  LevelGate,
  MIN_SPEECH_LEVEL,
  SPEECH_ONSET_MS,
  TURN_TIMING,
  turnVerdict,
} from './turn-taking';

const talk = TURN_TIMING.talk;
const heard = (over: Partial<Heard> = {}): Heard => ({
  openedAt: 0,
  firstSpeechAt: null,
  lastSpeechAt: null,
  ...over,
});

describe('when your turn ends (P9-02)', () => {
  it('ends a pause after your last word', () => {
    const h = heard({ firstSpeechAt: 1_000, lastSpeechAt: 2_000 });
    expect(turnVerdict(h, 2_000 + talk.pauseMs - 1, talk)).toBe('listening');
    expect(turnVerdict(h, 2_000 + talk.pauseMs, talk)).toBe('ended');
  });

  it('never ends on silence alone: before any word, it waits, then pauses the conversation', () => {
    expect(turnVerdict(heard(), talk.pauseMs * 10, talk)).toBe('listening');
    expect(turnVerdict(heard(), talk.idleMs - 1, talk)).toBe('listening');
    expect(turnVerdict(heard(), talk.idleMs, talk)).toBe('idle');
  });

  it('a word just before the idle limit keeps the turn open', () => {
    const h = heard({ firstSpeechAt: talk.idleMs - 100, lastSpeechAt: talk.idleMs - 100 });
    expect(turnVerdict(h, talk.idleMs + 200, talk)).toBe('listening');
  });

  it('ends a turn that runs past the limit, however it goes on', () => {
    const h = heard({ firstSpeechAt: 1_000, lastSpeechAt: 1_000 + talk.maxMs });
    expect(turnVerdict(h, 1_000 + talk.maxMs, talk)).toBe('ended');
  });

  it('gives an interview answer room to think: a 1.2 s pause doesn’t end it (P9-03)', () => {
    const h = heard({ firstSpeechAt: 1_000, lastSpeechAt: 5_000 });
    expect(turnVerdict(h, 6_200, TURN_TIMING.talk)).toBe('ended');
    expect(turnVerdict(h, 6_200, TURN_TIMING.interview)).toBe('listening');
    expect(turnVerdict(h, 5_000 + TURN_TIMING.interview.pauseMs, TURN_TIMING.interview)).toBe(
      'ended',
    );
  });
});

/** Feeds a gate one level every 20 ms between two times; returns the gate. */
function feed(gate: LevelGate, from: number, to: number, level: (t: number) => number) {
  for (let t = from; t < to; t += 20) gate.push(level(t), t);
  return gate;
}

describe('speech from the microphone’s level', () => {
  it('finds speech after a moment above the noise, and when it stopped', () => {
    const gate = new LevelGate(0);
    feed(gate, 0, 1_000, () => 0.004);
    expect(gate.firstSpeechAt).toBe(null);
    feed(gate, 1_000, 1_600, () => 0.12);
    feed(gate, 1_600, 3_000, () => 0.004);
    expect(gate.firstSpeechAt).toBeGreaterThanOrEqual(1_000 + SPEECH_ONSET_MS);
    expect(gate.firstSpeechAt).toBeLessThan(1_000 + SPEECH_ONSET_MS + 40);
    expect(gate.lastSpeechAt).toBe(1_580);
    expect(turnVerdict(gate, 3_000, TURN_TIMING.talk)).toBe('ended');
  });

  it('a click or a cough is not speech', () => {
    const gate = new LevelGate(0);
    feed(gate, 0, 500, () => 0.004);
    feed(gate, 500, 560, () => 0.5);
    feed(gate, 560, 2_000, () => 0.004);
    expect(gate.firstSpeechAt).toBe(null);
  });

  it('a quiet room never adds up to speech', () => {
    const gate = new LevelGate(0);
    feed(gate, 0, 30_000, (t) => MIN_SPEECH_LEVEL * 0.9 * (0.5 + 0.5 * Math.sin(t / 700)));
    expect(gate.firstSpeechAt).toBe(null);
    expect(turnVerdict(gate, 30_000, TURN_TIMING.talk)).toBe('idle');
  });

  it('learns a noisy room: its hum isn’t speech, a voice over it is', () => {
    const gate = new LevelGate(0);
    feed(gate, 0, 3_000, () => 0.04);
    expect(gate.firstSpeechAt).toBe(null);
    feed(gate, 3_000, 3_800, () => 0.25);
    expect(gate.firstSpeechAt).not.toBe(null);
  });

  it('carries on through the softer syllables of a sentence', () => {
    const gate = new LevelGate(0);
    feed(gate, 0, 500, () => 0.004);
    feed(gate, 500, 2_500, (t) => (Math.floor(t / 100) % 2 === 0 ? 0.12 : 0.03));
    expect(gate.lastSpeechAt).toBeGreaterThanOrEqual(2_400);
  });
});
