import type { Context } from '../context.ts';
import { c, progress } from '../lib/output.ts';
import { guestsFromDescription } from '../sources/openai-guests.ts';
import { fetchFeed, parseFeed, resolveFeedUrl } from '../sources/rss.ts';

export interface DiscoverOptions {
  feed?: string;
  includeBonus: boolean;
  guests: 'title' | 'llm';
}

/** Stage 1: read the official RSS feed and upsert every episode's metadata. Free and idempotent. */
export async function discover(ctx: Context, opts: DiscoverOptions) {
  const run = ctx.store.startRun(null, 'discover');
  try {
    const url = opts.feed ?? ctx.config.feedUrl ?? (await resolveFeedUrl());
    console.log(c.dim(`Feed: ${url}`));
    const all = parseFeed(await fetchFeed(url));
    const episodes = opts.includeBonus ? all : all.filter((e) => e.episodeType === 'full');
    const { inserted, updated } = ctx.store.upsertEpisodes(episodes);
    const withVtt = episodes.filter((e) => e.transcriptUrl).length;
    const named = episodes.filter((e) => e.guestNames.length).length;

    let llmNamed = 0;
    if (opts.guests === 'llm') {
      const client = ctx.openai();
      const unnamed = ctx.store
        .listEpisodes({ types: ['full'] })
        .filter((e) => e.guestNames.length === 0);
      const bar = progress(unnamed.length, 'guest names from descriptions');
      for (const e of unnamed) {
        try {
          const names = await guestsFromDescription(client, e);
          if (names.length) {
            ctx.store.setGuestNames(e.id, names, 'llm');
            llmNamed += 1;
          }
          bar.tick(e.title);
        } catch (error) {
          bar.tick(`${e.title} — ${error instanceof Error ? error.message : error}`, false);
        }
      }
      bar.end();
    }

    ctx.store.finishRun(run, 'done', { meta: { feed: url, items: all.length, inserted, updated } });
    console.log(
      `${c.bold(String(episodes.length))} episodes in the feed${opts.includeBonus ? '' : ` (${all.length - episodes.length} bonus clips skipped)`}: ` +
        `${inserted} new, ${updated} updated.`,
    );
    console.log(
      `${withVtt} have a free RSS transcript · guests named from titles for ${named}${opts.guests === 'llm' ? `, from descriptions for ${llmNamed} more` : ''}.`,
    );
    console.log(c.dim('Next: pnpm ingest transcribe --from vtt --limit 20'));
  } catch (error) {
    ctx.store.finishRun(run, 'failed', { error: String(error) });
    throw error;
  }
}
