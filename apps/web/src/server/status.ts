import 'server-only';
import { existsSync } from 'node:fs';
import { readConfig } from '@dear-steven/core/config';
import type { KnowledgeStatus } from '@dear-steven/core/schema';
import { DEMO_EPISODE_COUNT } from '@/lib/demo-fixtures';

/** What the status pill and setup panel show. Never throws: a broken store is a status, not a crash. */
export function getKnowledgeStatus(): KnowledgeStatus {
  const config = readConfig();
  const database = existsSync(config.dbPath);
  const demo = config.mode === 'demo';
  return {
    mode: config.mode,
    demoReason: config.demoReason,
    episodes: demo ? DEMO_EPISODE_COUNT : 0,
    passages: 0,
    embeddedPassages: 0,
    diarizedEpisodes: 0,
    youtubeLinkedEpisodes: 0,
    lastIndexedAt: null,
    storeError: null,
    setup: {
      openaiKey: config.openaiApiKey !== null,
      youtubeKey: config.youtubeApiKey !== null,
      database,
    },
  };
}
