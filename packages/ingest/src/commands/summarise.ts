import { type AnswerModel, openAIAnswerModel } from '@dear-steven/core/answer';
import { answerCostUsd, MODELS, type TokenUsage } from '@dear-steven/core/models';
import { SUMMARY_VERSION } from '@dear-steven/core/schema';
import { summariseEpisode, summaryEstimateUsd } from '@dear-steven/core/summary';
import type { Context } from '../context.ts';
import { c, progress, usd } from '../lib/output.ts';

export interface SummariseOptions {
  dryRun: boolean;
  /** The most this run may spend. Required to spend anything. */
  budget?: number;
  limit?: number;
  episode?: string;
  /** Only these episodes (`latest`: the ones it just brought in). */
  ids?: string[];
  /** Summarise again even where a current summary exists. */
  force: boolean;
  /** Episodes summarised at once. */
  concurrency?: number;
  /** The model, given what to do with its token use. OpenAI's answer model unless a test says otherwise. */
  model?: (onUsage: (usage: TokenUsage) => void) => AnswerModel;
}

export interface SummariseResult {
  summarised: number;
  failed: number;
  /** Left for another run: the budget would not cover them. */
  left: number;
  costUsd: number;
}

/**
 * Stage 7 (P8-03): a summary of each indexed episode, every line of it quoted from the transcript
 * or labelled machine-written (`@dear-steven/core/summary`). Paid: the estimate comes first, and
 * nothing is spent without `--budget`. An episode starts only if what has been spent, plus what
 * is running, plus what it is expected to cost, stays within the budget: its estimate, or what
 * episodes have really cost so far on average, whichever is more. So a run stops before it would
 * go over, even when the estimate was low. Episodes already summarised (with this summary
 * version) are skipped unless `--force`.
 */
export async function summarise(ctx: Context, opts: SummariseOptions): Promise<SummariseResult> {
  let episodeId: string | undefined;
  if (opts.episode) {
    const found = ctx.store.findEpisodes(opts.episode);
    if (found.length !== 1) {
      throw new Error(
        found.length
          ? `"${opts.episode}" matches ${found.length} episodes; be more specific.`
          : `No episode matches "${opts.episode}".`,
      );
    }
    episodeId = found[0]?.id;
  }
  const only = opts.ids ? new Set(opts.ids) : null;
  const targets = ctx.store
    .episodesToSummarise({
      version: SUMMARY_VERSION,
      limit: opts.limit,
      episodeId,
      force: opts.force,
    })
    .filter((e) => !only || only.has(e.id));
  const estimates = targets.map((e) => summaryEstimateUsd(e.passages, e.passageTokens));
  const total = estimates.reduce((a, b) => a + b, 0);
  const result: SummariseResult = { summarised: 0, failed: 0, left: 0, costUsd: 0 };
  console.log(
    `${targets.length.toLocaleString('en-GB')} episode${targets.length === 1 ? '' : 's'} to summarise, ~${usd(total)} with ${MODELS.answer}${opts.budget === undefined ? '' : ` (budget ${usd(opts.budget)})`}`,
  );
  if (opts.dryRun || targets.length === 0) return result;
  if (opts.budget === undefined) {
    throw new Error(
      `Summaries cost ~${usd(total)}. Run again with --budget <usd> to spend up to that, or --dry-run to see the cost.`,
    );
  }
  const budget = opts.budget;

  const makeModel =
    opts.model ??
    ((onUsage: (usage: TokenUsage) => void) =>
      openAIAnswerModel(ctx.openai(), MODELS.answer, { onUsage }));
  const bar = progress(targets.length, 'episodes');
  let reserved = 0;
  let next = 0;
  let stopped = false;

  async function one(i: number, reservation: number) {
    const episode = targets[i];
    if (!episode) return;
    let spent = 0;
    const model = makeModel((usage) => {
      spent += answerCostUsd(usage);
    });
    const run = ctx.store.startRun(episode.id, 'summarise', { model: MODELS.answer });
    try {
      const out = await summariseEpisode(model, {
        episode,
        passages: ctx.store.episodePassages(episode.id),
        segments: ctx.store.getSegments(episode.id),
      });
      ctx.store.saveConversationSummary(episode.id, out.summary);
      result.summarised += 1;
      ctx.store.finishRun(run, 'done', {
        meta: {
          costUsd: spent,
          dropped: out.dropped.length,
          // The first few reasons, for `pnpm ingest status` and anyone tuning the prompt.
          why: out.dropped.slice(0, 5).map((d) => d.slice(0, 160)),
          repaired: out.repaired,
        },
      });
      const { topics, moments, exchanges } = out.summary;
      bar.tick(
        `${episode.title.slice(0, 40)}: ${topics.length} topics, ${moments.length} moments, ${exchanges.length} exchanges`,
      );
    } catch (error) {
      result.failed += 1;
      ctx.store.finishRun(run, 'failed', {
        error: error instanceof Error ? error.message : String(error),
        meta: { costUsd: spent },
      });
      bar.tick(episode.title.slice(0, 40), false);
    } finally {
      result.costUsd += spent;
      reserved -= reservation;
    }
  }

  /** What episode `i` is expected to cost: its estimate, or the real average so far if higher. */
  const expected = (i: number) => {
    const done = result.summarised + result.failed;
    return Math.max(estimates[i] ?? 0, done ? result.costUsd / done : 0);
  };

  async function worker() {
    while (!stopped && next < targets.length) {
      const i = next;
      const cost = expected(i);
      if (result.costUsd + reserved + cost > budget) {
        stopped = true;
        break;
      }
      next += 1;
      reserved += cost;
      await one(i, cost);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(opts.concurrency ?? 4, targets.length)) }, worker),
  );
  bar.end();
  result.left = targets.length - next;
  console.log(
    `${result.summarised} summarised, ${result.failed} failed, ${result.left} left for another run; spent ~${usd(result.costUsd)}.`,
  );
  if (result.left > 0) {
    console.log(c.yellow(`Stopped at the --budget of ${usd(budget)}; run again to carry on.`));
  }
  return result;
}
