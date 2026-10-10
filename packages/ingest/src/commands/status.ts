import { relative } from 'node:path';
import { formatDate } from '@dear-steven/core/format';
import { MODELS } from '@dear-steven/core/models';
import type { Context } from '../context.ts';
import { c, table, usd } from '../lib/output.ts';

/** Stage 7: what is in the knowledge base, what failed, and what to run next. */
export function status(ctx: Context, opts: { episodes: boolean }) {
  const s = ctx.store.stats();
  const discovered = ctx.store.discoveredCount();
  const all = ctx.store.listEpisodes();
  const withVtt = all.filter((e) => e.transcriptUrl).length;
  const full = all.filter((e) => e.episodeType === 'full');
  const linked = full.filter((e) => e.youtubeVideoId).length;
  const exact = full.filter((e) => e.youtubeVideoId && e.youtubeAlignment === 'exact').length;
  const estimated = full.filter(
    (e) => e.youtubeVideoId && e.youtubeAlignment === 'estimated',
  ).length;
  const coverage = full.length ? Math.round((linked / full.length) * 100) : 0;
  const pending = ctx.store.countNeedingEmbedding(MODELS.embedding).passages;
  const pct = s.passages ? Math.round((s.embeddedPassages / s.passages) * 100) : 0;

  console.log(c.bold('Dear Steven — knowledge base'));
  console.log(`  ${c.dim('database')}   ${relative(ctx.root, ctx.config.dbPath)}`);
  console.log(
    `  ${c.dim('episodes')}   ${discovered} discovered · ${withVtt} with an RSS transcript · ${s.transcribedEpisodes} transcribed · ${c.ember(String(s.episodes))} indexed`,
  );
  console.log(
    `  ${c.dim('passages')}   ${s.passages.toLocaleString('en-GB')} · ${s.embeddedPassages.toLocaleString('en-GB')} embedded (${pct}%)`,
  );
  console.log(
    `  ${c.dim('speakers')}   ${s.diarizedEpisodes} diarized episodes (verified host/guest statements)`,
  );
  console.log(
    `  ${c.dim('youtube')}    ${linked} of ${full.length} full episodes linked (${coverage}%) · ${exact} exact · ${estimated} estimated (≈) · ${linked - exact - estimated} no timing`,
  );
  console.log(`  ${c.dim('spend')}      ${usd(ctx.store.spentUsd())} recorded by paid stages`);

  const failures = ctx.store
    .latestRuns()
    .filter((r) => r.status === 'failed')
    .slice(0, 8);
  if (failures.length) {
    console.log(c.red(`\n${failures.length} recent failure${failures.length === 1 ? '' : 's'}:`));
    for (const f of failures) {
      const title = f.episodeId
        ? (ctx.store.getEpisode(f.episodeId)?.title ?? f.episodeId)
        : '(all)';
      console.log(`  ${f.stage.padEnd(13)} ${title.slice(0, 60)} — ${f.error?.slice(0, 80) ?? ''}`);
    }
  }

  const next =
    discovered === 0
      ? 'pnpm ingest discover'
      : s.transcribedEpisodes === 0
        ? 'pnpm ingest transcribe --from vtt --limit 20'
        : s.transcribedEpisodes > s.episodes
          ? 'pnpm ingest chunk'
          : pending > 0
            ? 'pnpm ingest index'
            : linked === 0
              ? 'pnpm ingest match-youtube (optional, needs YOUTUBE_API_KEY)'
              : 'pnpm dev';
  console.log(`\n${c.dim('next:')} ${next}`);

  if (opts.episodes) {
    console.log('');
    table(
      all
        .filter((e) => e.transcriptStatus !== 'none' || e.youtubeVideoId)
        .slice(0, 200)
        .map((e) => [
          formatDate(e.publishedAt),
          e.title.slice(0, 54),
          e.transcriptSource ?? e.transcriptStatus,
          String(ctx.store.passageCount(e.id)),
          e.youtubeVideoId ? e.youtubeAlignment : '—',
          e.id,
        ]),
      ['date', 'title', 'transcript', 'passages', 'video', 'id'],
    );
  }
}
