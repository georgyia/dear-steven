import { describe, expect, it } from 'vitest';
import { locateQuote, normalise } from './quotes.ts';

const PASSAGE =
  "I quit drinking when I was 21. I believe that I wouldn't be able to accomplish all the things that I wanted to accomplish if I was drinking. And, you know, I saw a lot of family members where drinking had been detrimental to their life.";

describe('locateQuote', () => {
  it('finds an exact quote and returns the stored span, verbatim', () => {
    const span = locateQuote(PASSAGE, 'I quit drinking when I was 21.');
    expect(span).toMatchObject({ exact: true, coverage: 1, start: 0 });
    expect(span?.text).toBe('I quit drinking when I was 21.');
  });

  it('ignores case, curly quotes and punctuation differences, but returns the stored text', () => {
    const span = locateQuote(
      PASSAGE,
      'i believe that i wouldn’t be able to accomplish all the things',
    );
    expect(span?.exact).toBe(true);
    expect(span?.text).toBe("I believe that I wouldn't be able to accomplish all the things");
    expect(PASSAGE.slice(span?.start, span?.end)).toBe(span?.text);
  });

  it('accepts a near-verbatim quote that covers ≥ 85% of the stored words', () => {
    const span = locateQuote(
      PASSAGE,
      'I saw a lot of family members where drinking had been detrimental to their lives',
    );
    expect(span?.exact).toBe(false);
    expect(span?.coverage).toBeGreaterThanOrEqual(0.85);
    expect(span?.text.startsWith('I saw a lot of family members')).toBe(true);
    expect(PASSAGE.includes(span?.text ?? '∅')).toBe(true);
  });

  it('rejects an invented or heavily paraphrased quote', () => {
    expect(
      locateQuote(PASSAGE, 'Alcohol is the enemy of every entrepreneur I have ever met.'),
    ).toBe(null);
    expect(locateQuote(PASSAGE, 'I stopped drinking at 21 because it would hold me back')).toBe(
      null,
    );
  });

  it('rejects quotes too short to be meaningful', () => {
    expect(locateQuote(PASSAGE, 'I quit')).toBe(null);
  });
});

describe('normalise', () => {
  it('maps every normalised character back to the original', () => {
    const n = normalise('He said: “Don’t — stop!”');
    expect(n.text).toBe('he said dont stop');
    expect(n.map).toHaveLength(n.text.length);
  });
});
