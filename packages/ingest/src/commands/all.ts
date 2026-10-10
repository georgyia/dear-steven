import type { Context } from '../context.ts';
import { c } from '../lib/output.ts';
import { chunk } from './chunk.ts';
import { discover } from './discover.ts';
import { index } from './index.ts';
import { status } from './status.ts';
import { transcribe } from './transcribe.ts';
import { matchYouTube } from './youtube.ts';

/** Every free (or near-free) stage in order: the one command that builds a starter knowledge base. */
export async function all(ctx: Context, opts: { limit: number; feed?: string }) {
  const step = (name: string) => console.log(`\n${c.ember('▸')} ${c.bold(name)}`);
  step('discover');
  await discover(ctx, { feed: opts.feed, includeBonus: false, guests: 'title' });
  step(`transcribe (RSS VTT, newest ${opts.limit})`);
  await transcribe(ctx, { from: 'vtt', limit: opts.limit, force: false });
  step('chunk');
  chunk(ctx, { force: false });
  step('index');
  if (ctx.config.openaiApiKey) await index(ctx, { dryRun: false });
  else
    console.log(
      c.yellow(
        'Skipped: no OPENAI_API_KEY. Keyword search works now; run `pnpm ingest index` once the key is set.',
      ),
    );
  step('match-youtube');
  if (ctx.config.youtubeApiKey) await matchYouTube(ctx, { refresh: false });
  else
    console.log(
      c.yellow(
        'Skipped: no YOUTUBE_API_KEY. Citations will cite the podcast timestamp without a video link.',
      ),
    );
  console.log('');
  status(ctx, { episodes: false });
}
