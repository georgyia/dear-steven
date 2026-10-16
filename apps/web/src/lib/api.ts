import {
  type AskErrorCode,
  type AskEvent,
  type AskRequest,
  type ConversationSummaryView,
  ConversationSummaryViewSchema,
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

/**
 * Why a request failed, as the page tells it: the server's codes, `network` when it never got an
 * answer, and `cross_site` when `src/proxy.ts` refused it as coming from another site (P8-08).
 */
export type ClientErrorCode = AskErrorCode | 'network' | 'cross_site';

export class AskError extends Error {
  readonly code: ClientErrorCode;
  constructor(code: ClientErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** Whether asking again could help (P10-08): not with no free questions left, nor from another site. */
export const canRetry = (code: ClientErrorCode | null): boolean =>
  code !== 'needs_key' && code !== 'cross_site';

type ErrorBody = { error?: { code?: unknown; message?: string } } | null;

const errorCode = (status: number, body: ErrorBody): ClientErrorCode =>
  status === 403 && body?.error?.code === 'cross_site'
    ? 'cross_site'
    : status === 401
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
    const body = (await res.json().catch(() => null)) as ErrorBody;
    throw new AskError(errorCode(res.status, body), body?.error?.message ?? res.statusText);
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

/** A conversation's summary, with every item's citation (P8-04). */
export async function fetchSummary(
  episodeId: string,
  signal?: AbortSignal,
): Promise<ConversationSummaryView> {
  const res = await fetch(`/api/episodes/${encodeURIComponent(episodeId)}/summary`, {
    signal,
    headers: await keyHeaders(),
  });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return ConversationSummaryViewSchema.parse(await res.json());
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
  const body = (await res.json().catch(() => null)) as ErrorBody;
  if (!res.ok)
    throw new AskError(errorCode(res.status, body), body?.error?.message ?? res.statusText);
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
  const body = (await res.json().catch(() => null)) as ErrorBody;
  if (!res.ok)
    throw new AskError(errorCode(res.status, body), body?.error?.message ?? res.statusText);
  const reply = InterviewReplySchema.safeParse(body);
  if (!reply.success) throw new AskError('upstream', res.statusText);
  return { reply: reply.data, ticket: res.headers.get(TICKET_HEADER) ?? ticket };
}
