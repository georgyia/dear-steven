import { describe, expect, it } from 'vitest';
import type { ResolvedBlock } from '../schema/index.ts';
import { speakable, speechPieces } from './speech.ts';

describe('what is said aloud (P9-01)', () => {
  it('is a paragraph’s or takeaway’s own text, segment by segment', () => {
    const paragraph: ResolvedBlock = {
      kind: 'paragraph',
      segments: [
        { text: 'Honestly? Start small. ', attribution: 'synthesis', citationIds: [] },
        {
          text: ' In one conversation  it came up twice.',
          attribution: 'episode',
          citationIds: ['c1'],
        },
        { text: '', attribution: 'synthesis', citationIds: [] },
      ],
    };
    expect(speakable(paragraph)).toBe(
      'Honestly? Start small. In one conversation it came up twice.',
    );
    expect(speakable({ ...paragraph, kind: 'takeaway' })).toBe(speakable(paragraph));
  });

  it('is a quote’s lead and then its stored words, never the translation', () => {
    const quote: ResolvedBlock = {
      kind: 'quote',
      citationId: 'c1',
      lead: 'As it was put to me:',
      text: 'you procrastinate on the feeling the work gives you.',
      translation: 'du schiebst das Gefühl auf, das dir die Arbeit gibt.',
    };
    expect(speakable(quote)).toBe(
      'As it was put to me: you procrastinate on the feeling the work gives you.',
    );
    expect(speakable({ ...quote, lead: null })).toBe(quote.text);
  });
});

describe('speech in pieces', () => {
  it('leaves text that fits alone', () => {
    expect(speechPieces('  One sentence.  ', 100)).toEqual(['One sentence.']);
    expect(speechPieces('', 100)).toEqual([]);
  });

  it('splits after a sentence, else after a word, else anywhere, never over the limit', () => {
    const text = 'First sentence here. Second one follows! Third goes on and on';
    const pieces = speechPieces(text, 30);
    expect(pieces[0]).toBe('First sentence here.');
    expect(pieces.every((p) => p.length <= 30)).toBe(true);
    expect(pieces.join(' ')).toBe(text);

    expect(speechPieces('aaaa bbbb cccc', 9)).toEqual(['aaaa bbbb', 'cccc']);
    expect(speechPieces('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
  });
});
