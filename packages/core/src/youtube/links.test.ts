import { describe, expect, it } from 'vitest';
import { isYouTubeVideoId, resolveMoment } from './links.ts';

describe('resolveMoment', () => {
  it('links to the exact second when alignment is exact', () => {
    const m = resolveMoment({
      videoId: 'dQw4w9WgXcQ',
      startMs: 32 * 60_000 + 14_900,
      offsetMs: 0,
      alignment: 'exact',
    });
    expect(m.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1934s');
    expect(m.embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=1934');
    expect(m.state).toBe('exact');
    expect(m.ms).toBe(1_934_900);
  });

  it('applies the video offset and marks estimated alignment', () => {
    const m = resolveMoment({
      videoId: 'dQw4w9WgXcQ',
      startMs: 60_000,
      offsetMs: 12_000,
      alignment: 'estimated',
    });
    expect(m.url).toContain('&t=72s');
    expect(m.state).toBe('estimated');
  });

  it('never produces a negative timestamp', () => {
    const m = resolveMoment({
      videoId: 'dQw4w9WgXcQ',
      startMs: 2_000,
      offsetMs: -10_000,
      alignment: 'estimated',
    });
    expect(m.url).toContain('&t=0s');
    expect(m.ms).toBe(0);
  });

  it('omits t entirely when alignment is unknown', () => {
    const m = resolveMoment({
      videoId: 'dQw4w9WgXcQ',
      startMs: 90_000,
      offsetMs: 0,
      alignment: 'unknown',
    });
    expect(m.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(m.url).not.toContain('t=');
    expect(m.state).toBe('unknown');
  });

  it('returns no link without a valid video id', () => {
    expect(resolveMoment({ videoId: null, startMs: 1, offsetMs: 0, alignment: 'exact' }).url).toBe(
      null,
    );
    const injected = resolveMoment({
      videoId: 'abc"><script>',
      startMs: 1,
      offsetMs: 0,
      alignment: 'exact',
    });
    expect(injected.url).toBe(null);
    expect(injected.embedUrl).toBe(null);
  });
});

describe('isYouTubeVideoId', () => {
  it('accepts 11-character ids only', () => {
    expect(isYouTubeVideoId('dQw4w9WgXcQ')).toBe(true);
    expect(isYouTubeVideoId('dQw4w9WgXc')).toBe(false);
    expect(isYouTubeVideoId('dQw4w9WgXcQ&t=1')).toBe(false);
  });
});
