/** Polite HTTP for ingestion: identifies itself, times out, and retries transient failures. */

export const USER_AGENT = 'DearSteven-ingest/0.1 (+https://github.com/; personal, non-commercial)';

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${new URL(url).host}${new URL(url).pathname}`);
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const transient = (error: unknown) =>
  !(error instanceof HttpError) || error.status === 429 || error.status >= 500;

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  {
    tries = 4,
    baseMs = 800,
    retry = transient,
  }: { tries?: number; baseMs?: number; retry?: (error: unknown) => boolean } = {},
): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      last = error;
      if (attempt === tries || !retry(error)) break;
      await sleep(baseMs * 2 ** (attempt - 1) + Math.random() * 250);
    }
  }
  throw last;
}

export async function fetchText(url: string, timeoutMs = 30_000): Promise<string> {
  return withRetry(async () => {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    if (!res.ok) throw new HttpError(res.status, url);
    return res.text();
  });
}

export async function fetchJson<T>(url: string, timeoutMs = 30_000): Promise<T> {
  return JSON.parse(await fetchText(url, timeoutMs)) as T;
}

/** Runs `fn` over `items` with at most `limit` in flight, preserving result order. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i] as T, i);
    }
  });
  await Promise.all(workers);
  return results;
}
