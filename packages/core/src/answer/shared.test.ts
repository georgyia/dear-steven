import { describe, expect, it } from 'vitest';
import type { ResolvedBlock } from '../schema/index.ts';
import { stillSourced } from './shared.ts';

const PASSAGE =
  'We delay the things that make us feel something unpleasant, far more than hard things.';
const quote = (text: string, citationId = 'c1'): ResolvedBlock => ({
  kind: 'quote',
  citationId,
  lead: null,
  text,
  translation: null,
});
const paragraph: ResolvedBlock = {
  kind: 'paragraph',
  segments: [
    { text: 'Mostly it is a feeling.', attribution: 'synthesis', citationIds: ['c1', 'c2'] },
  ],
};
const answer = (blocks: ResolvedBlock[]) => ({
  blocks,
  citations: [
    { id: 'c1', passageId: 'p1' },
    { id: 'c2', passageId: 'p2' },
  ],
});
const kb = (entries: [string, string][]) => new Map(entries);

describe('stillSourced (P6-17)', () => {
  it('holds while every cited passage is stored and every quote is a span of it', () => {
    const shared = answer([paragraph, quote('make us feel something unpleasant')]);
    expect(
      stillSourced(
        shared,
        kb([
          ['p1', PASSAGE],
          ['p2', 'Another passage.'],
        ]),
      ),
    ).toBe(true);
  });

  it('fails once any cited passage is gone — even one only a paragraph cites', () => {
    const shared = answer([paragraph, quote('make us feel something unpleasant')]);
    expect(stillSourced(shared, kb([['p1', PASSAGE]]))).toBe(false);
  });

  it('fails when a passage was re-transcribed and no longer holds the quote', () => {
    const shared = answer([quote('make us feel something unpleasant')]);
    const rewritten = kb([
      ['p1', 'We put off what feels bad.'],
      ['p2', 'Another passage.'],
    ]);
    expect(stillSourced(shared, rewritten)).toBe(false);
  });

  it('fails on a quote whose citation is missing from the answer', () => {
    const shared = answer([quote('make us feel something unpleasant', 'c9')]);
    expect(
      stillSourced(
        shared,
        kb([
          ['p1', PASSAGE],
          ['p2', PASSAGE],
        ]),
      ),
    ).toBe(false);
  });
});
