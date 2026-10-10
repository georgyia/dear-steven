import type { Episode } from '@dear-steven/core/schema';
import { describe, expect, it } from 'vitest';
import { matchEpisodes, parseIsoDuration, titleSimilarity } from './youtube-match.ts';

const episode = (
  id: string,
  title: string,
  publishedAt: string,
  durationMs: number | null,
): Episode => ({
  id,
  sourceGuid: id,
  title,
  description: '',
  publishedAt,
  durationMs,
  episodeType: 'full',
  guestNames: [],
  audioUrl: null,
  transcriptUrl: null,
  transcriptSource: null,
  transcriptStatus: 'none',
  youtubeVideoId: null,
  youtubeOffsetMs: 0,
  youtubeAlignment: 'unknown',
  summary: null,
  indexedAt: null,
});

describe('parseIsoDuration', () => {
  it.each([
    ['PT1H28M24S', 5_304_000],
    ['PT59S', 59_000],
    ['PT2H', 7_200_000],
    ['P1DT1S', 86_401_000],
    ['nonsense', null],
  ])('%s', (iso, ms) => expect(parseIsoDuration(iso)).toBe(ms));
});

describe('matchEpisodes', () => {
  const dana = episode(
    'ep_dana',
    'Dana White: This Generation Thinks You Can Build A Business From Home, It&#39;s Impossible!',
    '2026-10-05T05:00:00Z',
    5_304_000,
  );
  const rubin = episode(
    'ep_rubin',
    'Rick Rubin: What Jay-Z Did in 30 Minutes Left Me Speechless!',
    '2026-09-21T05:00:00Z',
    9_985_000,
  );

  it('matches by title within the date window and marks alignment honestly', () => {
    const matches = matchEpisodes(
      [dana, rubin],
      [
        {
          videoId: 'aaaaaaaaaaa',
          title:
            "Dana White: This Generation Thinks You Can Build A Business From Home, It's Impossible!",
          publishedAt: '2026-10-05T06:00:00Z',
          durationMs: 5_306_000,
        },
        {
          videoId: 'bbbbbbbbbbb',
          title: 'Rick Rubin: What Jay-Z Did In 30 Minutes Left Me Speechless',
          publishedAt: '2026-09-21T06:00:00Z',
          durationMs: 10_100_000,
        },
      ],
    );
    expect(matches).toEqual([
      expect.objectContaining({
        episodeId: 'ep_dana',
        videoId: 'aaaaaaaaaaa',
        alignment: 'exact',
        offsetMs: 0,
      }),
      expect.objectContaining({
        episodeId: 'ep_rubin',
        videoId: 'bbbbbbbbbbb',
        alignment: 'estimated',
      }),
    ]);
  });

  it('refuses a similar title published weeks apart', () => {
    const matches = matchEpisodes(
      [dana],
      [
        {
          videoId: 'ccccccccccc',
          title: dana.title,
          publishedAt: '2026-08-01T06:00:00Z',
          durationMs: 5_304_000,
        },
      ],
    );
    expect(matches).toEqual([]);
  });

  it('never assigns one video to two episodes', () => {
    const twin = { ...dana, id: 'ep_dana_clip' };
    const matches = matchEpisodes(
      [dana, twin],
      [
        {
          videoId: 'aaaaaaaaaaa',
          title: dana.title,
          publishedAt: '2026-10-05T06:00:00Z',
          durationMs: 5_304_000,
        },
      ],
    );
    expect(matches).toHaveLength(1);
  });

  it('scores unrelated titles low', () => {
    expect(titleSimilarity('Dana White: Build It', 'The Sleep Scientist: Wake Up')).toBeLessThan(
      0.1,
    );
  });
});
