#!/usr/bin/env node
/**
 * `pnpm eval`            retrieval: recall@10 on the seed set (works with keyword search alone)
 *
 * Results go to eval/results/<timestamp>.json (gitignored). Exit code 1 when a threshold is missed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { findRepoRoot, readConfig } from '@dear-steven/core/config';
import { createOpenAI, openAIEmbedder } from '@dear-steven/core/openai';
import { hybridSearch } from '@dear-steven/core/retrieval';
import { KnowledgeStore } from '@dear-steven/core/store';
import { recallAt } from './lib/metrics.ts';

interface Question {
  id: string;
  question: string;
  expect?: string[];
  unanswerable?: boolean;
  topic: string;
}

const THRESHOLDS = {
  recallAt10: 0.8,
  citationsResolve: 1,
  attributionViolations: 0,
  ttfbP50Ms: 3000,
};

const root = findRepoRoot();
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
const config = readConfig(process.env, root);
const { values } = parseArgs({ options: { only: { type: 'string' } } });

const set = JSON.parse(readFileSync(join(root, 'eval', 'questions.json'), 'utf8')) as {
  questions: Question[];
};
const only = values.only?.split(',');
const questions = set.questions.filter((q) => !only || only.includes(q.id));

const store = KnowledgeStore.open(config.dbPath);
const client = config.openaiApiKey ? createOpenAI(config.openaiApiKey) : null;
const embedder = client ? openAIEmbedder(client) : null;
const indexedGuids = new Set(
  store
    .listEpisodes()
    .filter((e) => e.indexedAt)
    .map((e) => e.sourceGuid),
);

// ---------------------------------------------------------------- retrieval
const retrieval: { id: string; hit: boolean | null; top: string[] }[] = [];
for (const q of questions.filter((x) => x.expect)) {
  const expected = (q.expect ?? []).filter((g) => indexedGuids.has(g));
  const result = await hybridSearch(store, q.question, embedder, { take: 10 });
  const guids = result.passages.map((p) => p.episode.sourceGuid);
  const hit = expected.length ? recallAt(10, guids, expected) : null;
  retrieval.push({
    id: q.id,
    hit,
    top: [
      ...new Set(
        result.passages.map((p) => p.episode.guestNames[0] ?? p.episode.title.slice(0, 24)),
      ),
    ],
  });
  console.log(
    `${hit === null ? '–' : hit ? '✓' : '✗'} ${q.id} ${q.question}\n    ${retrieval.at(-1)?.top.slice(0, 4).join(' · ')}`,
  );
}
const scored = retrieval.filter((r) => r.hit !== null);
const recall = scored.length ? scored.filter((r) => r.hit).length / scored.length : 0;
console.log(
  `\nrecall@10 ${(recall * 100).toFixed(0)}% over ${scored.length} questions (${retrieval.length - scored.length} skipped: episode not indexed) · search: ${embedder && store.hasEmbeddings() ? 'hybrid' : 'keyword only'}`,
);
const failed = scored.length > 0 && recall < THRESHOLDS.recallAt10;

const dir = join(root, 'eval', 'results');
mkdirSync(dir, { recursive: true });
const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(file, JSON.stringify({ thresholds: THRESHOLDS, recall, retrieval }, null, 2));
console.log(`\nresults → ${file.slice(root.length + 1)}`);
store.close();
process.exitCode = failed ? 1 : 0;
