import { describe, expect, it } from 'vitest';
import { mapLimit } from './http.ts';

const later = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('mapLimit', () => {
  it('keeps the order, with at most `limit` in flight', async () => {
    let inFlight = 0;
    let most = 0;
    const out = await mapLimit([30, 10, 20, 5], 2, async (ms, i) => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await later(ms);
      inFlight -= 1;
      return i;
    });
    expect(out).toEqual([0, 1, 2, 3]);
    expect(most).toBe(2);
  });

  it('starts nothing after a failure, and throws it once those in flight have settled (P10-16)', async () => {
    const started: number[] = [];
    const settled: number[] = [];
    const result = mapLimit([0, 1, 2, 3, 4, 5], 2, async (i) => {
      started.push(i);
      if (i === 0) {
        await later(5);
        throw new Error('chunk 0 failed');
      }
      await later(20);
      settled.push(i);
      return i;
    });
    await expect(result).rejects.toThrow('chunk 0 failed');
    // The chunk in flight finished, and was seen, before the failure was thrown.
    expect(settled).toEqual([1]);
    await later(50);
    expect(started).toEqual([0, 1]);
  });
});
