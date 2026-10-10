import type { AskEvent } from '@dear-steven/core/schema';

/**
 * Incremental parser for the `data: <json>\n\n` frames sent by `/api/ask`. Fed raw text chunks
 * in whatever sizes the network delivers them; returns every complete event so far.
 */
export function createSseParser() {
  let buffer = '';
  return (chunk: string): AskEvent[] => {
    buffer += chunk.replace(/\r\n/g, '\n');
    const events: AskEvent[] = [];
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (data) {
        const parsed = safeParse(data);
        if (parsed) events.push(parsed);
      }
      boundary = buffer.indexOf('\n\n');
    }
    return events;
  };
}

function safeParse(data: string): AskEvent | null {
  try {
    const value: unknown = JSON.parse(data);
    if (
      value &&
      typeof value === 'object' &&
      typeof (value as { type?: unknown }).type === 'string'
    ) {
      return value as AskEvent;
    }
  } catch {
    // A malformed frame is dropped; the stream continues.
  }
  return null;
}

/** Reads an SSE response body as a stream of events. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<AskEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parse = createSseParser();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const event of parse(decoder.decode(value, { stream: true }))) yield event;
    }
    for (const event of parse(decoder.decode())) yield event;
  } finally {
    reader.releaseLock();
  }
}
