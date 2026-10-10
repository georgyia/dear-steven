import { describe, expect, it } from 'vitest';
import type { Episode } from '../schema/index.ts';
import { episodeSummary } from './citations.ts';

const episode = (over: Partial<Episode> = {}): Episode & { passages: number } => ({
  id: 'ep_1',
  sourceGuid: 'g',
  title: 'Ada Lovelace: Episode 1',
  description: '',
  publishedAt: '2026-01-01T05:00:00Z',
  durationMs: 1,
  episodeType: 'full',
  guestNames: ['Ada Lovelace'],
  audioUrl: null,
  transcriptUrl: null,
  transcriptSource: 'rss-vtt',
  transcriptStatus: 'fetched',
  youtubeVideoId: null,
  youtubeOffsetMs: 0,
  youtubeAlignment: 'unknown',
  summary: null,
  indexedAt: '2026-01-02T00:00:00Z',
  passages: 12,
  ...over,
});

describe('episodeSummary', () => {
  it('reports RSS transcripts as unverified speakers and no video', () => {
    expect(episodeSummary(episode())).toMatchObject({
      speakers: 'unverified',
      video: 'none',
      youtubeUrl: null,
      passages: 12,
    });
  });

  it('reports diarized transcripts as verified and links the episode without a timestamp', () => {
    const s = episodeSummary(
      episode({
        transcriptSource: 'openai-diarize',
        youtubeVideoId: 'dQw4w9WgXcQ',
        youtubeAlignment: 'estimated',
      }),
    );
    expect(s.speakers).toBe('verified');
    expect(s.video).toBe('estimated');
    expect(s.youtubeUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });
});
