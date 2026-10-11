import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { type AppConfig, findRepoRoot, readConfig, requireKey } from '@dear-steven/core/config';
import { createOpenAI, type OpenAI } from '@dear-steven/core/openai';
import { KnowledgeStore } from '@dear-steven/core/store';

export interface Context {
  root: string;
  config: AppConfig;
  store: KnowledgeStore;
  /** Lazily created; throws a readable error when OPENAI_API_KEY is missing. */
  openai: () => OpenAI;
  dataDir: string;
}

/**
 * Loads the env file (`.env` at the repo root, or `DEAR_STEVEN_ENV_FILE`) with Node's built-in loader —
 * shell variables win — then opens the store.
 */
export function createContext(): Context {
  const root = findRepoRoot();
  const { envFile } = readConfig(process.env, root);
  if (existsSync(envFile)) {
    const before = { ...process.env };
    process.loadEnvFile(envFile);
    for (const [k, v] of Object.entries(before)) if (v !== undefined) process.env[k] = v;
  }
  const config = readConfig(process.env, root);
  const store = KnowledgeStore.open(config.dbPath, { create: true });
  let client: OpenAI | null = null;
  return {
    root,
    config,
    store,
    dataDir: join(config.dbPath, '..'),
    openai: () => {
      client ??= createOpenAI(requireKey('OPENAI_API_KEY', config.openaiApiKey));
      return client;
    },
  };
}
