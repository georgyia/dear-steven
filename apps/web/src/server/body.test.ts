import { describe, expect, it } from 'vitest';
import { ENDLESS_CHUNK, endlessBody } from '@/test/endless-body';
import { readBody, readBytes } from './body';

const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/ask', {
    method: 'POST',
    body,
    headers,
    duplex: 'half',
  } as RequestInit);

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('readBody (P10-04)', () => {
  it('reads a body up to the limit exactly, and refuses one byte more', async () => {
    expect(await readBody(post('x'.repeat(16)), 16)).toBe('x'.repeat(16));
    expect(await readBody(post('x'.repeat(17)), 16)).toBeNull();
    expect(await readBody(post(null), 16)).toBe('');
  });

  it('measures in bytes, not characters', async () => {
    // "é" is one character and two bytes.
    expect(await readBody(post('éé'), 4)).toBe('éé');
    expect(await readBody(post('ééé'), 5)).toBeNull();
    expect(await readBody(post('🙂'), 3)).toBeNull();
  });

  it('decodes a character split between two pieces of the body', async () => {
    const split = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Uint8Array.of(0x7b, 0x22, 0xc3));
        controller.enqueue(Uint8Array.of(0xa9, 0x22, 0x7d));
        controller.close();
      },
    });
    expect(await readBody(post(split), 6)).toBe('{"é"}');
  });

  it('refuses a Content-Length over the limit without reading a byte', async () => {
    const req = post(endlessBody(0).stream, { 'content-length': '1048577' });
    expect(await readBody(req, 1024 * 1024)).toBeNull();
    expect(req.bodyUsed).toBe(false);
  });

  it('stops reading a body with no length once it passes the limit', async () => {
    const body = endlessBody(1024 * 1024);
    expect(await readBody(post(body.stream), 64 * 1024)).toBeNull();
    const taken = body.taken();
    // What was read, and at most the one piece the stream queues ahead.
    expect(taken).toBeLessThanOrEqual(64 * 1024 + 2 * ENDLESS_CHUNK);
    await settle();
    expect(body.taken()).toBe(taken);
  });

  it('cancels the rest of a body that passes the limit, so the upload stops', async () => {
    const body = endlessBody(1024 * 1024);
    expect(await readBody(post(body.stream), 4096)).toBeNull();
    expect(body.cancelled()).toBe(true);
  });

  it('stops reading a body whose length is false once it passes the limit', async () => {
    const body = endlessBody(1024 * 1024);
    expect(await readBody(post(body.stream, { 'content-length': '10' }), 4096)).toBeNull();
    expect(body.taken()).toBeLessThanOrEqual(4096 + 2 * ENDLESS_CHUNK);
    // An unreadable length counts for nothing either.
    const other = endlessBody(1024 * 1024);
    expect(await readBody(post(other.stream, { 'content-length': 'lots' }), 4096)).toBeNull();
    expect(other.taken()).toBeLessThanOrEqual(4096 + 2 * ENDLESS_CHUNK);
  });
});

describe('readBytes (P10-04)', () => {
  it('returns the body’s bytes as they were sent', async () => {
    const sent = Uint8Array.from({ length: 300 }, (_, i) => i % 256);
    expect(await readBytes(post(sent), 300)).toEqual(sent);
    expect(await readBytes(post(sent), 299)).toBeNull();
  });
});
