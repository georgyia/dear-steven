/**
 * Interview mode, live (P7-06): five scripted visitors each take a six-question interview, and we
 * measure what the acceptance criteria name. Needs OPENAI_API_KEY; costs a few cents.
 *
 *   pnpm eval:interviews
 *
 * Per question: one question, under 40 words, in the visitor's language (checked in code), and,
 * after the first, whether it picks up something specific from the previous answer (judged by the
 * answer model; a person spot-checks the saved transcripts). At the end, every "what I learned" line
 * must quote the visitor verbatim. Results go to eval/results/ (gitignored): they hold the scripted
 * answers and the model's questions, nothing real.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openAIAnswerModel } from '@dear-steven/core/answer';
import { findRepoRoot, readConfig } from '@dear-steven/core/config';
import { interviewStep, questionProblems } from '@dear-steven/core/interview';
import { detectLanguage } from '@dear-steven/core/language';
import { answerCostUsd, MODELS } from '@dear-steven/core/models';
import { createOpenAI, moderate } from '@dear-steven/core/openai';
import type { InterviewSetup, InterviewTurn, LearnedLine } from '@dear-steven/core/schema';
import { KnowledgeStore } from '@dear-steven/core/store';

interface Persona {
  id: string;
  language: string;
  uiLocale?: 'en' | 'de';
  setup: InterviewSetup;
  answers: string[];
}

const THRESHOLDS = {
  /** Questions after the first that pick up something from the previous answer. */
  buildsOnAnswer: 0.9,
};

const REFERS_INSTRUCTIONS = `You check one interviewer's question against the guest's previous answer. "refers" is true only if the question explicitly picks up something specific the guest said in that answer: a detail, a word, a person, a place, an event or a feeling. A question that could follow any answer is false. When the answer is very short, building on its one fact counts. "what": the detail picked up, in a few words, or "" if none.`;

const root = findRepoRoot();
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
const config = readConfig(process.env, root);
if (!config.openaiApiKey) throw new Error('pnpm eval:interviews needs OPENAI_API_KEY in .env');
const client = createOpenAI(config.openaiApiKey);
let costUsd = 0;
const model = openAIAnswerModel(client, MODELS.answer, {
  onUsage: (usage) => {
    costUsd += answerCostUsd(usage);
  },
});
const store = existsSync(config.dbPath) ? KnowledgeStore.open(config.dbPath) : null;
const signal = new AbortController().signal;
const { personas } = JSON.parse(readFileSync(join(root, 'eval', 'personas.json'), 'utf8')) as {
  personas: Persona[];
};

async function refers(answer: string, question: string) {
  const raw = await model.completeJson({
    instructions: REFERS_INSTRUCTIONS,
    input: [
      {
        role: 'user',
        content: `<previous_answer>\n${answer}\n</previous_answer>\n\n<question>\n${question}\n</question>`,
      },
    ],
    format: {
      name: 'refers',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['refers', 'what'],
        properties: { refers: { type: 'boolean' }, what: { type: 'string' } },
      },
    },
  });
  const j = JSON.parse(raw) as { refers?: boolean; what?: string };
  return { refers: j.refers === true, what: String(j.what ?? '').slice(0, 120) };
}

const runs: {
  id: string;
  questions: {
    question: string;
    stage: string;
    problems: string[];
    language: string;
    refers?: boolean;
    what?: string;
  }[];
  learned: LearnedLine[];
  learnedVerbatim: boolean;
  error?: string;
}[] = [];

for (const p of personas) {
  const turns: InterviewTurn[] = [];
  const run: (typeof runs)[number] = {
    id: p.id,
    questions: [],
    learned: [],
    learnedVerbatim: true,
  };
  runs.push(run);
  try {
    for (const answer of p.answers) {
      const reply = await interviewStep(
        { model, store, moderate: (text, s) => moderate(client, text, s) },
        { setup: { ...p.setup, length: 6 }, turns, action: 'next', uiLocale: p.uiLocale ?? 'en' },
        signal,
      );
      if (reply.type !== 'question') throw new Error(`expected a question, got ${reply.type}`);
      const previous = turns.at(-1);
      const judged = previous ? await refers(previous.answer, reply.question) : undefined;
      run.questions.push({
        question: reply.question,
        stage: reply.stage,
        problems: questionProblems(reply.question),
        language: detectLanguage(reply.question),
        ...judged,
      });
      turns.push({ question: reply.question, stage: reply.stage, answer });
    }
    const end = await interviewStep(
      { model, store },
      { setup: { ...p.setup, length: 6 }, turns, action: 'next', uiLocale: p.uiLocale ?? 'en' },
      signal,
    );
    if (end.type !== 'learned') throw new Error(`expected what I learned, got ${end.type}`);
    run.learned = end.lines;
    run.learnedVerbatim = end.lines.every((l) => p.answers[l.turn]?.includes(l.evidence));
  } catch (error) {
    run.error = error instanceof Error ? error.message : String(error);
  }
  const followUps = run.questions.slice(1);
  console.log(
    `${run.error ? '✗' : '✓'} ${p.id}: ${run.questions.length} questions, ${followUps.filter((q) => q.refers).length}/${followUps.length} build on the last answer, ${run.questions.filter((q) => q.problems.length).length} break a rule, ${run.questions.filter((q) => q.language !== p.language).length} in another language; ${run.learned.length} learned lines${run.learnedVerbatim ? ', all verbatim' : ', NOT verbatim'}${run.error ? ` · ${run.error}` : ''}`,
  );
  for (const q of run.questions) {
    console.log(`    [${q.stage}] ${q.question}${q.refers === false ? '   ← generic' : ''}`);
  }
}

const followUps = runs.flatMap((r) => r.questions.slice(1));
const buildsRate = followUps.length
  ? followUps.filter((q) => q.refers).length / followUps.length
  : 0;
const ruleBreaks = runs.flatMap((r) => r.questions).filter((q) => q.problems.length).length;
const wrongLanguage = runs
  .flatMap((r) =>
    r.questions.map((q) => ({ q, lang: personas.find((p) => p.id === r.id)?.language })),
  )
  .filter(({ q, lang }) => q.language !== lang).length;
const failed =
  runs.some((r) => r.error || !r.learnedVerbatim) ||
  buildsRate < THRESHOLDS.buildsOnAnswer ||
  ruleBreaks > 0 ||
  wrongLanguage > 0;
console.log(
  `\nbuild on the last answer ${(buildsRate * 100).toFixed(0)}% (${followUps.filter((q) => q.refers).length}/${followUps.length}) · rule breaks ${ruleBreaks} · wrong language ${wrongLanguage} · learned lines verbatim ${runs.every((r) => r.learnedVerbatim) ? 'yes' : 'no'} · estimated cost $${costUsd.toFixed(4)}`,
);

const dir = join(root, 'eval', 'results');
mkdirSync(dir, { recursive: true });
const file = join(dir, `interviews-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(file, JSON.stringify({ thresholds: THRESHOLDS, runs, buildsRate, costUsd }, null, 2));
console.log(`results → ${file.slice(root.length + 1)}`);
store?.close();
process.exitCode = failed ? 1 : 0;
