import { describe, expect, it } from 'vitest';
import { diarizationCostUsd, HOST_LABEL, mapDiarizedSegments } from './openai-transcribe.ts';

describe('mapDiarizedSegments', () => {
  const chunks = [
    {
      offsetMs: 0,
      segments: [
        { start: 0.5, end: 4.25, speaker: HOST_LABEL, text: ' What did you learn? ' },
        { start: 4.5, end: 12, speaker: 'A', text: 'That you never miss twice.' },
        { start: 12, end: 12.4, speaker: 'A', text: '  ' },
      ],
    },
    { offsetMs: 1_380_000, segments: [{ start: 1, end: 3, speaker: 'B', text: 'Exactly.' }] },
  ];

  it('marks the enrolled host voice and offsets later chunks', () => {
    const segs = mapDiarizedSegments(chunks, ['Dana White']);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toMatchObject({
      idx: 0,
      startMs: 500,
      endMs: 4250,
      speaker: 'host',
      speakerName: 'Steven Bartlett',
      attributionMethod: 'diarization',
      text: 'What did you learn?',
    });
    expect(segs[1]).toMatchObject({ speaker: 'guest', speakerName: 'Dana White' });
    expect(segs[2]).toMatchObject({ idx: 2, startMs: 1_381_000, speaker: 'guest' });
  });

  it('keeps guests anonymous on multi-guest panels', () => {
    const segs = mapDiarizedSegments(chunks, ['Daniel Priestley', 'Nick Hanauer']);
    expect(segs[1]?.speakerName).toBe(null);
    expect(segs[0]?.speakerName).toBe('Steven Bartlett');
  });
});

describe('diarizationCostUsd', () => {
  it('prices by the audio hour', () => {
    expect(diarizationCostUsd(5_400_000)).toBeCloseTo(0.54);
  });
});
