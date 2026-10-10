import { describe, expect, it } from 'vitest';
import type { Segment } from '../schema/index.ts';
import { chunkSegments, contextPrefix, estimateTokens } from './chunk.ts';

const words = (n: number, w = 'word') => Array.from({ length: n }, () => w).join(' ');

/** A segment of roughly `tokens` tokens (5 chars per "word " ≈ 1.25 tokens). */
const seg = (idx: number, tokens: number, extra: Partial<Segment> = {}): Segment => ({
  idx,
  startMs: idx * 10_000,
  endMs: idx * 10_000 + 9_000,
  speaker: 'unknown',
  speakerName: null,
  attributionMethod: 'none',
  attributionConfidence: null,
  text: words(Math.round(tokens / 1.25), `w${idx}`),
  ...extra,
});

const host = (idx: number, tokens: number) =>
  seg(idx, tokens, { speaker: 'host', speakerName: 'Steven', attributionMethod: 'diarization' });
const guest = (idx: number, tokens: number) =>
  seg(idx, tokens, {
    speaker: 'guest',
    speakerName: 'Dana White',
    attributionMethod: 'diarization',
  });

describe('chunkSegments — unknown speakers (RSS VTT)', () => {
  const cues = Array.from({ length: 60 }, (_, i) => seg(i, 25));
  const passages = chunkSegments(cues);

  it('packs cues into passages within the token bounds', () => {
    expect(passages.length).toBeGreaterThan(2);
    for (const p of passages.slice(0, -1)) {
      expect(p.tokenCount).toBeGreaterThanOrEqual(350);
      expect(p.tokenCount).toBeLessThanOrEqual(560);
    }
  });

  it('covers every cue, in order, with overlap between neighbours', () => {
    expect(passages[0]?.segmentStartIdx).toBe(0);
    expect(passages[passages.length - 1]?.segmentEndIdx).toBe(59);
    for (let i = 1; i < passages.length; i += 1) {
      const prev = passages[i - 1];
      const cur = passages[i];
      expect(cur && prev && cur.segmentStartIdx <= prev.segmentEndIdx).toBe(true);
      expect(cur && prev && cur.segmentStartIdx > prev.segmentStartIdx).toBe(true);
    }
  });

  it('keeps timestamps from the first and last cue', () => {
    const p = passages[1];
    expect(p?.startMs).toBe((p?.segmentStartIdx ?? 0) * 10_000);
    expect(p?.endMs).toBe((p?.segmentEndIdx ?? 0) * 10_000 + 9_000);
    expect(p?.speakersPresent).toBe('unknown');
  });

  it('numbers passages from zero', () => {
    expect(passages.map((p) => p.idx)).toEqual(passages.map((_, i) => i));
  });
});

describe('chunkSegments — verified speakers (diarized)', () => {
  it('never splits a turn that fits, and labels mixed passages', () => {
    const segments = [
      host(0, 40),
      host(1, 40),
      guest(2, 120),
      guest(3, 120),
      host(4, 30),
      guest(5, 200),
    ];
    const passages = chunkSegments(segments);
    // The guest turn (segments 2–3) must land wholly inside one passage.
    for (const p of passages) {
      const hasTwo = p.segmentStartIdx <= 2 && p.segmentEndIdx >= 2;
      const hasThree = p.segmentStartIdx <= 3 && p.segmentEndIdx >= 3;
      expect(hasTwo).toBe(hasThree);
    }
    expect(passages[0]?.speakersPresent).toBe('mixed');
    expect(passages[0]?.text.split('\n').length).toBeGreaterThan(1);
  });

  it('splits only an over-long single turn, at segment boundaries', () => {
    const monologue = Array.from({ length: 12 }, (_, i) => guest(i, 100));
    const passages = chunkSegments(monologue);
    expect(passages.length).toBeGreaterThan(1);
    for (const p of passages) expect(p.tokenCount).toBeLessThanOrEqual(650);
    expect(passages.every((p) => p.speakersPresent === 'guest')).toBe(true);
  });

  it('folds a short tail into the previous passage', () => {
    const segments = [...Array.from({ length: 17 }, (_, i) => seg(i, 25)), seg(17, 10)];
    const passages = chunkSegments(segments);
    const last = passages[passages.length - 1];
    expect(last?.segmentEndIdx).toBe(17);
    expect(last && last.tokenCount > 100).toBe(true);
  });
});

describe('chunkSegments — edge cases', () => {
  it('returns nothing for an empty transcript', () => {
    expect(chunkSegments([])).toEqual([]);
    expect(chunkSegments([seg(0, 10, { text: '   ' })])).toEqual([]);
  });

  it('keeps a lone short transcript as one passage', () => {
    const p = chunkSegments([seg(0, 30)]);
    expect(p).toHaveLength(1);
    expect(p[0]?.tokenCount).toBe(estimateTokens(p[0]?.text ?? ''));
  });
});

describe('contextPrefix', () => {
  it('names the episode, guests and date', () => {
    expect(
      contextPrefix({
        title: 'Dana White: Build It',
        guestNames: ['Dana White'],
        publishedAt: '2026-10-05T05:00:00Z',
      }),
    ).toBe('Dana White: Build It · Dana White · 2026-10-05');
  });
});
