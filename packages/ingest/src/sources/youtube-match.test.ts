import type { Episode } from '@dear-steven/core/schema';
import { offsetAt } from '@dear-steven/core/youtube';
import { describe, expect, it } from 'vitest';
import { RECORDED_EPISODES, RECORDED_VIDEOS } from './youtube-match.fixture.ts';
import {
  chapterAlignment,
  estimateOffset,
  guestInTitle,
  matchEpisodes,
  parseChapters,
  parseIsoDuration,
  sharedChapters,
  titleSimilarity,
  type YouTubeVideo,
} from './youtube-match.ts';

const episode = (fields: Partial<Episode> & Pick<Episode, 'id' | 'title' | 'publishedAt'>) =>
  ({
    sourceGuid: fields.id,
    description: '',
    durationMs: null,
    episodeType: 'full',
    guestNames: [],
    audioUrl: null,
    transcriptUrl: null,
    transcriptSource: null,
    transcriptStatus: 'none',
    youtubeVideoId: null,
    youtubeOffsetMs: 0,
    youtubeOffsetSteps: [],
    youtubeAlignment: 'unknown',
    summary: null,
    indexedAt: null,
    ...fields,
  }) satisfies Episode;

const video = (fields: Partial<YouTubeVideo> & Pick<YouTubeVideo, 'videoId'>): YouTubeVideo => ({
  title: '',
  publishedAt: '2026-10-05T06:00:00Z',
  durationMs: 5_300_000,
  description: '',
  ...fields,
});

const recordedEpisodes = RECORDED_EPISODES.map((e) =>
  episode({ ...e, guestNames: [...e.guestNames] }),
);
const recordedVideos: YouTubeVideo[] = RECORDED_VIDEOS.map((v) => ({ ...v }));

describe('parseIsoDuration', () => {
  it.each([
    ['PT1H28M24S', 5_304_000],
    ['PT59S', 59_000],
    ['PT2H', 7_200_000],
    ['P1DT1S', 86_401_000],
    ['nonsense', null],
  ])('%s', (iso, ms) => expect(parseIsoDuration(iso)).toBe(ms));
});

describe('parseChapters', () => {
  const titles = (text: string) => parseChapters(text).map((c) => [c.ms / 1000, c.title]);

  it('reads one chapter per line, with or without hours or brackets', () => {
    expect(
      titles('Prose first.\n\n00:00 Intro\n02:38 How Childhood Shaped You\n1:05:34 Adoption'),
    ).toEqual([
      [0, 'intro'],
      [158, 'how childhood shaped you'],
      [3934, 'adoption'],
    ]);
    expect(titles('[00:00] Intro  \n[02:45] My Mission  \n[03:36] Fast Learning')).toEqual([
      [0, 'intro'],
      [165, 'my mission'],
      [216, 'fast learning'],
    ]);
  });

  it('reads a list whose line breaks the feed lost', () => {
    expect(
      titles('Chapters00:00:00 Intro00:02:12 How To Use AI00:04:40 Where Will Value Come From?'),
    ).toEqual([
      [0, 'intro'],
      [132, 'how to use ai'],
      [280, 'where will value come from'],
    ]);
  });

  it('starts at 0:00 and stops where the times stop going forwards', () => {
    expect(
      titles('We met at 9:30 to talk.\n00:00 Intro\n05:00 One\n10:00 Two\n03:00 Not a chapter'),
    ).toEqual([
      [0, 'intro'],
      [300, 'one'],
      [600, 'two'],
    ]);
  });

  it('needs at least three chapters', () => {
    expect(parseChapters('00:00 Intro\n05:00 One')).toEqual([]);
    expect(parseChapters('Recorded at 10:30 in London')).toEqual([]);
  });
});

describe('sharedChapters', () => {
  it('pairs reworded titles one-to-one, skipping the opener and repeated titles', () => {
    const podcast = parseChapters(
      '00:00 Intro\n02:00 Why Empathy Is Missing\n05:00 Ads\n08:00 Ads\n10:00 The End',
    );
    const video = parseChapters(
      '00:00 Intro\n02:20 Why Empathy Is Missing In Politics\n10:20 The End\n12:00 Ads',
    );
    expect(sharedChapters(podcast, video)).toEqual([
      { podcastMs: 120_000, deltaMs: 20_000 },
      { podcastMs: 600_000, deltaMs: 20_000 },
    ]);
  });
});

describe('chapterAlignment', () => {
  const list = (pairs: [number, string][]) => pairs.map(([s, t]) => ({ ms: s * 1000, title: t }));
  const podcast = list([
    [0, 'intro'],
    [100, 'one'],
    [200, 'two'],
    [300, 'three'],
    [400, 'four'],
    [500, 'five'],
    [600, 'six'],
  ]);

  it('measures one offset when every shared chapter moves together', () => {
    const video = podcast.map((c) => ({ ...c, ms: c.ms ? c.ms + 20_000 : 0 }));
    expect(chapterAlignment(podcast, video)).toEqual({ offsetMs: 20_000, steps: [] });
  });

  it('finds where an edit only one side has changes the offset mid-episode', () => {
    const video = podcast.map((c) => ({
      ...c,
      ms: c.ms === 0 ? 0 : c.ms + (c.ms < 400_000 ? -11_000 : 49_000),
    }));
    expect(chapterAlignment(podcast, video)).toEqual({
      offsetMs: -11_000,
      steps: [{ fromMs: 400_000, offsetMs: 49_000 }],
    });
  });

  it('ignores a lone mis-paired chapter, but refuses lists that do not agree', () => {
    const oneOff = podcast.map((c) => ({
      ...c,
      ms: c.ms === 0 ? 0 : c.ms + (c.title === 'three' ? 300_000 : 20_000),
    }));
    // one of six disagreeing is under the one-in-ten allowance only with more chapters, so this
    // stays an estimate; ten chapters with one stray pass
    expect(chapterAlignment(podcast, oneOff)).toBeNull();
    const many = list(
      Array.from({ length: 11 }, (_, i) => [i * 100, `chapter ${i}`] as [number, string]),
    );
    const stray = many.map((c) => ({
      ...c,
      ms: c.ms === 0 ? 0 : c.ms + (c.title === 'chapter 5' ? 300_000 : 20_000),
    }));
    expect(chapterAlignment(many, stray)).toEqual({ offsetMs: 20_000, steps: [] });
    const scattered = podcast.map((c, i) => ({ ...c, ms: c.ms === 0 ? 0 : c.ms + i * 7_000 }));
    expect(chapterAlignment(podcast, scattered)).toBeNull();
  });
});

describe('guestInTitle and titleSimilarity', () => {
  it('finds the guest by surname, despite honorifics', () => {
    expect(guestInTitle(['Prof Brian Greene'], 'Professor Brian Greene: The Threat of AI')).toBe(
      true,
    );
    expect(guestInTitle(['Tim Ferriss'], 'The Hidden Nerve That Controls Trauma')).toBe(false);
    expect(guestInTitle([], 'Anything')).toBe(false);
  });
  it('scores unrelated titles low', () => {
    expect(titleSimilarity('Dana White: Build It', 'The Sleep Scientist: Wake Up')).toBeLessThan(
      0.1,
    );
  });
});

describe('matchEpisodes on recorded data (2026-10-10)', () => {
  const result = matchEpisodes(recordedEpisodes, recordedVideos);
  const of = (id: string) => result.matches.find((m) => m.episodeId === id);

  it('pairs every conversation with its own video, never a Short', () => {
    expect(Object.fromEntries(result.matches.map((m) => [m.episodeId, m.videoId]))).toEqual({
      ep_vance: '5cKDs7bIGPE',
      ep_hormozi: 'HwmwyBgzj8c',
      ep_ferriss: 'GFyijjy1KdU',
      ep_retitled: 'Y43T7VQGtOs',
      ep_bellew: 'Kj5yp0PrfqA',
      ep_grylls: 'V6mZJRb9MZY',
    });
  });

  it('leaves a podcast-only compilation unmatched', () => {
    expect(result.unmatched).toEqual(['ep_moment']);
  });

  it('matches a retitled video by date, running time and shared chapters alone', () => {
    expect(of('ep_retitled')).toMatchObject({
      alignment: 'exact',
      offsetMs: 20_000, // podcast 02:05 "We're on the Road to Civil Unrest", video 02:25
      evidence: { titleSimilarity: 0, guestInTitle: false },
    });
  });

  it('measures the offset on chapters, whatever format each side writes them in', () => {
    expect(of('ep_vance')).toMatchObject({ alignment: 'exact', offsetMs: 20_000 }); // 02:38 → 02:58
    expect(of('ep_hormozi')).toMatchObject({ alignment: 'exact', offsetMs: 20_000 }); // run-together list
    expect(of('ep_ferriss')).toMatchObject({ alignment: 'exact', offsetMs: -13_000 }); // [03:36] → 03:23
  });

  it('calls a match without chapters an estimate', () => {
    expect(of('ep_bellew')).toMatchObject({ alignment: 'estimated', offsetSteps: [] });
    expect(of('ep_grylls')?.alignment).toBe('estimated');
  });

  it('lists matches newest first and is deterministic', () => {
    expect(result.matches.map((m) => m.episodeId)).toEqual([
      'ep_retitled',
      'ep_hormozi',
      'ep_vance',
      'ep_ferriss',
      'ep_bellew',
      'ep_grylls',
    ]);
    expect(matchEpisodes([...recordedEpisodes].reverse(), [...recordedVideos].reverse())).toEqual(
      result,
    );
  });
});

describe('matchEpisodes', () => {
  const dana = episode({
    id: 'ep_dana',
    title: 'Dana White: This Generation Thinks You Can Build A Business From Home',
    publishedAt: '2026-10-05T05:00:00Z',
    durationMs: 5_304_000,
    guestNames: ['Dana White'],
  });

  it('refuses a similar title published outside the four-day window', () => {
    const late = video({
      videoId: 'ccccccccccc',
      title: dana.title,
      publishedAt: '2026-10-10T06:00:00Z',
    });
    expect(matchEpisodes([dana], [late]).matches).toEqual([]);
  });

  it('never assigns one video twice, and the better fit keeps it', () => {
    const clip = episode({ ...dana, id: 'ep_dana_rerun', durationMs: 5_900_000 });
    const only = video({ videoId: 'aaaaaaaaaaa', title: dana.title, durationMs: 5_306_000 });
    const { matches, unmatched } = matchEpisodes([clip, dana], [only]);
    expect(matches.map((m) => m.episodeId)).toEqual(['ep_dana']);
    expect(unmatched).toEqual(['ep_dana_rerun']);
  });

  it('leaves videos already linked elsewhere alone', () => {
    const only = video({ videoId: 'aaaaaaaaaaa', title: dana.title });
    expect(matchEpisodes([dana], [only], { taken: new Set(['aaaaaaaaaaa']) }).matches).toEqual([]);
  });

  it('skips bonus episodes and trailers', () => {
    const trailer = episode({ ...dana, episodeType: 'trailer' });
    const only = video({ videoId: 'aaaaaaaaaaa', title: dana.title });
    expect(matchEpisodes([trailer], [only])).toEqual({ matches: [], unmatched: [] });
  });
});

describe('estimateOffset', () => {
  const ep = episode({
    id: 'e',
    title: 'T',
    publishedAt: '2025-06-01T05:00:00Z',
    durationMs: 6_000_000,
  });
  const nearby = [-13_000, -12_000, -15_000].map((offsetMs, i) => ({
    publishedAt: `2025-05-${10 + i}T05:00:00Z`,
    offsetMs,
  }));

  it('takes the length difference when the edits differ by seconds (the intro)', () => {
    expect(estimateOffset(ep, video({ videoId: 'v', durationMs: 6_012_000 }), nearby)).toBe(12_000);
  });

  it('otherwise takes the median measured on episodes within two months', () => {
    expect(estimateOffset(ep, video({ videoId: 'v', durationMs: 6_090_000 }), nearby)).toBe(
      -13_000,
    );
    const old = nearby.map((m) => ({ ...m, publishedAt: '2024-01-01T05:00:00Z' }));
    expect(estimateOffset(ep, video({ videoId: 'v', durationMs: 6_090_000 }), old)).toBe(0);
  });
});

describe('a measured alignment, resolved', () => {
  it('lands on each shared chapter within the two seconds chapter times allow', () => {
    for (const e of recordedEpisodes) {
      const m = matchEpisodes(recordedEpisodes, recordedVideos).matches.find(
        (x) => x.episodeId === e.id,
      );
      const v = recordedVideos.find((x) => x.videoId === m?.videoId);
      if (!m || !v || m.alignment !== 'exact') continue;
      for (const c of sharedChapters(parseChapters(e.description), parseChapters(v.description))) {
        const predicted = offsetAt({
          startMs: c.podcastMs,
          offsetMs: m.offsetMs,
          offsetSteps: m.offsetSteps,
        });
        expect(Math.abs(predicted - c.deltaMs)).toBeLessThanOrEqual(2_000);
      }
    }
  });
});
