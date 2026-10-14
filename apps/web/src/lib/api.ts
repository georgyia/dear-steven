import {
  type AskErrorCode,
  type AskEvent,
  type AskRequest,
  type EpisodePage,
  type InterviewReply,
  InterviewReplySchema,
  type InterviewRequest,
  type KnowledgeStatus,
  type PassageContext,
  type RelatedMoments,
  type SharedAnswer,
  SharedAnswerSchema,
} from '@dear-steven/core/schema';
import { readEvents } from './sse';
import { keyHeaders } from './visitor-key';

/** Mirrors `server/free-questions.ts`: a free interview's ticket. */
const TICKET_HEADER = 'x-interview-ticket';

export class AskError extends Error {
  readonly code: AskErrorCode | 'network';
  constructor(code: AskErrorCode | 'network', message: string) {
    super(message);
    this.code = code;
  }
}

const errorCode = (status: number): AskErrorCode =>
  status === 401
    ? 'locked'
    : status === 402
      ? 'needs_key'
      : status === 429
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
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(await keyHeaders()),
      },
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
  const res = await fetch(`/api/passages/${encodeURIComponent(passageId)}`, {
    signal,
    headers: await keyHeaders(),
  });
  if (!res.ok) throw new Error(`passage ${res.status}`);
  return (await res.json()) as PassageContext;
}

export async function fetchRelated(
  passageId: string,
  signal?: AbortSignal,
): Promise<RelatedMoments> {
  const res = await fetch(`/api/passages/${encodeURIComponent(passageId)}/related`, {
    signal,
    headers: await keyHeaders(),
  });
  if (!res.ok) throw new Error(`related ${res.status}`);
  return (await res.json()) as RelatedMoments;
}

export async function fetchStatus(signal?: AbortSignal): Promise<KnowledgeStatus> {
  const res = await fetch('/api/status', {
    signal,
    cache: 'no-store',
    headers: await keyHeaders(),
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return (await res.json()) as KnowledgeStatus;
}

export async function fetchEpisodes(
  query: string,
  offset: number,
  signal?: AbortSignal,
): Promise<EpisodePage> {
  const qs = new URLSearchParams({ q: query, offset: String(offset) });
  const res = await fetch(`/api/episodes?${qs}`, { signal, headers: await keyHeaders() });
  if (!res.ok) throw new Error(`episodes ${res.status}`);
  return (await res.json()) as EpisodePage;
}

/**
 * "Test and use" (P6-03): asks the server whether `key` works, without storing it anywhere.
 * Resolves to `null` when it does, or the message to show when it doesn't.
 */
export async function testKey(key: string, signal?: AbortSignal): Promise<string | null> {
  const res = await fetch('/api/key', { method: 'POST', headers: await keyHeaders(key), signal });
  if (res.ok) return null;
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? res.statusText;
}

/** Opens a share link's token (P6-17). Throws `AskError` with the message to show when it won't. */
export async function openShared(token: string, signal?: AbortSignal): Promise<SharedAnswer> {
  let res: Response;
  try {
    res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      signal,
    });
  } catch (error) {
    throw new AskError('network', error instanceof Error ? error.message : 'Network error');
  }
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!res.ok) throw new AskError(errorCode(res.status), body?.error?.message ?? res.statusText);
  const shared = SharedAnswerSchema.safeParse(body);
  if (!shared.success) throw new AskError('upstream', res.statusText);
  return shared.data;
}

/**
 * One interview step (P7-06): the interview so far in, the next question (or what I learned, or
 * an ending) out. Runs on the visitor's own key when they set one. Throws `AskError` otherwise.
 * On free questions (P8-02) the interview's ticket goes back with each step, and a new one may come.
 */
export async function interviewStep(
  request: InterviewRequest,
  signal?: AbortSignal,
  ticket: string | null = null,
): Promise<{ reply: InterviewReply; ticket: string | null }> {
  let res: Response;
  try {
    res = await fetch('/api/interview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await keyHeaders()),
        ...(ticket ? { [TICKET_HEADER]: ticket } : {}),
      },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new AskError('network', error instanceof Error ? error.message : 'Network error');
  }
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!res.ok) throw new AskError(errorCode(res.status), body?.error?.message ?? res.statusText);
  const reply = InterviewReplySchema.safeParse(body);
  if (!reply.success) throw new AskError('upstream', res.statusText);
  return { reply: reply.data, ticket: res.headers.get(TICKET_HEADER) ?? ticket };
}
