import { describe, expect, it } from 'vitest';
import type { ModelAnswer } from '../schema/index.ts';
import { BlockStream } from './stream.ts';

const answer: ModelAnswer = {
  language: 'en',
  mode: 'grounded',
  blocks: [
    { kind: 'paragraph', segments: [{ text: 'First.', attribution: 'synthesis', citations: [] }] },
    {
      kind: 'quote',
      passageId: 'p1',
      quote: 'A line from the transcript itself.',
      lead: null,
      translation: null,
    },
    { kind: 'takeaway', segments: [{ text: 'Do it.', attribution: 'synthesis', citations: [] }] },
  ],
  evidence: [{ passageId: 'p1', why: 'Because.' }],
  spoken: 'Short.',
  caveats: [],
};

const chunks = (text: string, size: number) =>
  Array.from({ length: Math.ceil(text.length / size) }, (_, i) =>
    text.slice(i * size, (i + 1) * size),
  );

describe('BlockStream', () => {
  it.each([1, 7, 64])(
    'reports each block exactly once, in order, as it completes (chunk size %i)',
    (size) => {
      const s = new BlockStream();
      const started: number[] = [];
      const completed: number[] = [];
      let completedBeforeEvidence = 0;
      for (const delta of chunks(JSON.stringify(answer), size)) {
        const r = s.push(delta);
        started.push(...r.started);
        completed.push(...r.completed.map((c) => c.index));
        for (const c of r.completed) expect(c.block).toEqual(answer.blocks[c.index]);
        if (!s.text.includes('"evidence"')) completedBeforeEvidence = completed.length;
      }
      expect(started).toEqual([0, 1, 2]);
      expect(completed).toEqual([0, 1, 2]);
      // The first two blocks are released while the model is still writing.
      expect(completedBeforeEvidence).toBeGreaterThanOrEqual(2);
      expect(s.finish()).toEqual(answer);
    },
  );

  it('flags a malformed block instead of throwing', () => {
    const s = new BlockStream();
    const r = s.push('{"mode":"grounded","blocks":[{"kind":"nonsense"},{"kind":"paragraph"');
    expect(r.completed).toEqual([{ index: 0, block: null }]);
  });

  it('throws on finish when the model output is not a valid answer', () => {
    const s = new BlockStream();
    s.push('{"mode":"grounded","blocks":[]}');
    expect(() => s.finish()).toThrow();
  });
});
