import 'server-only';
import { type ChildProcess, spawn } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import type { Readable } from 'node:stream';
import {
  type AppConfig,
  findRepoRoot,
  readConfig,
  type SetupEnvValues,
  writeEnvFile,
} from '@dear-steven/core/config';
import { MODELS } from '@dear-steven/core/models';
import { embeddingEstimate } from '@dear-steven/core/openai';
import {
  SETUP_TOKEN_HEADER,
  type SetupEvent,
  type SetupKeys,
  type SetupRun,
  type SetupStage,
  type SetupState,
} from '@dear-steven/core/schema';
import { getStore } from './knowledge';

/**
 * Guided local setup (P6-04). `pnpm dev:setup` starts the web app bound to 127.0.0.1 with a fresh
 * token in `DEAR_STEVEN_SETUP_TOKEN` and prints a link carrying it. Without that — on any server
 * that wasn't started for it, or for any request that isn't plainly from this machine with the
 * token — every setup route answers 404.
 */

const ROOT = findRepoRoot();
/** The ingest CLI: the stages run through it, exactly as from a terminal. */
const CLI = join(ROOT, 'packages', 'ingest', 'src', 'cli.ts');
const MIN_TOKEN_CHARS = 32;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const LOOPBACK_ADDRESS = /^(127(\.\d{1,3}){3}|::1|::ffff:127(\.\d{1,3}){3})$/;
const MAX_LINE_CHARS = 500;

type Env = Record<string, string | undefined>;

/** The token, if this server was started for guided setup on this machine; otherwise `null`. */
export function setupToken(env: Env = process.env): string | null {
  const token = env.DEAR_STEVEN_SETUP_TOKEN?.trim() ?? '';
  const host = env.DEAR_STEVEN_SETUP_HOST?.trim() ?? '';
  const boundHere = LOOPBACK_HOSTS.has(host) || host === '::1';
  return token.length >= MIN_TOKEN_CHARS && boundHere && existsSync(CLI) ? token : null;
}

/**
 * Whether `req` may use the setup routes. Fails closed: the server must have been started for
 * setup, the request must name this machine (which also defeats DNS rebinding), come from this
 * page (Origin and Fetch Metadata, when sent), have passed through nothing but loopback, and carry
 * the token.
 */
export function setupAllowed(req: Request, env: Env = process.env): boolean {
  const token = setupToken(env);
  if (!token) return false;
  const host = req.headers.get('host') ?? '';
  let hostname: string;
  try {
    hostname = new URL(`http://${host}`).hostname;
  } catch {
    return false;
  }
  if (!LOOPBACK_HOSTS.has(hostname)) return false;
  const origin = req.headers.get('origin');
  if (origin !== null && origin !== `http://${host}`) return false;
  const site = req.headers.get('sec-fetch-site');
  if (site !== null && site !== 'same-origin') return false;
  const hops = req.headers.get('x-forwarded-for');
  if (hops !== null && !hops.split(',').every((a) => LOOPBACK_ADDRESS.test(a.trim()))) {
    return false;
  }
  const given = Buffer.from(req.headers.get(SETUP_TOKEN_HEADER) ?? '');
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const g = globalThis as typeof globalThis & { __dearStevenSetupRunning?: SetupStage | null };

/** What is saved and what embedding would cost now. Says whether a key is set, never what it is. */
export function setupState(config: AppConfig = readConfig()): SetupState {
  const store = getStore(config);
  const envFile = relative(ROOT, config.envFile);
  return {
    envFile: envFile.startsWith('..') || isAbsolute(envFile) ? config.envFile : envFile,
    keys: { openai: config.openaiApiKey !== null, youtube: config.youtubeApiKey !== null },
    dailyBudgetUsd: config.dailyBudgetUsd,
    embedding: embeddingEstimate(
      store?.countNeedingEmbedding(MODELS.embedding) ?? { passages: 0, tokens: 0 },
    ),
    spentUsd: store?.spentUsd() ?? 0,
    running: g.__dearStevenSetupRunning ?? null,
  };
}

/**
 * Saves keys and the daily cap to the env file, and to this process, so they apply at once —
 * to the answers and to every stage run from here on.
 */
export function saveKeys(keys: SetupKeys, config: AppConfig = readConfig()): void {
  const values: SetupEnvValues = {};
  if (keys.openaiApiKey) values.OPENAI_API_KEY = keys.openaiApiKey;
  if (keys.youtubeApiKey) values.YOUTUBE_API_KEY = keys.youtubeApiKey;
  if (keys.dailyBudgetUsd !== undefined) {
    values.DEAR_STEVEN_DAILY_BUDGET_USD =
      keys.dailyBudgetUsd === null ? null : String(keys.dailyBudgetUsd);
  }
  writeEnvFile(config.envFile, values);
  for (const [name, value] of Object.entries(values)) {
    if (value === null) delete process.env[name];
    else process.env[name] = value;
  }
}

/** The CLI arguments for a stage — the same commands `pnpm ingest` runs. */
export function cliArgs(run: SetupRun): string[] {
  switch (run.stage) {
    case 'discover':
      return ['discover'];
    case 'transcribe':
      return ['transcribe', '--from', 'vtt', '--limit', String(run.limit ?? 20)];
    case 'chunk':
      return ['chunk'];
    case 'index':
      return ['index', '--budget', String(run.budgetUsd)];
    case 'match-youtube':
      return ['match-youtube'];
    case 'latest':
      return run.budgetUsd === undefined
        ? ['latest']
        : ['latest', '--budget', String(run.budgetUsd)];
  }
}

export type Launch = (args: string[]) => ChildProcess;

const launchCli: Launch = (args) => {
  const { FORCE_COLOR: _, ...env } = process.env;
  return spawn(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    env: { ...env, NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
};

const encoder = new TextEncoder();
const frame = (event: SetupEvent) => encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching terminal escape codes is the point
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;

/** Calls `onLine` with every \n-terminated line of `input` (a \r inside one is a redraw, not a break). */
function eachLine(input: Readable, onLine: (line: string) => void) {
  let rest = '';
  input.setEncoding('utf8');
  input.on('data', (chunk: string) => {
    const lines = (rest + chunk).split('\n');
    rest = lines.pop() ?? '';
    for (const l of lines) onLine(l);
  });
  input.on('end', () => {
    if (rest) onLine(rest);
  });
}

/** Whether a stage is running: one at a time, for this whole server. */
export const runningStage = (): SetupStage | null => g.__dearStevenSetupRunning ?? null;

/**
 * Runs one stage through the CLI and streams its output as it comes, then how it ended. Closing
 * the request stops the stage (every stage is resumable).
 */
export function stageResponse(
  run: SetupRun,
  requestSignal: AbortSignal,
  launch: Launch = launchCli,
): Response {
  g.__dearStevenSetupRunning = run.stage;
  let child: ChildProcess | null = null;
  const stop = () => {
    child?.kill('SIGTERM');
  };
  requestSignal.addEventListener('abort', stop, { once: true });

  const stream = new ReadableStream<Uint8Array>({
    start(sink) {
      const send = (event: SetupEvent) => {
        try {
          sink.enqueue(frame(event));
        } catch {
          // The page went away; the stage is being stopped.
        }
      };
      const line = (raw: string) => {
        // A progress line redraws itself with \r: keep what a terminal would show last.
        const text = (raw.split('\r').at(-1) ?? '').replace(ANSI, '').trimEnd();
        if (text) send({ type: 'line', text: text.slice(0, MAX_LINE_CHARS) });
      };
      let finished = false;
      const finish = (ok: boolean) => {
        if (finished) return;
        finished = true;
        g.__dearStevenSetupRunning = null;
        requestSignal.removeEventListener('abort', stop);
        send({ type: 'done', ok });
        try {
          sink.close();
        } catch {
          // Already closed.
        }
      };

      child = launch(cliArgs(run));
      for (const output of [child.stdout, child.stderr]) if (output) eachLine(output, line);
      child.once('error', (error) => {
        line(`✗ ${error.message}`);
        finish(false);
      });
      child.once('close', (code) => finish(code === 0));
    },
    cancel: stop,
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

export const NO_STORE = { 'Cache-Control': 'no-store' };

/** What every setup route answers when setup isn't on, or the request isn't allowed to use it. */
export const notFound = () => new Response('Not found', { status: 404, headers: NO_STORE });

/** A small JSON body, or `undefined` when it is too long or isn't JSON. */
export async function smallJson(req: Request, maxChars: number): Promise<unknown> {
  const raw = await req.text();
  if (raw.length > maxChars) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
