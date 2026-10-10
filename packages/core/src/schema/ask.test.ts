import { describe, expect, it } from 'vitest';
import { SpeechRequestSchema, STOCK_VOICES } from './ask.ts';

describe('SpeechRequestSchema', () => {
  it('takes a stock voice, or none for the server default', () => {
    expect(SpeechRequestSchema.parse({ text: 'Hi', voice: 'coral' }).voice).toBe('coral');
    expect(SpeechRequestSchema.parse({ text: 'Hi' }).voice).toBeUndefined();
    expect(STOCK_VOICES).toContain('ash');
  });

  it('never accepts a custom or cloned voice', () => {
    expect(SpeechRequestSchema.safeParse({ text: 'Hi', voice: 'voice_1234' }).success).toBe(false);
    expect(SpeechRequestSchema.safeParse({ text: 'Hi', voice: { id: 'voice_1234' } }).success).toBe(
      false,
    );
    expect(SpeechRequestSchema.safeParse({ text: 'Hi', extra: true }).success).toBe(false);
  });
});
