import { describe, expect, it } from 'vitest';
import { pcmDecoder } from './pcm';

/** Samples as 16-bit little-endian bytes, the way OpenAI's `pcm` format sends them. */
function encode(samples: number[]): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (const [i, s] of samples.entries()) view.setInt16(i * 2, s, true);
  return bytes;
}

const SAMPLES = [0, 1, -1, 32_767, -32_768, 12_345, -12_345, 256, -256, 255];
const expected = SAMPLES.map((s) => s / 32_768);

describe('PCM as it streams (P9-01)', () => {
  it('decodes signed little-endian samples', () => {
    expect([...pcmDecoder()(encode(SAMPLES))]).toEqual(expected);
  });

  it('gives the same samples however the bytes are split, even mid-sample', () => {
    const bytes = encode(SAMPLES);
    for (let cut = 0; cut <= bytes.length; cut++) {
      for (let second = cut; second <= bytes.length; second++) {
        const decode = pcmDecoder();
        const out = [
          ...decode(bytes.slice(0, cut)),
          ...decode(bytes.slice(cut, second)),
          ...decode(new Uint8Array(0)),
          ...decode(bytes.slice(second)),
        ];
        expect(out).toEqual(expected);
      }
    }
  });

  it('byte by byte too', () => {
    const decode = pcmDecoder();
    const out = [...encode(SAMPLES)].flatMap((b) => [...decode(Uint8Array.of(b))]);
    expect(out).toEqual(expected);
  });
});
