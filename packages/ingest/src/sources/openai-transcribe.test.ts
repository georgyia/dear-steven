import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { OpenAI } from '@dear-steven/core/openai';
import { describe, expect, it, vi } from 'vitest';
import {
  DIARIZE_CHUNK_SECONDS,
  DIARIZE_REQUEST,
  diarizationCostUsd,
  diarizeChunks,
  HOST_LABEL,
  mapDiarizedSegments,
  retryDiarization,
} from './openai-transcribe.ts';

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

describe('diarizeChunks: waiting and retrying', () => {
  const chunk = () => {
    const path = join(mkdtempSync(join(tmpdir(), 'dear-steven-diarize-')), 'chunk.mp3');
    writeFileSync(path, 'mp3');
    return [{ path, offsetMs: 0, durationMs: 1_380_000 }];
  };
  const reply = { segments: [{ start: 0, end: 2, speaker: HOST_LABEL, text: 'Hello.' }] };
  const client = (create: (...args: unknown[]) => Promise<unknown>) =>
    ({ audio: { transcriptions: { create } } }) as unknown as OpenAI;

  it('gives each request minutes, not the shared client’s 60 s, and no SDK retries', async () => {
    const create = vi.fn(async () => reply);
    await diarizeChunks(client(create), chunk(), 'data:audio/wav;base64,AAAA');
    expect(create).toHaveBeenCalledWith(expect.anything(), DIARIZE_REQUEST);
    // Past Node's own five-minute wait for headers, so that is the limit a chunk must answer within.
    expect(DIARIZE_REQUEST.timeout).toBeGreaterThan(5 * 60_000);
    expect(DIARIZE_CHUNK_SECONDS).toBeLessThanOrEqual(300);
    expect(DIARIZE_REQUEST.maxRetries).toBe(0);
  });

  it('never tries a timed-out chunk again: OpenAI may have billed it', async () => {
    const timeout = Object.assign(new Error('Request timed out.'), {
      name: 'APIConnectionTimeoutError',
    });
    const create = vi.fn(async () => {
      throw timeout;
    });
    await expect(diarizeChunks(client(create), chunk(), 'ref')).rejects.toThrow('timed out');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('asks a few chunks at once, and keeps them in order', async () => {
    const chunks = Array.from({ length: 7 }, (_, i) => ({
      ...chunk()[0],
      offsetMs: i * 300_000,
    })) as ReturnType<typeof chunk>;
    let inFlight = 0;
    let most = 0;
    const create = vi.fn(async () => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((r) => setTimeout(r, 5 + Math.random() * 10));
      inFlight -= 1;
      return reply;
    });
    const out = await diarizeChunks(client(create), chunks, 'ref', undefined, 3);
    expect(out.map((c) => c.offsetMs)).toEqual(chunks.map((c) => c.offsetMs));
    expect(most).toBe(3);
    expect(create).toHaveBeenCalledTimes(7);
  });

  it('tells what to try again: rate limits, server errors and dropped connections only', () => {
    const status = (n: number) => Object.assign(new Error('HTTP'), { status: n });
    expect(retryDiarization(status(429))).toBe(true);
    expect(retryDiarization(status(503))).toBe(true);
    expect(retryDiarization(new Error('socket hang up'))).toBe(true);
    expect(retryDiarization(status(400))).toBe(false);
    expect(retryDiarization(status(401))).toBe(false);
    expect(retryDiarization(new Error('Request timed out.'))).toBe(false);
    const named = Object.assign(new Error('x'), { name: 'APIConnectionTimeoutError' });
    expect(retryDiarization(named)).toBe(false);
  });
});
