import { rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Context } from '../context.ts';
import { c } from '../lib/output.ts';

/**
 * Takedown hygiene: removes an episode — or everything — including transcripts, passages,
 * embeddings, run history and cached audio. Requires --yes; without it, only says what would go.
 */
export function purge(ctx: Context, ref: string, opts: { yes: boolean }) {
  if (ref === 'all') {
    const n = ctx.store.discoveredCount();
    if (!opts.yes) {
      console.log(
        `Would delete all ${n} episodes and everything derived from them. Re-run with --yes.`,
      );
      process.exitCode = 1;
      return;
    }
    ctx.store.purgeAll();
    rmSync(join(ctx.dataDir, 'cache'), { recursive: true, force: true });
    console.log(c.ember(`Purged ${n} episodes and the audio cache.`));
    return;
  }

  const matches = ctx.store.findEpisodes(ref);
  if (matches.length !== 1) {
    throw new Error(
      matches.length
        ? `"${ref}" matches ${matches.length} episodes; pass an id.`
        : `No episode matches "${ref}".`,
    );
  }
  const episode = matches[0] as NonNullable<(typeof matches)[number]>;
  if (!opts.yes) {
    console.log(
      `Would delete "${episode.title}" (${ctx.store.passageCount(episode.id)} passages, ${ctx.store.segmentCount(episode.id)} segments). Re-run with --yes.`,
    );
    process.exitCode = 1;
    return;
  }
  ctx.store.purgeEpisode(episode.id);
  rmSync(join(ctx.dataDir, 'cache', 'audio', `${episode.id}.mp3`), { force: true });
  console.log(c.ember(`Purged "${episode.title}".`));
}
