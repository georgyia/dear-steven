import type { AskEvent } from '@dear-steven/core/schema';

/**
 * Incremental parser for the `data: <json>\n\n` frames sent by `/api/ask` and `/api/setup/run`.
 * Fed raw text chunks in whatever sizes the network delivers them; returns every complete event so
 * far.
 */
export function createSseParser<T extends { type: string } = AskEvent>() {
  let buffer = '';
  return (chunk: string): T[] => {
    buffer += chunk.replace(/\r\n/g, '\n');
    const events: T[] = [];
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
        const parsed = safeParse<T>(data);
        if (parsed) events.push(parsed);
      }
      boundary = buffer.indexOf('\n\n');
    }
    return events;
  };
}

function safeParse<T>(data: string): T | null {
  try {
    const value: unknown = JSON.parse(data);
    if (
      value &&
      typeof value === 'object' &&
      typeof (value as { type?: unknown }).type === 'string'
    ) {
      return value as T;
    }
  } catch {
    // A malformed frame is dropped; the stream continues.
  }
  return null;
}

/** Reads an SSE response body as a stream of events. */
export async function* readEvents<T extends { type: string } = AskEvent>(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parse = createSseParser<T>();
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
