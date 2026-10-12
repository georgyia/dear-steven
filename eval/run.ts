#!/usr/bin/env node
/**
 * `pnpm eval`            retrieval: recall@10 on the seed set (works with keyword search alone)
 * `pnpm eval --answers`  full answers through the real pipeline (needs OPENAI_API_KEY; costs cents)
 *
 * Results go to eval/results/<timestamp>.json (gitignored). Exit code 1 when a threshold is missed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { type AnswerRecord, composeAnswer, openAIAnswerModel } from '@dear-steven/core/answer';
import { findRepoRoot, readConfig } from '@dear-steven/core/config';
import { answerCostUsd, embeddingCostUsd, MODELS } from '@dear-steven/core/models';
import { createOpenAI, openAIEmbedder } from '@dear-steven/core/openai';
import { hybridSearch } from '@dear-steven/core/retrieval';
import type { FinalAnswer } from '@dear-steven/core/schema';
import { KnowledgeStore } from '@dear-steven/core/store';
import { checkAnswer, median, recallAt } from './lib/metrics.ts';

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
const { values } = parseArgs({
  options: { answers: { type: 'boolean', default: false }, only: { type: 'string' } },
});

const set = JSON.parse(readFileSync(join(root, 'eval', 'questions.json'), 'utf8')) as {
  questions: Question[];
};
const only = values.only?.split(',');
const questions = set.questions.filter((q) => !only || only.includes(q.id));

const store = KnowledgeStore.open(config.dbPath);
const client = config.openaiApiKey ? createOpenAI(config.openaiApiKey) : null;
/** What this run spent, estimated from reported token use (core `PRICES`). */
let costUsd = 0;
const embedder = client
  ? openAIEmbedder(client, MODELS.embedding, {
      onTokens: (tokens) => {
        costUsd += embeddingCostUsd(tokens);
      },
    })
  : null;
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
let failed = scored.length > 0 && recall < THRESHOLDS.recallAt10;

// ------------------------------------------------------------------ answers
const answers: {
  id: string;
  ttfbMs: number | null;
  final: FinalAnswer | null;
  record: AnswerRecord | null;
  check: ReturnType<typeof checkAnswer> | null;
  error?: string;
}[] = [];
if (values.answers) {
  if (!client) throw new Error('--answers needs OPENAI_API_KEY in .env');
  const model = openAIAnswerModel(client, MODELS.answer, {
    onUsage: (usage) => {
      costUsd += answerCostUsd(usage);
    },
  });
  for (const q of questions) {
    const t0 = Date.now();
    let ttfb: number | null = null;
    let final: FinalAnswer | null = null;
    let record: AnswerRecord | null = null;
    let error: string | undefined;
    try {
      for await (const e of composeAnswer(
        { store, model, embedder, onComplete: (r) => (record = r) },
        { question: q.question, history: [] },
        new AbortController().signal,
      )) {
        if (e.type === 'block.done' && ttfb === null) ttfb = Date.now() - t0;
        if (e.type === 'final') final = e.answer;
        if (e.type === 'error') error = e.message;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const check = final ? checkAnswer(final, store) : null;
    answers.push({ id: q.id, ttfbMs: ttfb, final, record, check, error });
    const ok =
      check?.citationsResolve &&
      check.quotesMatch &&
      check.attributionOk &&
      check.personaIssues.length === 0 &&
      (!q.unanswerable || (final?.mode === 'insufficient' && final.citations.length === 0));
    console.log(
      `${ok ? '✓' : '✗'} ${q.id} ${final?.mode ?? 'error'} · ${final?.citations.length ?? 0} citations · first block ${ttfb ?? '—'}ms${error ? ` · ${error}` : ''}${check?.problems.length ? `\n    ${check.problems.join('\n    ')}` : ''}${check?.personaIssues.length ? `\n    persona: ${check.personaIssues.join(', ')}` : ''}`,
    );
  }
  const done = answers.filter((a) => a.check);
  const resolveRate = done.length
    ? done.filter((a) => a.check?.citationsResolve).length / done.length
    : 0;
  const attributionViolations = done.filter((a) => !a.check?.attributionOk).length;
  const quoteFailures = done.filter((a) => !a.check?.quotesMatch).length;
  const personaFailures = done.filter((a) => a.check?.personaIssues.length).length;
  const unanswerable = questions.filter((q) => q.unanswerable);
  const honest = unanswerable.filter((q) => {
    const a = answers.find((x) => x.id === q.id);
    return a?.final?.mode === 'insufficient' && a.final.citations.length === 0;
  }).length;
  const ttfbP50 = median(answers.flatMap((a) => (a.ttfbMs === null ? [] : [a.ttfbMs])));
  const preRepair = answers.reduce((n, a) => n + (a.record?.violations.length ?? 0), 0);
  console.log(
    `\ncitations resolve ${(resolveRate * 100).toFixed(0)}% · attribution violations ${attributionViolations} · quote mismatches ${quoteFailures} · persona lint ${personaFailures} · unanswerable handled ${honest}/${unanswerable.length} · first block p50 ${Math.round(ttfbP50)}ms · violations caught before display ${preRepair}`,
  );
  failed ||=
    resolveRate < THRESHOLDS.citationsResolve ||
    attributionViolations > THRESHOLDS.attributionViolations ||
    quoteFailures > 0 ||
    personaFailures > 0 ||
    honest < unanswerable.length ||
    ttfbP50 > THRESHOLDS.ttfbP50Ms;
}

const dir = join(root, 'eval', 'results');
mkdirSync(dir, { recursive: true });
const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(
  file,
  JSON.stringify({ thresholds: THRESHOLDS, recall, retrieval, answers, costUsd }, null, 2),
);
if (costUsd > 0) console.log(`\nestimated cost of this run: $${costUsd.toFixed(4)}`);
console.log(`\nresults → ${file.slice(root.length + 1)}`);
store.close();
process.exitCode = failed ? 1 : 0;
