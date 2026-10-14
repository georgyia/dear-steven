/**
 * Raw speech as `/api/speech` streams it (P9-01): signed 16-bit little-endian samples, arriving in
 * pieces of any length, even mid-sample. The decoder keeps a split byte for the next piece.
 */
export function pcmDecoder(): (bytes: Uint8Array) => Float32Array<ArrayBuffer> {
  let carry: number | null = null;
  return (bytes) => {
    const total = bytes.length + (carry === null ? 0 : 1);
    const out = new Float32Array(Math.floor(total / 2));
    let at = 0;
    let i = 0;
    if (carry !== null && bytes.length > 0) {
      out[at++] = sample(carry, bytes[0] as number);
      carry = null;
      i = 1;
    }
    for (; i + 1 < bytes.length; i += 2)
      out[at++] = sample(bytes[i] as number, bytes[i + 1] as number);
    if (i < bytes.length) carry = bytes[i] as number;
    return out;
  };
}

/** Two bytes, low first, as a sample in [-1, 1). */
const sample = (low: number, high: number) => (((high << 24) >> 16) | low) / 32_768;
