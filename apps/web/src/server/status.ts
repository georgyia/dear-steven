import 'server-only';
import { existsSync } from 'node:fs';
import { readConfig } from '@dear-steven/core/config';
import type { KnowledgeStatus } from '@dear-steven/core/schema';
import { DEMO_EPISODE_COUNT } from '@/lib/demo-fixtures';
import { getStore } from './knowledge';
import { spendStatus } from './spend';

/** What the status pill and setup panel show. Never throws: a broken store is a status, not a crash. */
export function getKnowledgeStatus(): KnowledgeStatus {
  const config = readConfig();
  const database = existsSync(config.dbPath);
  const base = {
    mode: config.mode,
    demoReason: config.demoReason,
    spend: spendStatus(config),
    setup: {
      openaiKey: config.openaiApiKey !== null,
      youtubeKey: config.youtubeApiKey !== null,
      database,
    },
  };
  const empty = {
    episodes: 0,
    passages: 0,
    embeddedPassages: 0,
    diarizedEpisodes: 0,
    youtubeLinkedEpisodes: 0,
    lastIndexedAt: null,
    storeError: null,
  };

  if (config.mode === 'demo') return { ...base, ...empty, episodes: DEMO_EPISODE_COUNT };
  if (!database) return { ...base, ...empty };
  try {
    const stats = getStore(config)?.stats();
    return { ...base, ...empty, ...(stats ?? {}) };
  } catch (error) {
    console.error(
      '[status] knowledge base unavailable',
      error instanceof Error ? error.message : error,
    );
    return {
      ...base,
      ...empty,
      storeError: error instanceof Error ? error.message.slice(0, 200) : 'unknown error',
    };
  }
}
