import { describe, expect, it } from 'vitest';
import { httpsUrl, isYouTubeVideoId, linksAt, podcastAudioAt, resolveMoment } from './links.ts';

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

describe('podcastAudioAt', () => {
  it('adds a media fragment at the floored second, replacing any existing fragment', () => {
    expect(podcastAudioAt('https://cdn.example.test/ep.mp3?x=1', 32 * 60_000 + 14_900)).toBe(
      'https://cdn.example.test/ep.mp3?x=1#t=1934',
    );
    expect(podcastAudioAt('https://cdn.example.test/ep.mp3#old', -5)).toBe(
      'https://cdn.example.test/ep.mp3#t=0',
    );
  });

  it('refuses anything that is not https', () => {
    expect(podcastAudioAt(null, 1000)).toBe(null);
    expect(podcastAudioAt('http://cdn.example.test/ep.mp3', 1000)).toBe(null);
    expect(podcastAudioAt('javascript:alert(1)', 1000)).toBe(null);
    expect(podcastAudioAt('not a url', 1000)).toBe(null);
    expect(httpsUrl('https://cdn.example.test/a.mp3')).toBe('https://cdn.example.test/a.mp3');
  });
});

describe('resolveMoment — embeds', () => {
  it('embeds from youtube-nocookie, at the second only when the alignment is known', () => {
    const at = (alignment: 'exact' | 'estimated' | 'unknown') =>
      resolveMoment({ videoId: 'dQw4w9WgXcQ', startMs: 61_500, offsetMs: 2_000, alignment })
        .embedUrl;
    expect(at('estimated')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=63');
    expect(at('unknown')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(
      resolveMoment({ videoId: 'bad', startMs: 0, offsetMs: 0, alignment: 'exact' }).embedUrl,
    ).toBe(null);
  });
});

describe('linksAt', () => {
  it('spells out the same links resolveMoment gives', () => {
    const m = resolveMoment({
      videoId: 'dQw4w9WgXcQ',
      startMs: 61_500,
      offsetMs: 2_000,
      alignment: 'exact',
    });
    expect(linksAt('dQw4w9WgXcQ', m.ms, m.state)).toEqual({ url: m.url, embedUrl: m.embedUrl });
  });

  it('rebuilds nothing from a malformed id, and never a timestamp when timing is unknown', () => {
    expect(linksAt('javascript:alert(1)', 1000, 'exact')).toEqual({ url: null, embedUrl: null });
    expect(linksAt(null, 1000, 'exact')).toEqual({ url: null, embedUrl: null });
    expect(linksAt('dQw4w9WgXcQ', 99_000, 'unknown').url).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
  });
});
