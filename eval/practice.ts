/**
 * Practice mode, live (P7-07): five scripted visitors (one deliberately vague) each take a
 * six-question practice interview and get a debrief. Needs OPENAI_API_KEY; costs a few cents.
 *
 *   pnpm eval:practice
 *
 * Checked: every question keeps the rules; every quoted phrase in the debrief is verbatim from the
 * answers (the core check drops any that aren't; here we confirm what is left); the vague visitor
 * scores lowest on specificity; and each rewrite keeps the facts given and adds none (judged by the
 * answer model; a person spot-checks the saved results). Results go to eval/results/ (gitignored).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openAIAnswerModel } from '@dear-steven/core/answer';
import { findRepoRoot, readConfig } from '@dear-steven/core/config';
import { interviewStep, questionProblems } from '@dear-steven/core/interview';
import { answerCostUsd, MODELS } from '@dear-steven/core/models';
import { createOpenAI, moderate } from '@dear-steven/core/openai';
import type { Debrief, InterviewSetup, InterviewTurn } from '@dear-steven/core/schema';
import { KnowledgeStore } from '@dear-steven/core/store';

interface Persona {
  id: string;
  setup: InterviewSetup;
  answers: string[];
}

const VAGUE = 'vague';

const FACTS_INSTRUCTIONS = `You check a rewrite of one answer against everything the person said in an interview (<answers>, the rewritten one marked). List every factual claim the rewrite makes (numbers, names, places, results, causes, lessons, opinions) in "claims", each with "source": the answer it comes from ("A1", "A2", …), or "none" if no answer says it. Rephrasing, reordering and tightening something they said keep its source: a claim that restates their words in other grammar still comes from that answer. Only a claim no answer makes, or a causal link no answer draws, is "none". "keepsFacts": true if every claim with a source states it as the answer does. "note": one short sentence naming any claim with no source, or "".`;

const root = findRepoRoot();
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
const config = readConfig(process.env, root);
if (!config.openaiApiKey) throw new Error('pnpm eval:practice needs OPENAI_API_KEY in .env');
const client = createOpenAI(config.openaiApiKey);
let costUsd = 0;
const model = openAIAnswerModel(client, MODELS.answer, {
  onUsage: (usage) => {
    costUsd += answerCostUsd(usage);
  },
});
const store = existsSync(config.dbPath) ? KnowledgeStore.open(config.dbPath) : null;
const signal = new AbortController().signal;
const { personas } = JSON.parse(
  readFileSync(join(root, 'eval', 'practice-personas.json'), 'utf8'),
) as { personas: Persona[] };

async function judgeRewrite(answers: string[], turn: number, rewrite: string) {
  const said = answers
    .map((a, i) => `A${i + 1}${i === turn ? ' (the one rewritten)' : ''}: ${a}`)
    .join('\n');
  const raw = await model.completeJson({
    instructions: FACTS_INSTRUCTIONS,
    input: [
      {
        role: 'user',
        content: `<answers>\n${said}\n</answers>\n\n<rewrite>\n${rewrite}\n</rewrite>`,
      },
    ],
    format: {
      name: 'facts',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['claims', 'keepsFacts', 'note'],
        properties: {
          claims: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['claim', 'source'],
              properties: { claim: { type: 'string' }, source: { type: 'string' } },
            },
          },
          keepsFacts: { type: 'boolean' },
          note: { type: 'string' },
        },
      },
    },
  });
  const j = JSON.parse(raw) as {
    claims?: { claim: string; source: string }[];
    keepsFacts?: boolean;
    note?: string;
  };
  const unsourced = (j.claims ?? []).filter((c) => !/^A\d+$/.test(c.source.trim()));
  return {
    keepsFacts: j.keepsFacts === true,
    addsFacts: unsourced.length > 0,
    note:
      unsourced
        .map((c) => c.claim)
        .join('; ')
        .slice(0, 200) || String(j.note ?? '').slice(0, 200),
  };
}

const runs: {
  id: string;
  questions: { question: string; stage: string; problems: string[] }[];
  debrief: Debrief | null;
  quotesVerbatim: boolean;
  rewrite?: { keepsFacts: boolean; addsFacts: boolean; note: string };
  error?: string;
}[] = [];

for (const p of personas) {
  const run: (typeof runs)[number] = {
    id: p.id,
    questions: [],
    debrief: null,
    quotesVerbatim: true,
  };
  runs.push(run);
  const turns: InterviewTurn[] = [];
  try {
    for (const answer of p.answers) {
      const reply = await interviewStep(
        { model, store, moderate: (text, s) => moderate(client, text, s) },
        { setup: p.setup, turns, action: 'next', uiLocale: 'en' },
        signal,
      );
      if (reply.type !== 'question') throw new Error(`expected a question, got ${reply.type}`);
      run.questions.push({
        question: reply.question,
        stage: reply.stage,
        problems: questionProblems(reply.question),
      });
      turns.push({ question: reply.question, stage: reply.stage, answer });
    }
    const end = await interviewStep(
      { model, store },
      { setup: p.setup, turns, action: 'next', uiLocale: 'en' },
      signal,
    );
    if (end.type !== 'debrief') throw new Error(`expected a debrief, got ${end.type}`);
    run.debrief = end.debrief;
    run.quotesVerbatim = [...end.debrief.strengths, ...end.debrief.improvements].every((x) =>
      p.answers[x.turn]?.includes(x.evidence),
    );
    const rw = end.debrief.rewrite;
    if (rw) run.rewrite = await judgeRewrite(p.answers, rw.turn, rw.answer);
  } catch (error) {
    run.error = error instanceof Error ? error.message : String(error);
  }
  const d = run.debrief;
  console.log(
    `${run.error ? '✗' : '✓'} ${p.id}: specificity ${d?.scores.specificity ?? '–'} · clarity ${d?.scores.clarity ?? '–'} · story ${d?.scores.story ?? '–'} · brevity ${d?.scores.brevity ?? '–'} · ${d ? d.strengths.length + d.improvements.length : 0} points${run.quotesVerbatim ? ', quotes verbatim' : ', QUOTES NOT VERBATIM'} · rewrite ${d?.rewrite ? (run.rewrite?.addsFacts || !run.rewrite?.keepsFacts ? `CHANGES FACTS (${run.rewrite?.note})` : 'keeps the facts') : 'none'} · weakest ${d?.weakest === null || d === null ? '–' : `A${d.weakest + 1}`}${run.error ? ` · ${run.error}` : ''}`,
  );
  if (d) console.log(`    “${d.headline}”`);
}

const specificity = (id: string) => runs.find((r) => r.id === id)?.debrief?.scores.specificity ?? 0;
const others = runs.filter((r) => r.id !== VAGUE && r.debrief).map((r) => specificity(r.id));
const vagueLowest = others.length > 0 && others.every((s) => specificity(VAGUE) < s);
const ruleBreaks = runs.flatMap((r) => r.questions).filter((q) => q.problems.length).length;
const rewrites = runs.filter((r) => r.rewrite);
const rewritesClean = rewrites.filter((r) => r.rewrite?.keepsFacts && !r.rewrite.addsFacts).length;
const failed =
  runs.some((r) => r.error || !r.quotesVerbatim) ||
  !vagueLowest ||
  ruleBreaks > 0 ||
  rewritesClean < rewrites.length;
console.log(
  `\nvague lowest on specificity ${vagueLowest ? 'yes' : 'NO'} (${specificity(VAGUE)} vs ${others.join(', ')}) · quotes verbatim ${runs.every((r) => r.quotesVerbatim) ? 'yes' : 'no'} · rewrites keep the facts ${rewritesClean}/${rewrites.length} · rule breaks ${ruleBreaks} · estimated cost $${costUsd.toFixed(4)}`,
);

const dir = join(root, 'eval', 'results');
mkdirSync(dir, { recursive: true });
const file = join(dir, `practice-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(file, JSON.stringify({ runs, vagueLowest, costUsd }, null, 2));
console.log(`results → ${file.slice(root.length + 1)}`);
store?.close();
process.exitCode = failed ? 1 : 0;
