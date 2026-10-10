#!/usr/bin/env node
// Phase 0 stub: the stages below arrive in Phase 2 (plan/04-issues/phase-2.md, docs/INGESTION.md).
const STAGES = [
  'discover        read the official RSS feed into the episode table',
  'match-youtube   link episodes to their YouTube videos',
  'transcribe      --from vtt (free) | --diarize --budget <usd> (paid)',
  'chunk           speaker-turn-aware passages',
  'index           embeddings for semantic search',
  'status          what is indexed and what to run next',
  'align           correct a video link or its timing',
  'purge           remove an episode for takedown requests',
];
console.log(`pnpm ingest <stage> — not implemented yet. Planned stages:\n  ${STAGES.join('\n  ')}`);
