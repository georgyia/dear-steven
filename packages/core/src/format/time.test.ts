import { describe, expect, it } from 'vitest';
import {
  episodeLabel,
  formatDate,
  formatMoment,
  formatTimestamp,
  spokenTimestamp,
} from './time.ts';

describe('formatTimestamp', () => {
  it('formats minutes and seconds', () => {
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(32 * 60_000 + 14_999)).toBe('32:14');
  });
  it('adds hours past the hour', () => {
    expect(formatTimestamp(3_723_000)).toBe('1:02:03');
  });
  it('clamps negatives to zero', () => {
    expect(formatTimestamp(-5)).toBe('0:00');
  });
});

describe('formatMoment', () => {
  it('marks estimated moments and hides unknown ones', () => {
    expect(formatMoment(1_934_000, 'exact')).toBe('32:14');
    expect(formatMoment(1_934_000, 'estimated')).toBe('≈ 32:14');
    expect(formatMoment(1_934_000, 'unknown')).toBe('');
  });
});

describe('spokenTimestamp', () => {
  it('reads naturally', () => {
    expect(spokenTimestamp(1_934_000)).toBe('32 minutes 14 seconds');
    expect(spokenTimestamp(3_600_000)).toBe('1 hour');
    expect(spokenTimestamp(0)).toBe('0 seconds');
  });
});

describe('formatDate', () => {
  it('formats in UTC', () => {
    expect(formatDate('2026-10-08T23:30:00Z')).toBe('8 Oct 2026');
    expect(formatDate('nope')).toBe('');
  });
});

describe('episodeLabel', () => {
  it('prefers the first guest, else a trimmed title head', () => {
    expect(episodeLabel({ guestNames: ['Dana White'], title: 'x' })).toBe('Dana White');
    expect(
      episodeLabel({ guestNames: [], title: 'The Procrastination Doctor: Why You Delay' }),
    ).toBe('The Procrastination Doctor');
  });
});
