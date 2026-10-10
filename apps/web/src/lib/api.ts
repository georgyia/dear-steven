import type {
  AskErrorCode,
  AskEvent,
  AskRequest,
  KnowledgeStatus,
  PassageContext,
} from '@dear-steven/core/schema';
import { readEvents } from './sse';

export class AskError extends Error {
  readonly code: AskErrorCode | 'network';
  constructor(code: AskErrorCode | 'network', message: string) {
    super(message);
    this.code = code;
  }
}

const errorCode = (status: number): AskErrorCode =>
  status === 429
    ? 'rate_limited'
    : status === 400 || status === 413
      ? 'bad_request'
      : status === 503
        ? 'not_configured'
        : 'upstream';

/** Streams `/api/ask` as typed events. Throws `AskError` for transport-level failures. */
export async function* askStream(
  request: AskRequest,
  signal: AbortSignal,
): AsyncGenerator<AskEvent> {
  let res: Response;
  try {
    res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    if (signal.aborted) return;
    throw new AskError('network', error instanceof Error ? error.message : 'Network error');
  }
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new AskError(errorCode(res.status), body?.error?.message ?? res.statusText);
  }
  yield* readEvents(res.body);
}

export async function fetchPassage(
  passageId: string,
  signal?: AbortSignal,
): Promise<PassageContext> {
  const res = await fetch(`/api/passages/${encodeURIComponent(passageId)}`, { signal });
  if (!res.ok) throw new Error(`passage ${res.status}`);
  return (await res.json()) as PassageContext;
}

export async function fetchStatus(signal?: AbortSignal): Promise<KnowledgeStatus> {
  const res = await fetch('/api/status', { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return (await res.json()) as KnowledgeStatus;
}
