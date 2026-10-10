import type { AskEvent } from '@dear-steven/core/schema';
import { describe, expect, it } from 'vitest';
import { streamDemoAnswer } from './demo';

const instant = async () => undefined;

const collect = async (question: string, signal = new AbortController().signal) => {
  const events: AskEvent[] = [];
  for await (const e of streamDemoAnswer(question, signal, instant)) events.push(e);
  return events;
};

describe('streamDemoAnswer', () => {
  it('speaks the same protocol as a live answer and is always marked demo', async () => {
    const events = await collect('Why do I procrastinate?');
    expect(events[0]?.type).toBe('status');
    expect(events.filter((e) => e.type === 'block.done').length).toBeGreaterThan(2);
    const final = events.at(-1);
    expect(final?.type).toBe('final');
    if (final?.type === 'final') {
      expect(final.answer.demo).toBe(true);
      expect(final.answer.episodes.every((e) => e.demo)).toBe(true);
    }
  });

  it('stops promptly when the client goes away', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const events = await collect('Why do I procrastinate?', ctrl.signal);
    expect(events.some((e) => e.type === 'final')).toBe(false);
  });
});
