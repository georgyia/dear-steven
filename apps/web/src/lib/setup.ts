import {
  SETUP_TOKEN_HEADER,
  type SetupEvent,
  type SetupKeys,
  type SetupRun,
  type SetupState,
} from '@dear-steven/core/schema';
import { readEvents } from './sse';

/**
 * The browser side of guided local setup (P6-04). `pnpm dev:setup` prints a link with a one-time
 * token in its fragment; the page keeps it for this tab only and sends it with every setup request.
 */

const PREFIX = '#setup=';
const STORAGE_KEY = 'dear-steven:setup-token';

/**
 * The token, from the link (`fromLink`, and the fragment is cleared at once so it doesn't linger in
 * the address bar or history) or from earlier in this tab; `null` when there is none.
 */
export function takeSetupToken(): { token: string; fromLink: boolean } | null {
  const { hash, pathname, search } = window.location;
  if (hash.startsWith(PREFIX)) {
    window.history.replaceState(null, '', pathname + search);
    const token = hash.slice(PREFIX.length);
    try {
      sessionStorage.setItem(STORAGE_KEY, token);
    } catch {
      // Storage can be blocked; the token still works until a reload.
    }
    return token ? { token, fromLink: true } : null;
  }
  try {
    const token = sessionStorage.getItem(STORAGE_KEY);
    return token ? { token, fromLink: false } : null;
  } catch {
    return null;
  }
}

export function forgetSetupToken() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was stored.
  }
}

const headers = (token: string) => ({
  'Content-Type': 'application/json',
  [SETUP_TOKEN_HEADER]: token,
});

async function failure(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return new Error(body?.error?.message ?? res.statusText);
}

/** What is set up, or `null` when this server doesn't offer guided setup to this token. */
export async function fetchSetup(token: string, signal?: AbortSignal): Promise<SetupState | null> {
  const res = await fetch('/api/setup', { headers: headers(token), signal, cache: 'no-store' });
  return res.ok ? ((await res.json()) as SetupState) : null;
}

/** Writes keys to the env file. Resolves to the new state; rejects with the message to show. */
export async function saveSetupKeys(token: string, keys: SetupKeys): Promise<SetupState> {
  const res = await fetch('/api/setup/keys', {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(keys),
  });
  if (!res.ok) throw await failure(res);
  return (await res.json()) as SetupState;
}

/** Runs one ingest stage, streaming its output. Rejects with the message to show if it can't start. */
export async function* runSetupStage(
  token: string,
  run: SetupRun,
  signal: AbortSignal,
): AsyncGenerator<SetupEvent> {
  const res = await fetch('/api/setup/run', {
    method: 'POST',
    headers: { ...headers(token), Accept: 'text/event-stream' },
    body: JSON.stringify(run),
    signal,
  });
  if (!res.ok || !res.body) throw await failure(res);
  yield* readEvents<SetupEvent>(res.body);
}
