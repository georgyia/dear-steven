import 'server-only';
import type { KeySource } from '@dear-steven/core/config';
import type { UiLocale } from '@dear-steven/core/copy';
import type { AskEvent } from '@dear-steven/core/schema';
import { describeFailure } from './errors';

const encoder = new TextEncoder();

export const encodeEvent = (event: AskEvent) =>
  encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

/**
 * Streams events as `text/event-stream`. The producer receives the request's abort signal so a
 * closed tab or the composer's stop button cancels upstream work (and spend) immediately.
 * A failure mid-stream becomes an `error` event, worded in `locale` for whoever owns the key.
 */
export function sseResponse(
  produce: (signal: AbortSignal) => AsyncIterable<AskEvent>,
  requestSignal: AbortSignal,
  locale?: UiLocale,
  keySource?: KeySource | null,
): Response {
  const controller = new AbortController();
  const abort = () => controller.abort();
  requestSignal.addEventListener('abort', abort, { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(sink) {
      try {
        for await (const event of produce(controller.signal)) {
          if (controller.signal.aborted) break;
          sink.enqueue(encodeEvent(event));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          const failure = describeFailure(error, locale, keySource);
          console.error('[ask] stream failed:', failure.log);
          sink.enqueue(
            encodeEvent({ type: 'error', code: failure.code, message: failure.message }),
          );
        }
      } finally {
        requestSignal.removeEventListener('abort', abort);
        try {
          sink.close();
        } catch {
          // Already closed by a disconnecting client.
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}

export function jsonError(status: number, code: string, message: string, headers?: HeadersInit) {
  return Response.json({ error: { code, message } }, { status, headers });
}
