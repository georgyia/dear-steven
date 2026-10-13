import { MODELS, PRICES } from '@dear-steven/core/models';
import { embeddingEstimate } from '@dear-steven/core/openai';
import type { Episode } from '@dear-steven/core/schema';
import type { KnowledgeStore } from '@dear-steven/core/store';
import type { Context } from '../context.ts';
import { c, usd } from '../lib/output.ts';
import { chunk } from './chunk.ts';
import { discover } from './discover.ts';
import { index } from './index.ts';
import { summarise } from './summarise.ts';
import { transcribe } from './transcribe.ts';
import { matchYouTube } from './youtube.ts';

const DAY = 86_400_000;
/** Roughly 150 spoken words a minute, about 1.35 tokens a word: what an episode will embed. */
const TOKENS_PER_MINUTE = 200;

export interface LatestOptions {
  /** Also catch up on episodes published in the last N days that have no transcript yet. */
  days: number;
  dryRun: boolean;
  /** The most the paid stages (embeddings, then summaries) may spend. Without it, only free stages run. */
  budget?: number;
  feed?: string;
}

/** When the newest full episode already in the knowledge base was published, if there is one. */
export function newestPublished(store: KnowledgeStore): string | null {
  return store
    .listEpisodes({ types: ['full'] })
    .reduce<string | null>(
      (max, e) => (max === null || e.publishedAt > max ? e.publishedAt : max),
      null,
    );
}

/**
 * The episodes `latest` brings in: published within `days`, or since the newest episode we already
 * had (so a long gap between runs still catches up), with a free transcript and none fetched yet.
 * Never the back catalogue: that is what `all` is for. Newest first.
 */
export function latestTargets(
  store: KnowledgeStore,
  newestBefore: string | null,
  days: number,
  now: Date = new Date(),
): Episode[] {
  const window = now.getTime() - days * DAY;
  const since = newestBefore === null ? window : Math.min(window, Date.parse(newestBefore));
  return store
    .listEpisodes({ types: ['full'] })
    .filter(
      (e) =>
        e.transcriptUrl !== null &&
        e.transcriptStatus !== 'fetched' &&
        Date.parse(e.publishedAt) >= since,
    )
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** Before anything is transcribed: what embedding them will cost, from their running time. */
export function latestEstimateUsd(episodes: Episode[]): number {
  const minutes = episodes.reduce((n, e) => n + (e.durationMs ?? 90 * 60_000) / 60_000, 0);
  return ((minutes * TOKENS_PER_MINUTE) / 1_000_000) * PRICES.embeddingPerMillionTokens;
}

/**
 * Brings in the newest episodes in one step (P6-16): discover, then for the new ones only, free
 * transcripts, passages, embeddings (within the budget) and YouTube links. The estimate comes
 * first; a run whose cost is over the budget stops before any paid call. Safe to schedule.
 */
export async function latest(ctx: Context, opts: LatestOptions) {
  const step = (name: string) => console.log(`\n${c.ember('▸')} ${c.bold(name)}`);
  const newestBefore = newestPublished(ctx.store);

  step('discover');
  await discover(ctx, { feed: opts.feed, includeBonus: false, guests: 'title' });
  const targets = latestTargets(ctx.store, newestBefore, opts.days);
  if (targets.length === 0) {
    console.log('\nNothing new: every recent episode with a transcript is already in.');
    return;
  }
  console.log(`\n${targets.length} to bring in:`);
  for (const e of targets) console.log(`  ${e.publishedAt.slice(0, 10)}  ${e.title.slice(0, 80)}`);
  console.log(
    c.dim(
      `Embedding them: ~${usd(latestEstimateUsd(targets))} with ${MODELS.embedding}${opts.budget === undefined ? ' (needs --budget)' : ` (budget ${usd(opts.budget)})`}. Transcripts and YouTube links are free.`,
    ),
  );
  if (opts.dryRun) return;

  step('transcribe (RSS VTT)');
  await transcribe(ctx, { from: 'vtt', ids: targets.map((e) => e.id), force: false });
  step('chunk');
  chunk(ctx, { force: false });

  step('index');
  const pending = embeddingEstimate(ctx.store.countNeedingEmbedding(MODELS.embedding));
  if (pending.passages === 0) console.log('Nothing to embed.');
  else if (!ctx.config.openaiApiKey) {
    console.log(c.yellow('Skipped: no OPENAI_API_KEY. Keyword search covers the new episodes.'));
  } else if (opts.budget === undefined) {
    console.log(
      c.yellow(
        `Skipped: embeddings cost ~${usd(pending.usd)}. Add --budget to embed them; keyword search covers them meanwhile.`,
      ),
    );
  } else if (pending.usd > opts.budget) {
    console.log(
      c.yellow(
        `Stopped before paying: ~${usd(pending.usd)} is over the --budget of ${usd(opts.budget)}. Nothing was embedded.`,
      ),
    );
  } else {
    await index(ctx, { dryRun: false, budget: opts.budget });
  }
  const embedded = opts.budget !== undefined && pending.usd <= opts.budget ? pending.usd : 0;

  step('summarise');
  const fresh = targets.filter((e) => ctx.store.passageCount(e.id) > 0).map((e) => e.id);
  if (fresh.length === 0) console.log('Nothing to summarise.');
  else if (!ctx.config.openaiApiKey) console.log(c.yellow('Skipped: no OPENAI_API_KEY.'));
  else if (opts.budget === undefined) {
    await summarise(ctx, { dryRun: true, ids: fresh, force: false });
    console.log(c.yellow('Skipped: add --budget to summarise them.'));
  } else {
    await summarise(ctx, {
      dryRun: false,
      budget: Math.max(0, opts.budget - embedded),
      ids: fresh,
      force: false,
    });
  }

  step('match-youtube');
  if (ctx.config.youtubeApiKey) await matchYouTube(ctx, { refresh: false });
  else console.log(c.yellow('Skipped: no YOUTUBE_API_KEY.'));

  const added = targets.filter((e) => ctx.store.passageCount(e.id) > 0);
  console.log(
    `\n${c.bold(String(added.length))} new episode${added.length === 1 ? '' : 's'} answerable now.`,
  );
}
