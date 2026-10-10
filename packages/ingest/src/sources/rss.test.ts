import { describe, expect, it } from 'vitest';
import { parseFeed, parseItunesDuration } from './rss.ts';

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel><title>Show</title>
<item>
  <title>Dana White: This Generation Thinks You Can Build A Business From Home, It&#39;s Impossible!</title>
  <description><![CDATA[<p>Dana White is the CEO of the UFC.</p>]]></description>
  <guid isPermaLink="false">flightcast:01M26N4N40D24TJPZ6V4N7JMTY</guid>
  <pubDate>Mon, 05 Oct 2026 05:00:00 -0000</pubDate>
  <enclosure url="https://example.test/dana.mp3" length="0" type="audio/mpeg"></enclosure>
  <itunes:episodeType>full</itunes:episodeType>
  <itunes:duration>5304</itunes:duration>
  <podcast:transcript url="https://example.test/dana.srt" type="application/x-subrip"></podcast:transcript>
  <podcast:transcript url="https://example.test/dana.vtt" type="text/vtt" language="en" rel="captions"></podcast:transcript>
</item>
<item>
  <title>Most Replayed Moment: AI Is Changing How Teams Work Forever</title>
  <guid isPermaLink="false">flightcast:01M1KG7RQ525JTCTET05G29VH6</guid>
  <pubDate>Fri, 09 Oct 2026 05:00:00 -0000</pubDate>
  <enclosure url="https://example.test/clip.mp3" length="0" type="audio/mpeg"></enclosure>
  <itunes:episodeType>bonus</itunes:episodeType>
  <itunes:duration>20:41</itunes:duration>
</item>
<item><title></title><guid>broken</guid></item>
</channel></rss>`;

describe('parseFeed', () => {
  const episodes = parseFeed(FEED);

  it('parses full episodes with guests, duration and the VTT transcript', () => {
    expect(episodes).toHaveLength(2);
    expect(episodes[0]).toEqual({
      sourceGuid: 'flightcast:01M26N4N40D24TJPZ6V4N7JMTY',
      title:
        "Dana White: This Generation Thinks You Can Build A Business From Home, It's Impossible!",
      description: 'Dana White is the CEO of the UFC.',
      publishedAt: '2026-10-05T05:00:00.000Z',
      durationMs: 5_304_000,
      episodeType: 'full',
      guestNames: ['Dana White'],
      audioUrl: 'https://example.test/dana.mp3',
      transcriptUrl: 'https://example.test/dana.vtt',
    });
  });

  it('marks bonus clips and leaves transcript empty when the feed has none', () => {
    expect(episodes[1]).toMatchObject({
      episodeType: 'bonus',
      transcriptUrl: null,
      durationMs: 1_241_000,
    });
  });

  it('rejects documents that are not RSS', () => {
    expect(() => parseFeed('<html></html>')).toThrow(/RSS/);
  });
});

describe('parseItunesDuration', () => {
  it.each([
    ['5817', 5_817_000],
    ['1:36:57', 5_817_000],
    ['96:57', 5_817_000],
    ['', null],
    ['abc', null],
  ])('%s', (raw, ms) => {
    expect(parseItunesDuration(raw)).toBe(ms);
  });
});
