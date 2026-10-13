/**
 * What Dear Steven keeps about you, live (P7-08): five fictional profiles each ask one advice
 * question with their "about you" text attached. Needs OPENAI_API_KEY and a knowledge base; costs a
 * few cents.
 *
 *   pnpm eval:about
 *
 * Judged per answer: does it take the person's situation into account, and does it ever present
 * their profile as something a guest, a conversation or the show said? The usual integrity checks
 * (citations resolve, quotes match, attribution) run too. Results go to eval/results/ (gitignored).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { composeAnswer, openAIAnswerModel } from '@dear-steven/core/answer';
import { findRepoRoot, readConfig } from '@dear-steven/core/config';
import { answerCostUsd, embeddingCostUsd, MODELS } from '@dear-steven/core/models';
import { createOpenAI, moderate, openAIEmbedder } from '@dear-steven/core/openai';
import type { FinalAnswer } from '@dear-steven/core/schema';
import { KnowledgeStore } from '@dear-steven/core/store';
import { checkAnswer } from './lib/metrics.ts';

/** Invented people; nothing here is anyone's real words. */
const PROFILES = [
  {
    id: 'studio',
    about:
      'You run a small design studio in Leeds with four people. Your first client paid you in pizza.',
    question: 'Should I take on a big client who wants exclusivity?',
  },
  {
    id: 'nurse',
    about:
      'You were an ICU nurse for eleven years and now work as a product manager in health tech.',
    question: 'How do I stop feeling like a fraud at work?',
  },
  {
    id: 'founder',
    about:
      'You left a bank job to build a scheduling app for physio clinics. Your dad thinks it was reckless.',
    question: 'How do I deal with family who doubt my decision?',
  },
  {
    id: 'carpenter',
    about:
      'You are a carpenter with a workshop in Leipzig and a young daughter. You had back problems from overwork.',
    question: 'How do I grow my business without burning out?',
  },
  {
    id: 'student',
    about:
      'You are in your final year studying engineering and you have been offered a graduate job at a large firm.',
    question: 'Should I take the safe job or start something of my own?',
  },
];

const JUDGE = `You read one answer from an AI persona to a user whose profile you are given. "usesProfile": true if the answer clearly takes the user's own situation from the profile into account (refers to it, or tailors its advice to it), not just the question. "misattributed": every detail from the profile (about the user) that the answer presents as something a guest, a podcast conversation or the show said, each as {"detail": the profile detail, "as": the words that attribute it}; empty if none. Citing a conversation for a general idea is normal and is not misattribution: only the user's own details count. "note": one short sentence on how the profile was used, or "".`;

const root = findRepoRoot();
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
const config = readConfig(process.env, root);
if (!config.openaiApiKey) throw new Error('pnpm eval:about needs OPENAI_API_KEY in .env');
if (!existsSync(config.dbPath)) throw new Error('pnpm eval:about needs a knowledge base');
const client = createOpenAI(config.openaiApiKey);
let costUsd = 0;
const model = openAIAnswerModel(client, MODELS.answer, {
  onUsage: (usage) => {
    costUsd += answerCostUsd(usage);
  },
});
const embedder = openAIEmbedder(client, MODELS.embedding, {
  onTokens: (tokens) => {
    costUsd += embeddingCostUsd(tokens);
  },
});
const store = KnowledgeStore.open(config.dbPath);

const text = (f: FinalAnswer) =>
  f.blocks
    .map((b) => (b.kind === 'quote' ? `“${b.text}”` : b.segments.map((s) => s.text).join(' ')))
    .join('\n\n');

const results: {
  id: string;
  usesProfile: boolean;
  attributesProfile: boolean;
  misattributed?: { detail: string; as: string }[];
  answer?: string;
  note: string;
  integrity: string[];
  error?: string;
}[] = [];

for (const p of PROFILES) {
  try {
    let final: FinalAnswer | null = null;
    for await (const e of composeAnswer(
      { store, model, embedder, moderate: (t, s) => moderate(client, t, s) },
      { question: p.question, history: [], about: p.about },
      new AbortController().signal,
    )) {
      if (e.type === 'final') final = e.answer;
    }
    if (!final) throw new Error('no answer');
    const raw = await model.completeJson({
      instructions: JUDGE,
      input: [
        {
          role: 'user',
          content: `<profile>\n${p.about}\n</profile>\n\n<question>\n${p.question}\n</question>\n\n<answer>\n${text(final)}\n</answer>`,
        },
      ],
      format: {
        name: 'about_use',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['usesProfile', 'misattributed', 'note'],
          properties: {
            usesProfile: { type: 'boolean' },
            misattributed: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['detail', 'as'],
                properties: { detail: { type: 'string' }, as: { type: 'string' } },
              },
            },
            note: { type: 'string' },
          },
        },
      },
    });
    const j = JSON.parse(raw) as {
      usesProfile?: boolean;
      misattributed?: { detail: string; as: string }[];
      note?: string;
    };
    const check = checkAnswer(final, store);
    results.push({
      id: p.id,
      usesProfile: j.usesProfile === true,
      attributesProfile: (j.misattributed ?? []).length > 0,
      misattributed: j.misattributed ?? [],
      answer: text(final),
      note: String(j.note ?? '').slice(0, 200),
      integrity: [...check.problems, ...check.personaIssues],
    });
  } catch (error) {
    results.push({
      id: p.id,
      usesProfile: false,
      attributesProfile: false,
      note: '',
      integrity: [],
      error: error instanceof Error ? error.message : String(error),
    });
  }
  const r = results.at(-1);
  console.log(
    `${r?.error ? '✗' : '✓'} ${p.id}: ${r?.usesProfile ? 'uses the profile' : 'DOES NOT use the profile'} · ${r?.attributesProfile ? 'ATTRIBUTES IT TO A SOURCE' : 'never attributed'} · integrity ${r?.integrity.length ? r.integrity.join('; ') : 'ok'}${r?.error ? ` · ${r.error}` : ''}\n    ${r?.note}`,
  );
}

const uses = results.filter((r) => r.usesProfile).length;
const attributed = results.filter((r) => r.attributesProfile).length;
const integrity = results.filter((r) => r.integrity.length).length;
console.log(
  `\nuses the profile ${uses}/${results.length} · attributed to a source ${attributed} · integrity problems ${integrity} · estimated cost $${costUsd.toFixed(4)}`,
);
const dir = join(root, 'eval', 'results');
mkdirSync(dir, { recursive: true });
const file = join(dir, `about-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(file, JSON.stringify({ results, costUsd }, null, 2));
console.log(`results → ${file.slice(root.length + 1)}`);
store.close();
process.exitCode = uses === results.length && attributed === 0 && integrity === 0 ? 0 : 1;
