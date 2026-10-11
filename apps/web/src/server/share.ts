import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { stillSourced } from '@dear-steven/core/answer';
import type { AppConfig } from '@dear-steven/core/config';
import {
  type AskEvent,
  type FinalAnswer,
  LIMITS,
  type SharedAnswer,
  SharedAnswerSchema,
  ShareTokenSchema,
} from '@dear-steven/core/schema';
import { relinked } from '@/lib/memory';
import { getStore } from './knowledge';

/**
 * Share links (P6-17). When an answer is written, the server attaches a token: the question and
 * answer, compressed, plus an HMAC under a secret only this deployment knows. The token travels in
 * the link's fragment, so it never reaches a server log, and nothing is stored. Opening a link
 * hands the token back; it opens only if the signature holds — so a link that was edited, or
 * comes from another copy, can't put a single word, quote or link on screen — and even then the
 * answer is re-validated and its links rebuilt, as for a restored conversation.
 */

const VERSION = 'v1';
/** Inflated JSON is capped, so a crafted token can't be a decompression bomb. */
const MAX_JSON_BYTES = 512 * 1024;
const SECRET_BYTES = 32;

const g = globalThis as typeof globalThis & { __dearStevenShareSecrets?: Map<string, Buffer> };

/**
 * The signing secret: `share-secret` beside the knowledge base, created on first use (owner-only).
 * If it can't be saved, a per-process secret still works — links then stop opening after a restart.
 */
function secret(config: AppConfig): Buffer {
  g.__dearStevenShareSecrets ??= new Map();
  const path = join(dirname(config.dbPath), 'share-secret');
  let key = g.__dearStevenShareSecrets.get(path) ?? readSecret(path);
  if (!key) {
    key = randomBytes(SECRET_BYTES);
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, key, { mode: 0o600, flag: 'wx' });
    } catch (error) {
      // Another request may have just created it.
      const saved = readSecret(path);
      if (saved) key = saved;
      else {
        console.error(
          '[share] could not save the share secret; links will stop opening after a restart:',
          error instanceof Error ? error.name : error,
        );
      }
    }
  }
  g.__dearStevenShareSecrets.set(path, key);
  return key;
}

function readSecret(path: string): Buffer | null {
  try {
    const saved = readFileSync(path);
    return saved.length >= SECRET_BYTES ? saved : null;
  } catch {
    return null;
  }
}

const sign = (key: Buffer, body: string) =>
  createHmac('sha256', key).update(`dear-steven/share/${VERSION}.${body}`).digest('base64url');

/** The token for a share link, or `undefined` if the answer is too long to fit in one. */
export function shareToken(
  config: AppConfig,
  question: string,
  answer: FinalAnswer,
): string | undefined {
  // Links are rebuilt on opening, so they aren't carried.
  const { share: _, ...rest } = answer;
  const shared: SharedAnswer = {
    question,
    answer: {
      ...rest,
      citations: rest.citations.map((c) => ({ ...c, youtubeUrl: null, embedUrl: null })),
    },
  };
  const body = deflateRawSync(JSON.stringify(shared)).toString('base64url');
  const token = `${VERSION}.${body}.${sign(secret(config), body)}`;
  return token.length <= LIMITS.shareTokenChars ? token : undefined;
}

/** The question and answer behind a token — or `null` if it was altered or isn't ours. */
export function openShareToken(config: AppConfig, token: string): SharedAnswer | null {
  if (!ShareTokenSchema.safeParse(token).success) return null;
  const [, body = '', signature = ''] = token.split('.');
  const expected = Buffer.from(sign(secret(config), body));
  if (!timingSafeEqual(Buffer.from(signature), expected)) return null;
  try {
    const json = inflateRawSync(Buffer.from(body, 'base64url'), {
      maxOutputLength: MAX_JSON_BYTES,
    }).toString('utf8');
    const shared = SharedAnswerSchema.safeParse(JSON.parse(json));
    if (!shared.success) return null;
    return { question: shared.data.question, answer: relinked(shared.data.answer) };
  } catch {
    return null;
  }
}

interface PassageLookup {
  getPassagesByIds(ids: string[]): { id: string; text: string }[];
}

export type OpenedShare = { shared: SharedAnswer } | { refused: 'broken' | 'gone' };

/**
 * Opens a share link: signed here and valid, and — for anything but a demo fixture — still
 * standing on the knowledge base as it is now (`stillSourced`), so a takedown reaches old links.
 */
export function openSharedAnswer(
  config: AppConfig,
  token: string,
  store: () => PassageLookup | null = () => getStore(config),
): OpenedShare {
  const shared = openShareToken(config, token);
  if (!shared) return { refused: 'broken' };
  if (shared.answer.demo) return { shared };
  const ids = shared.answer.citations.map((c) => c.passageId);
  const passages = new Map((store()?.getPassagesByIds(ids) ?? []).map((p) => [p.id, p.text]));
  return stillSourced(shared.answer, passages) ? { shared } : { refused: 'gone' };
}

/** Attaches a share token to the final answer of a stream; every other event passes through. */
export async function* withShareToken(
  events: AsyncIterable<AskEvent>,
  config: AppConfig,
  question: string,
): AsyncGenerator<AskEvent> {
  for await (const event of events) {
    if (event.type !== 'final') {
      yield event;
      continue;
    }
    const share = shareToken(config, question, event.answer);
    yield share ? { ...event, answer: { ...event.answer, share } } : event;
  }
}
