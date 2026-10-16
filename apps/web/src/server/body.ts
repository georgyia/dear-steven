import 'server-only';

/**
 * Request bodies, read up to a limit in bytes (P10-04; SR-01, SR-20, SR-22). Every route that reads
 * a body reads it here, so no route buffers more of a body than its limit: a `Content-Length` over
 * the limit is refused before a byte is read, and a body sent without one, or with one that is
 * wrong, as soon as the bytes read pass the limit. Reading stops there, and the rest is cancelled.
 * (In front of every route, Next keeps up to 10 MB of a body for `src/proxy.ts`: its
 * `proxyClientMaxBodySize` default.)
 */

/** The request's body, or `null` when it is longer than `maxBytes`. */
export async function readBytes(
  req: Request,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  if (Number(req.headers.get('content-length')) > maxBytes) return null;
  const chunks: Uint8Array[] = [];
  let length = 0;
  if (req.body) {
    const reader = req.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maxBytes) {
          // Stop the upload, not only the reading: the rest is never wanted.
          await reader.cancel().catch(() => {});
          return null;
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const bytes = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes;
}

/** The request's body as UTF-8 text, or `null` when it is longer than `maxBytes`. */
export async function readBody(req: Request, maxBytes: number): Promise<string | null> {
  const bytes = await readBytes(req, maxBytes);
  return bytes === null ? null : new TextDecoder().decode(bytes);
}

/** `raw` as JSON, or `undefined` when it isn't. */
export function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
