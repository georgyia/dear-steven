import type { Segment } from '@dear-steven/core/schema';
import { describe, expect, it } from 'vitest';
import { foreign, withoutInsertedAds } from './inserted-ads.ts';

/** Lines as they came back from the first diarized episode, downloaded from Germany (P8-12). */
const line = (
  startS: number,
  endS: number,
  text: string,
  speaker: Segment['speaker'] = 'unknown',
): Segment => ({
  idx: 0,
  startMs: startS * 1000,
  endMs: endS * 1000,
  speaker,
  speakerName: speaker === 'host' ? 'Steven Bartlett' : null,
  attributionMethod: speaker === 'unknown' ? 'none' : 'diarization',
  attributionConfidence: null,
  text,
});

const PRE_ROLL = [
  line(1, 8, 'Stell Dir einen Ort vor, an dem Du die Weite der Natur spürst.'),
  line(8, 10, 'Den Wind, der durch die Täler streicht.'),
  line(10, 14, 'Genau so natürlich und harmonisch ist unser Mineralwasser.'),
];
const POST_ROLL = [
  line(2127, 2130, 'Der Black Friday steht vor der Tür.'),
  line(2148, 2150, 'Worauf wartest du noch?'),
  line(2150, 2151, 'Starte dein Business,'),
  line(2153, 2156, 'Kostenlos starten auf shopify.com'),
];

describe('foreign', () => {
  it('spots German lines', () => {
    for (const s of [...PRE_ROLL, ...POST_ROLL.slice(0, 2)])
      expect(foreign(s.text), s.text).toBe(true);
  });

  it('keeps English, German names in it, and short replies', () => {
    for (const text of [
      'Thinking about the history of relationships, I often wonder.',
      'I spoke to Jürgen Müller about it.',
      'Yeah.',
      'No.',
      'Explain to me why.',
      'Sure.',
      'Person number two.',
    ]) {
      expect(foreign(text), text).toBe(false);
    }
  });
});

describe('withoutInsertedAds', () => {
  it('drops a pre-roll and moves the conversation back to where the feed has it', () => {
    const { segments, droppedMs } = withoutInsertedAds([
      ...PRE_ROLL,
      line(24, 32, 'Thinking about the history of relationships, I often wonder.', 'host'),
      line(32, 34, 'Or maybe they were never valid.', 'host'),
    ]);
    expect(segments.map((s) => [s.idx, s.startMs, s.endMs])).toEqual([
      [0, 1000, 9000],
      [1, 9000, 11_000],
    ]);
    expect(droppedMs).toBe(23_000);
  });

  it('drops a post-roll, lines that run on from it included, and moves nothing', () => {
    const { segments, droppedMs } = withoutInsertedAds([
      line(2113, 2117, 'What you just listened to was a most replayed moment.', 'host'),
      line(2117, 2122, 'I have linked it down below.', 'host'),
      ...POST_ROLL,
    ]);
    expect(segments.map((s) => s.text)).toEqual([
      'What you just listened to was a most replayed moment.',
      'I have linked it down below.',
    ]);
    expect(segments[1]?.endMs).toBe(2_122_000);
    expect(droppedMs).toBe(29_000);
  });

  it('closes up a mid-roll, and keeps the guest’s short replies either side', () => {
    const { segments, droppedMs } = withoutInsertedAds([
      line(600, 604, 'So what did you do first?', 'host'),
      line(604, 605, 'Yeah.', 'guest'),
      line(606, 610, 'Der Black Friday steht vor der Tür.'),
      line(610, 640, 'Mit Shopify kannst du schnell starten, noch vor den Tagen des Jahres.'),
      line(641, 642, 'No.', 'guest'),
      line(642, 650, 'I started before I felt ready.', 'guest'),
    ]);
    expect(segments.map((s) => [s.text, s.startMs])).toEqual([
      ['So what did you do first?', 600_000],
      ['Yeah.', 604_000],
      ['No.', 606_000],
      ['I started before I felt ready.', 607_000],
    ]);
    expect(droppedMs).toBe(35_000);
    expect(segments.map((s) => s.idx)).toEqual([0, 1, 2, 3]);
  });

  it('never counts the host’s lines as running on from an ad, and leaves English alone', () => {
    const host = [
      line(0, 4, 'Starte dein Business,', 'host'),
      line(4, 6, 'Worauf wartest du noch?'),
    ];
    expect(withoutInsertedAds(host).segments.map((s) => s.speaker)).toEqual(['host']);
    const english = [
      line(0, 4, 'What did you learn?', 'host'),
      line(4, 9, 'That you never miss twice.', 'guest'),
    ];
    const out = withoutInsertedAds(english);
    expect(out.droppedMs).toBe(0);
    expect(out.segments.map((s) => [s.idx, s.text, s.startMs, s.endMs])).toEqual([
      [0, 'What did you learn?', 0, 4000],
      [1, 'That you never miss twice.', 4000, 9000],
    ]);
  });
});
