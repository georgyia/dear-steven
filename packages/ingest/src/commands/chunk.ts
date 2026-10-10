import { chunkSegments, contextPrefix } from '@dear-steven/core/ingest';
import type { Context } from '../context.ts';
import { c, progress } from '../lib/output.ts';

/** Stage 5: turn transcripts into speaker-turn-aware passages (keyword-searchable immediately). */
export function chunk(ctx: Context, opts: { force: boolean; episode?: string }) {
  const episodes = (
    opts.episode ? ctx.store.findEpisodes(opts.episode) : ctx.store.listEpisodes()
  ).filter((e) => e.transcriptStatus === 'fetched' && (opts.force || e.indexedAt === null));
  if (episodes.length === 0) {
    console.log('Nothing to chunk. Use --force to re-chunk everything.');
    return;
  }
  const bar = progress(episodes.length, 'episodes chunked');
  let total = 0;
  for (const e of episodes) {
    const run = ctx.store.startRun(e.id, 'chunk');
    try {
      const drafts = chunkSegments(ctx.store.getSegments(e.id));
      const n = ctx.store.replacePassages(e.id, drafts, contextPrefix(e));
      total += n;
      ctx.store.finishRun(run, 'done', { meta: { passages: n } });
      bar.tick(`${e.title} (${n})`);
    } catch (error) {
      ctx.store.finishRun(run, 'failed', { error: String(error) });
      bar.tick(`${e.title} — ${error}`, false);
    }
  }
  bar.end();
  console.log(
    `${total} passages. ${c.dim('Next: pnpm ingest index (embeddings; needs OPENAI_API_KEY)')}`,
  );
}
