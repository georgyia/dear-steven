/**
 * Conversation summaries, live (P8-03): reads the summaries `pnpm ingest summarise` stored, checks
 * every one of them again in code, and has a judge read ten of them against their transcripts.
 * Needs OPENAI_API_KEY and a summarised knowledge base; costs a few cents.
 *
 *   pnpm eval:summaries
 *
 * In code, for every stored summary: each moment, question and answer is still a span of its
 * passage, at a time inside it; and the counts of topics, moments and exchanges. Judged, for ten
 * episodes spread across the knowledge base: is the overview faithful to the transcript (every
 * claim in it supported) and free of who-said-what; are the topics right; are the moments
 * interesting, and none of them an advert; does each answer answer its question. Results go to
 * eval/results/ (gitignored).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openAIAnswerModel } from '@dear-steven/core/answer';
import { findRepoRoot, readConfig } from '@dear-steven/core/config';
import { answerCostUsd, MODELS } from '@dear-steven/core/models';
import { createOpenAI } from '@dear-steven/core/openai';
import { type ConversationSummary, SUMMARY_VERSION } from '@dear-steven/core/schema';
import { KnowledgeStore } from '@dear-steven/core/store';

const JUDGED = 10;

const JUDGE = `You check a machine-written summary of one podcast conversation against its full transcript. The transcript does not say who is speaking.
- "aboutFaithful": true if every claim in "about" is supported by the transcript.
- "unsupported": each claim in "about" the transcript does not support, in a few words; empty if none.
- "aboutAttributes": true if "about" says who said or thinks something (a guest, the host, "he", "she") rather than describing the ideas.
- "topics": 1 to 5, how well the topics cover what the conversation is really about, in order.
- "moments": 1 to 5, how interesting and worth remembering the moments are.
- "advertMoments": the label, exactly as given, of each moment in the summary that is itself an advert, a sponsor read or a request to follow or subscribe; empty if none. Adverts elsewhere in the transcript don't count.
- "exchanges": for each exchange in order, true if the answer really answers the question.
- "usefulness": 1 to 5, how much the summary helps someone decide whether to watch, or recall what was said.
- "note": one short sentence on the summary's main strength or weakness.`;

const root = findRepoRoot();
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
const config = readConfig(process.env, root);
if (!config.openaiApiKey) throw new Error('pnpm eval:summaries needs OPENAI_API_KEY in .env');
if (!existsSync(config.dbPath)) throw new Error('pnpm eval:summaries needs a knowledge base');
const client = createOpenAI(config.openaiApiKey);
let costUsd = 0;
const model = openAIAnswerModel(client, MODELS.answer, {
  onUsage: (usage) => {
    costUsd += answerCostUsd(usage);
  },
});
const store = KnowledgeStore.open(config.dbPath);

// In code, for every stored summary.
const all = store.browseIndexed({ limit: 10_000, offset: 0 }).episodes;
const summaries = all
  .map((e) => ({ episode: e, summary: store.conversationSummary(e.id) }))
  .filter((x): x is { episode: (typeof all)[number]; summary: ConversationSummary } =>
    Boolean(x.summary && x.summary.version === SUMMARY_VERSION),
  );
if (summaries.length === 0) throw new Error('No summaries yet: run pnpm ingest summarise first.');

const integrity: string[] = [];
for (const { episode, summary } of summaries) {
  const spans = [...summary.moments, ...summary.exchanges.flatMap((x) => [x.question, x.answer])];
  for (const span of spans) {
    const passage = store.getPassage(span.passageId);
    if (!passage || passage.episode.id !== episode.id) {
      integrity.push(`${episode.id}: ${span.passageId} is not one of its passages`);
    } else if (!passage.text.includes(span.text)) {
      integrity.push(`${episode.id}: "${span.text.slice(0, 40)}" is not in ${span.passageId}`);
    } else if (span.startMs < passage.startMs || span.startMs > passage.endMs) {
      integrity.push(`${episode.id}: a span starts outside ${span.passageId}`);
    }
  }
}
const average = (pick: (s: ConversationSummary) => number) =>
  summaries.reduce((n, x) => n + pick(x.summary), 0) / summaries.length;
const counts = {
  episodes: summaries.length,
  indexed: all.length,
  withAbout: summaries.filter((x) => x.summary.about).length,
  topics: average((s) => s.topics.length),
  moments: average((s) => s.moments.length),
  exchanges: average((s) => s.exchanges.length),
};

// Judged, for ten episodes spread across them.
const step = Math.max(1, Math.floor(summaries.length / JUDGED));
const sample = summaries.filter((_, i) => i % step === 0).slice(0, JUDGED);

interface Verdict {
  aboutFaithful: boolean;
  unsupported: string[];
  aboutAttributes: boolean;
  topics: number;
  moments: number;
  advertMoments: string[];
  exchanges: boolean[];
  usefulness: number;
  note: string;
}
const results: { id: string; title: string; verdict?: Verdict; error?: string }[] = [];

for (const { episode, summary } of sample) {
  try {
    const transcript = store
      .episodePassages(episode.id)
      .map((p) => p.text)
      .join('\n\n');
    const shown = {
      about: summary.about,
      topics: summary.topics.map((t) => t.title),
      moments: summary.moments.map((m) => ({ label: m.label, quote: m.text })),
      exchanges: summary.exchanges.map((x) => ({
        question: x.question.text,
        answer: x.answer.text,
      })),
    };
    const raw = await model.completeJson({
      instructions: JUDGE,
      input: [
        {
          role: 'user',
          content: `<transcript>\n${transcript}\n</transcript>\n\n<summary>\n${JSON.stringify(shown, null, 2)}\n</summary>`,
        },
      ],
      format: {
        name: 'summary_verdict',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: [
            'aboutFaithful',
            'unsupported',
            'aboutAttributes',
            'topics',
            'moments',
            'advertMoments',
            'exchanges',
            'usefulness',
            'note',
          ],
          properties: {
            aboutFaithful: { type: 'boolean' },
            unsupported: { type: 'array', items: { type: 'string' } },
            aboutAttributes: { type: 'boolean' },
            topics: { type: 'integer' },
            moments: { type: 'integer' },
            advertMoments: { type: 'array', items: { type: 'string' } },
            exchanges: { type: 'array', items: { type: 'boolean' } },
            usefulness: { type: 'integer' },
            note: { type: 'string' },
          },
        },
      },
    });
    const verdict = JSON.parse(raw) as Verdict;
    // Only labels that really are this summary's moments count.
    verdict.advertMoments = verdict.advertMoments.filter((label) =>
      summary.moments.some((m) => m.label === label),
    );
    results.push({ id: episode.id, title: episode.title, verdict });
  } catch (error) {
    results.push({
      id: episode.id,
      title: episode.title,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  const r = results.at(-1);
  const v = r?.verdict;
  console.log(
    v
      ? `✓ ${episode.title.slice(0, 60)}\n    about ${v.aboutFaithful ? 'faithful' : `UNSUPPORTED: ${v.unsupported.join('; ')}`}${v.aboutAttributes ? ', ATTRIBUTES' : ''}; topics ${v.topics}/5, moments ${v.moments}/5, adverts ${v.advertMoments.length ? v.advertMoments.join('; ') : 0}, exchanges ${v.exchanges.filter(Boolean).length}/${v.exchanges.length} answered, useful ${v.usefulness}/5\n    ${v.note}`
      : `✗ ${episode.title.slice(0, 60)}: ${r?.error}`,
  );
}

const judged = results.flatMap((r) => (r.verdict ? [r.verdict] : []));
const mean = (pick: (v: Verdict) => number) =>
  judged.length ? judged.reduce((n, v) => n + pick(v), 0) / judged.length : 0;
const withAbout = sample.filter((x) => x.summary.about).length;
const exchanges = judged.flatMap((v) => v.exchanges);
const summary = {
  counts,
  integrity,
  judged: judged.length,
  aboutFaithful: `${judged.filter((v, i) => v.aboutFaithful || !sample[i]?.summary.about).length}/${judged.length}`,
  aboutAttributes: judged.filter((v) => v.aboutAttributes).length,
  aboutShown: `${withAbout}/${sample.length}`,
  topics: mean((v) => v.topics),
  moments: mean((v) => v.moments),
  adverts: judged.reduce((n, v) => n + v.advertMoments.length, 0),
  exchangesAnswered: `${exchanges.filter(Boolean).length}/${exchanges.length}`,
  usefulness: mean((v) => v.usefulness),
  costUsd,
};
console.log(
  `\n${counts.episodes} of ${counts.indexed} episodes summarised; on average ${counts.topics.toFixed(1)} topics, ${counts.moments.toFixed(1)} moments, ${counts.exchanges.toFixed(1)} exchanges; ${counts.withAbout} with an overview. Integrity problems: ${integrity.length}.`,
);
console.log(
  `Judged ${judged.length}: overview faithful ${summary.aboutFaithful}, attributes ${summary.aboutAttributes}; topics ${summary.topics.toFixed(2)}, moments ${summary.moments.toFixed(2)}, adverts ${summary.adverts}, exchanges answered ${summary.exchangesAnswered}, usefulness ${summary.usefulness.toFixed(2)}. Estimated cost $${costUsd.toFixed(4)}.`,
);
const dir = join(root, 'eval', 'results');
mkdirSync(dir, { recursive: true });
const file = join(dir, `summaries-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(file, JSON.stringify({ summary, results }, null, 2));
console.log(`results → ${file.slice(root.length + 1)}`);
store.close();
const faithful = judged.every((v, i) => v.aboutFaithful || !sample[i]?.summary.about);
process.exitCode =
  integrity.length === 0 &&
  faithful &&
  summary.aboutAttributes === 0 &&
  summary.adverts === 0 &&
  counts.topics >= 4 &&
  counts.moments >= 5 &&
  counts.exchanges >= 3
    ? 0
    : 1;
