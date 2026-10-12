import { LIMITS } from '@dear-steven/core/limits';
import {
  type AskStep,
  AskStepSchema,
  type Citation,
  type FinalAnswer,
  FinalAnswerSchema,
} from '@dear-steven/core/schema';
import { httpsUrl, linksAt } from '@dear-steven/core/youtube';
import type { Turn } from './conversation';

/**
 * Conversation memory (P5-11): opt-in, this browser only (IndexedDB). Only finished turns are kept
 * — the question and its validated answer. Nothing is written while memory is off: not the
 * conversation, not the setting, not even an empty database.
 */

export interface StoredTurn {
  id: string;
  question: string;
  steps: { step: AskStep; message: string }[];
  sources: { passages: number; episodes: number } | null;
  final: FinalAnswer;
}

export interface StoredConversation {
  version: 1;
  savedAt: string;
  turns: StoredTurn[];
}

const MAX_TURNS = 50;
const TURN_ID = /^[A-Za-z0-9_-]{1,40}$/;

export function toStored(turns: Turn[], now = new Date()): StoredConversation {
  return {
    version: 1,
    savedAt: now.toISOString(),
    turns: turns
      .filter((t): t is Turn & { final: FinalAnswer } => t.status === 'done' && t.final !== null)
      .slice(-MAX_TURNS)
      .map((t) => ({
        id: t.id,
        question: t.question,
        steps: t.steps,
        sources: t.sources,
        final: t.final,
      })),
  };
}

/** Links are rebuilt from ids, never taken from storage: a stored URL could have been edited. */
function relinkCitation(c: Citation): Citation {
  const { url, embedUrl } = linksAt(c.episode.youtubeVideoId, c.timestamp.ms, c.timestamp.state);
  return {
    ...c,
    youtubeUrl: url,
    embedUrl,
    episode: { ...c.episode, audioUrl: httpsUrl(c.episode.audioUrl) },
  };
}

/** An answer from outside this page (storage, a share link) with every link rebuilt from ids. */
export function relinked(answer: FinalAnswer): FinalAnswer {
  return { ...answer, citations: answer.citations.map(relinkCitation) };
}

const isCount = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;

/**
 * Reads what was stored, treating it as untrusted input: every answer is re-validated against the
 * answer schema and re-linked; anything that doesn't fit is dropped. `null` = nothing usable.
 */
export function parseStored(raw: unknown): StoredTurn[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<StoredConversation>;
  if (o.version !== 1 || !Array.isArray(o.turns)) return null;
  const out: StoredTurn[] = [];
  for (const [i, t] of o.turns.slice(-MAX_TURNS).entries()) {
    if (!t || typeof t !== 'object') continue;
    const question = typeof t.question === 'string' ? t.question.trim() : '';
    const final = FinalAnswerSchema.safeParse(t.final);
    if (!question || question.length > LIMITS.questionChars || !final.success) continue;
    const steps = Array.isArray(t.steps)
      ? t.steps.flatMap((s) => {
          const step = AskStepSchema.safeParse(s?.step);
          return step.success && typeof s.message === 'string'
            ? [{ step: step.data, message: s.message.slice(0, 200) }]
            : [];
        })
      : [];
    const sources =
      t.sources && isCount(t.sources.passages) && isCount(t.sources.episodes)
        ? { passages: t.sources.passages, episodes: t.sources.episodes }
        : null;
    out.push({
      id: typeof t.id === 'string' && TURN_ID.test(t.id) ? t.id : `restored${i}`,
      question,
      steps,
      sources,
      final: relinked(final.data),
    });
  }
  return out;
}

/** Stored turns as the conversation reducer holds them, finished and ready to read. */
export function restoredTurns(stored: StoredTurn[]): Turn[] {
  return stored.map((s) => ({
    id: s.id,
    question: s.question,
    status: 'done',
    steps: s.steps,
    sources: s.sources,
    writingIndex: null,
    blocks: s.final.blocks,
    citations: Object.fromEntries(s.final.citations.map((c) => [c.id, c])),
    final: s.final,
    error: null,
    startedAt: 0,
    elapsedMs: s.final.elapsedMs,
  }));
}

// ------------------------------------------------------------------------------------ IndexedDB

export const MEMORY_DB = 'dear-steven-memory';
const STORE = 'conversation';
const KEY = 'current';

const promised = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Opens the database. With `create: false`, a database that doesn't exist yet is never made. */
function open(create: boolean): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MEMORY_DB, 1);
    req.onupgradeneeded = (e) => {
      if (!create && e.oldVersion === 0) {
        req.transaction?.abort(); // aborting the first upgrade leaves no database behind
        return;
      }
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => (create ? reject(req.error) : resolve(null));
  });
}

/** What was remembered, or `null` if memory was never switched on (or storage is blocked). */
export async function loadConversation(): Promise<StoredTurn[] | null> {
  try {
    const db = await open(false);
    if (!db) return null;
    try {
      const raw = await promised(db.transaction(STORE).objectStore(STORE).get(KEY));
      return parseStored(raw) ?? [];
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function saveConversation(conversation: StoredConversation): Promise<boolean> {
  try {
    const db = await open(true);
    if (!db) return false;
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(conversation, KEY);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      return true;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

/** Deletes the whole database — the conversation and the fact that memory was on. */
export async function forgetConversation(): Promise<boolean> {
  try {
    await promised(indexedDB.deleteDatabase(MEMORY_DB) as IDBRequest<unknown>);
    return true;
  } catch {
    return false;
  }
}

/** Whether this browser lets the page use IndexedDB at all (private modes may not). */
export function memorySupported(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}
