import { describe, expect, it } from 'vitest';
import { interviewArc } from './arc.ts';

describe('interviewArc (P7-06)', () => {
  it('runs from opening to closing, with every stage once at the default length', () => {
    expect(interviewArc()).toEqual([
      'opening',
      'story',
      'turning-point',
      'depth',
      'challenge',
      'advice',
      'closing',
    ]);
  });

  it('keeps 6 to 10 questions, always opening first, advice then closing last', () => {
    for (const n of [1, 6, 7, 8, 9, 10, 40]) {
      const arc = interviewArc(n);
      expect(arc.length).toBe(Math.min(10, Math.max(6, n)));
      expect(arc[0]).toBe('opening');
      expect(arc.slice(-2)).toEqual(['advice', 'closing']);
    }
    expect(interviewArc(6)).not.toContain('challenge');
    expect(interviewArc(8).filter((s) => s === 'story')).toHaveLength(2);
  });
});
