import { describe, expect, it } from 'vitest';
import { createSseParser, readEvents } from './sse.ts';

describe('createSseParser', () => {
  it('parses frames split across arbitrary chunk boundaries', () => {
    const parse = createSseParser();
    const a = parse('data: {"type":"status","step":"searching","mes');
    const b = parse('sage":"Searching…"}\n\ndata: {"type":"block.start",');
    const c = parse('"index":0}\n\n');
    expect(a).toEqual([]);
    expect(b).toEqual([{ type: 'status', step: 'searching', message: 'Searching…' }]);
    expect(c).toEqual([{ type: 'block.start', index: 0 }]);
  });

  it('handles CRLF line endings and ignores comments and junk', () => {
    const parse = createSseParser();
    const events = parse(
      ': keep-alive\r\n\r\ndata: not json\r\n\r\ndata: {"type":"block.start","index":2}\r\n\r\n',
    );
    expect(events).toEqual([{ type: 'block.start', index: 2 }]);
  });
});

describe('readEvents', () => {
  it('yields events from a byte stream', async () => {
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode('data: {"type":"block.start","index":0}\n\nda'));
        controller.enqueue(enc.encode('ta: {"type":"block.start","index":1}\n\n'));
        controller.close();
      },
    });
    const seen = [];
    for await (const e of readEvents(body)) seen.push(e);
    expect(seen).toEqual([
      { type: 'block.start', index: 0 },
      { type: 'block.start', index: 1 },
    ]);
  });
});
