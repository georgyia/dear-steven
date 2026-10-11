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

  it('reads naturally in German (P6-02)', () => {
    expect(spokenTimestamp(1_934_000, 'de')).toBe('32 Minuten 14 Sekunden');
    expect(spokenTimestamp(3_661_000, 'de')).toBe('1 Stunde 1 Minute 1 Sekunde');
  });
});

describe('formatDate', () => {
  it('formats in UTC', () => {
    expect(formatDate('2026-10-08T23:30:00Z')).toBe('8 Oct 2026');
    expect(formatDate('nope')).toBe('');
  });

  it('formats German dates the German way (P6-02)', () => {
    expect(formatDate('2026-10-08T23:30:00Z', 'de')).toBe('8. Okt. 2026');
    expect(formatDate('2026-03-01T00:00:00Z', 'de')).toBe('1. März 2026');
    expect(formatDate('2026-09-01T00:00:00Z', 'en')).toBe('1 Sep 2026');
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
