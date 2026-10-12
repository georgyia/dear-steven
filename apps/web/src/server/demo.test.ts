import type { AskEvent } from '@dear-steven/core/schema';
import { describe, expect, it } from 'vitest';
import { streamDemoAnswer } from './demo';

const instant = async () => undefined;

const collect = async (
  question: string,
  signal = new AbortController().signal,
  uiLocale?: 'en' | 'de',
) => {
  const events: AskEvent[] = [];
  for await (const e of streamDemoAnswer({ question, uiLocale }, signal, instant)) events.push(e);
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

  it('thinks in the interface language and answers in the question’s', async () => {
    const events = await collect('Why do I procrastinate?', undefined, 'de');
    expect(events[0]).toMatchObject({ type: 'status', message: 'Durchsuche 3 Gespräche…' });
    const final = events.at(-1);
    expect(final?.type === 'final' && final.answer.language).toBe('en');
  });

  it('answers a German question in German, quotes still verbatim with a translation', async () => {
    const events = await collect(
      'Ich schiebe ein wichtiges Projekt seit Wochen vor mir her. Wie würdest du es angehen?',
    );
    const final = events.at(-1);
    if (final?.type !== 'final') throw new Error('no final answer');
    expect(final.answer.language).toBe('de');
    expect(final.answer.spoken).toMatch(/^Ja — beim Aufschieben/);
    const quote = final.answer.blocks.find((b) => b.kind === 'quote');
    expect(quote).toMatchObject({
      text: 'you don’t procrastinate on the work. You procrastinate on the feeling the work gives you.',
      translation:
        'Du schiebst nicht die Arbeit auf. Du schiebst das Gefühl auf, das dir die Arbeit gibt.',
    });
  });
});
