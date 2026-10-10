import { describe, expect, it } from 'vitest';
import { decodeEntities, parseTimestamp, parseVtt } from './vtt.ts';

const SAMPLE = `﻿WEBVTT\r
\r
NOTE produced by a transcription service\r
\r
1\r
00:00:00.131 --> 00:00:02.975\r
I've already built the biggest fight brand to ever exist.\r
\r
2\r
00:00:03.175 --> 00:00:05.157 align:start position:10%\r
The UFC was purchased for <b>$2 million</b>.\r
\r
00:31.560 --> 00:33.201\r
That&#39;s what I wanted &amp; more.\r
\r
1:02:03.000 --> 1:02:04.5\r
<v Steven Bartlett>Was there anyone in a class of their own?</v>\r
`;

describe('parseTimestamp', () => {
  it('reads hh:mm:ss.ttt, mm:ss.ttt and short fractions', () => {
    expect(parseTimestamp('00:00:02.975')).toBe(2975);
    expect(parseTimestamp('31:56.5')).toBe(1_916_500);
    expect(parseTimestamp('1:02:03,040')).toBe(3_723_040);
  });
});

describe('parseVtt', () => {
  it('parses cues, strips tags, decodes entities and keeps voice labels', () => {
    const cues = parseVtt(SAMPLE);
    expect(cues).toHaveLength(4);
    expect(cues[0]).toEqual({
      startMs: 131,
      endMs: 2975,
      text: "I've already built the biggest fight brand to ever exist.",
      voice: null,
    });
    expect(cues[1]?.text).toBe('The UFC was purchased for $2 million.');
    expect(cues[2]).toMatchObject({ startMs: 31_560, text: "That's what I wanted & more." });
    expect(cues[3]).toMatchObject({
      startMs: 3_723_000,
      endMs: 3_724_500,
      voice: 'Steven Bartlett',
    });
  });

  it('merges a cue repeated back-to-back (rolling captions)', () => {
    const cues = parseVtt(
      'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nSame line\n\n00:00:02.100 --> 00:00:03.000\nSame line\n',
    );
    expect(cues).toEqual([{ startMs: 1000, endMs: 3000, text: 'Same line', voice: null }]);
  });

  it('rejects files that are not WebVTT', () => {
    expect(() => parseVtt('1\n00:00:01,000 --> 00:00:02,000\nSRT')).toThrow(/WEBVTT/);
  });

  it('skips empty cues and malformed timing lines', () => {
    const cues = parseVtt(
      'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<i></i>\n\nnot --> timing\nx\n',
    );
    expect(cues).toEqual([]);
  });
});

describe('decodeEntities', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('&quot;Hi&quot; &#8217; &#x2014; &nbsp;')).toBe('"Hi" ’ —  ');
  });
});
