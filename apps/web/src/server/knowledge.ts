import 'server-only';
import { existsSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { type AnswerModel, type AnswerRecord, openAIAnswerModel } from '@dear-steven/core/answer';
import { type AppConfig, readConfig } from '@dear-steven/core/config';
import { createOpenAI, type Embedder, type OpenAI, openAIEmbedder } from '@dear-steven/core/openai';
import { KnowledgeStore } from '@dear-steven/core/store';

/**
 * Process-wide handles: one SQLite connection and one OpenAI client. Cached on globalThis so dev
 * hot-reloads don't leak connections. The store is opened read-mostly; the web app never creates
 * the database (the ingest CLI does).
 */
interface Handles {
  dbPath?: string;
  store?: KnowledgeStore;
  apiKey?: string;
  client?: OpenAI;
}

const g = globalThis as typeof globalThis & { __dearSteven?: Handles };
if (!g.__dearSteven) g.__dearSteven = {};
const handles: Handles = g.__dearSteven;

export function getStore(config: AppConfig = readConfig()): KnowledgeStore | null {
  if (handles.store && handles.dbPath === config.dbPath) return handles.store;
  if (!existsSync(config.dbPath)) return null;
  handles.store?.close();
  handles.store = KnowledgeStore.open(config.dbPath);
  handles.dbPath = config.dbPath;
  return handles.store;
}

function client(config: AppConfig): OpenAI | null {
  if (!config.openaiApiKey) return null;
  if (!handles.client || handles.apiKey !== config.openaiApiKey) {
    handles.client = createOpenAI(config.openaiApiKey);
    handles.apiKey = config.openaiApiKey;
  }
  return handles.client;
}

export function getOpenAI(config: AppConfig = readConfig()): OpenAI | null {
  return client(config);
}

export function getAnswerModel(config: AppConfig = readConfig()): AnswerModel | null {
  const c = client(config);
  return c ? openAIAnswerModel(c) : null;
}

export function getEmbedder(config: AppConfig = readConfig()): Embedder | null {
  const c = client(config);
  return c ? openAIEmbedder(c) : null;
}

/** With DEAR_STEVEN_LOG_ANSWERS=1, appends each answer to data/answers.jsonl for the eval harness. */
export function answerLogger(
  config: AppConfig = readConfig(),
): ((r: AnswerRecord) => void) | undefined {
  if (!config.logAnswers) return undefined;
  const file = join(dirname(config.dbPath), 'answers.jsonl');
  return (record) => {
    appendFile(file, `${JSON.stringify({ at: new Date().toISOString(), ...record })}\n`).catch(
      (e: unknown) =>
        console.error('[ask] could not write answer log', e instanceof Error ? e.message : e),
    );
  };
}
