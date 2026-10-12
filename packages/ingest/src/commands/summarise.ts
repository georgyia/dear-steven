import { type AnswerModel, openAIAnswerModel } from '@dear-steven/core/answer';
import { answerCostUsd, MODELS, PRICES } from '@dear-steven/core/models';
import type { Episode } from '@dear-steven/core/schema';
import type { KnowledgeStore } from '@dear-steven/core/store';
import type { Context } from '../context.ts';
import { c, progress, usd } from '../lib/output.ts';

/** Enough of any episode to know what it is about (~60k tokens). */
const MAX_TRANSCRIPT_CHARS = 240_000;
const SUMMARY_TOKENS = 260;
const CHARS_PER_TOKEN = 4;

export const SUMMARY_INSTRUCTIONS = `Summarise one podcast conversation for someone deciding whether it answers their question. Write 3–5 plain sentences in the third person: who the guest is (as the episode title and guest names say), the main arguments and advice, and anything notably surprising or contested. Do not quote. Do not invent numbers. Do not say who said what: the transcript does not identify speakers, so describe what "the conversation" covers. Plain text only.`;

export interface SummaryPlanItem {
  episode: Episode;
  transcript: string;
  estimateUsd: number;
}

/** What `summarise` would do and roughly what it costs, before anything is sent. */
export function planSummaries(
  store: KnowledgeStore,
  opts: { force: boolean; limit?: number; episode?: string },
): { items: SummaryPlanItem[]; totalUsd: number } {
  const candidates = opts.episode
    ? store.findEpisodes(opts.episode)
    : store.listEpisodes().filter((e) => e.indexedAt);
  const items = candidates
    .filter((e) => (opts.force || !e.summary) && store.segmentCount(e.id) > 0)
    .slice(0, opts.limit ?? Number.POSITIVE_INFINITY)
    .map((episode) => {
      const transcript = store
        .getSegments(episode.id)
        .map((s) => s.text)
        .join(' ')
        .slice(0, MAX_TRANSCRIPT_CHARS);
      const estimateUsd =
        ((transcript.length / CHARS_PER_TOKEN + 200) / 1e6) * PRICES.answerInputPerMillionTokens +
        (SUMMARY_TOKENS / 1e6) * PRICES.answerOutputPerMillionTokens;
      return { episode, transcript, estimateUsd };
    });
  return { items, totalUsd: items.reduce((n, i) => n + i.estimateUsd, 0) };
}

const input = (item: SummaryPlanItem) =>
  `<episode title="${item.episode.title.replace(/"/g, "'")}" guests="${item.episode.guestNames.join(', ') || 'not named'}" date="${item.episode.publishedAt.slice(0, 10)}">\n${item.transcript.replace(/</g, '‹')}\n</episode>`;

/**
 * Writes a summary for each planned episode, stopping before the next one would take the spend
 * past the budget. Returns what was written and what it cost, measured from reported token use.
 */
export async function writeSummaries(
  model: AnswerModel,
  store: KnowledgeStore,
  items: SummaryPlanItem[],
  budgetUsd: number,
  spent: { usd: number },
  onEach: (item: SummaryPlanItem) => void = () => {},
): Promise<{ written: number; stoppedAtBudget: boolean }> {
  let written = 0;
  for (const item of items) {
    if (spent.usd + item.estimateUsd > budgetUsd) return { written, stoppedAtBudget: true };
    const text = await model.completeText({
      instructions: SUMMARY_INSTRUCTIONS,
      input: [{ role: 'user', content: input(item) }],
      maxOutputTokens: SUMMARY_TOKENS,
    });
    const summary = text.replace(/\s+/g, ' ').trim().slice(0, 1500);
    if (summary.length > 40) {
      store.setSummary(item.episode.id, summary);
      written += 1;
    }
    onEach(item);
  }
  return { written, stoppedAtBudget: false };
}

/**
 * Stage 6b (P6-07): a short, machine-written overview of each indexed conversation, shown to the
 * answer model to orient it — never cited, never quoted. Paid: prints the estimate first, needs a
 * budget, and stops before going over it.
 */
export async function summarise(
  ctx: Context,
  opts: { dryRun: boolean; force: boolean; limit?: number; episode?: string; budget?: number },
) {
  const plan = planSummaries(ctx.store, opts);
  console.log(
    `${plan.items.length} conversation${plan.items.length === 1 ? '' : 's'} to summarise · ~${usd(plan.totalUsd)} with ${MODELS.answer}`,
  );
  if (opts.dryRun || plan.items.length === 0) return;
  if (opts.budget === undefined) {
    throw new Error('Summaries cost money. Run with --dry-run first, then add --budget <usd>.');
  }

  const spent = { usd: 0 };
  const model = openAIAnswerModel(ctx.openai(), MODELS.answer, {
    onUsage: (u) => {
      spent.usd += answerCostUsd(u);
    },
  });
  const run = ctx.store.startRun(null, 'summarise', { model: MODELS.answer });
  const bar = progress(plan.items.length, 'conversations');
  try {
    const result = await writeSummaries(model, ctx.store, plan.items, opts.budget, spent, (item) =>
      bar.tick(item.episode.title),
    );
    bar.end();
    ctx.store.finishRun(run, 'done', { meta: { episodes: result.written, costUsd: spent.usd } });
    console.log(
      `${result.written} summaries written · ${usd(spent.usd)} spent${result.stoppedAtBudget ? c.yellow(` · stopped at the ${usd(opts.budget)} budget`) : ''}.`,
    );
  } catch (error) {
    bar.end();
    ctx.store.finishRun(run, 'failed', { error: String(error), meta: { costUsd: spent.usd } });
    throw error;
  }
}
