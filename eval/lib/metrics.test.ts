import { describe, expect, it } from 'vitest';
import { median, recallAt } from './metrics.ts';

describe('recallAt', () => {
  it('hits when any expected episode is in the top k', () => {
    expect(recallAt(10, ['a', 'b', 'c'], ['c'])).toBe(true);
    expect(recallAt(2, ['a', 'b', 'c'], ['c'])).toBe(false);
    expect(recallAt(10, [], ['c'])).toBe(false);
  });
});

describe('median', () => {
  it('handles odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});
