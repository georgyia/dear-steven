import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Context } from '../context.ts';
import { hasBinary } from '../lib/ffmpeg.ts';
import { c } from '../lib/output.ts';
import { resolveFeedUrl } from '../sources/rss.ts';

type Check = { name: string; ok: boolean | 'optional'; detail: string };

/** Checks everything the pipeline depends on and says how to fix what is missing. */
export async function doctor(ctx: Context, opts: { online: boolean }) {
  const checks: Check[] = [];
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
  checks.push({
    name: 'Node.js',
    ok: major > 22 || (major === 22 && minor >= 18),
    detail: `${process.versions.node} (needs ≥ 22.18 for built-in TypeScript)`,
  });
  checks.push({
    name: '.env',
    ok: existsSync(join(ctx.root, '.env')) || 'optional',
    detail: 'copy .env.example to .env',
  });
  checks.push({
    name: 'OPENAI_API_KEY',
    ok: ctx.config.openaiApiKey ? true : 'optional',
    detail: ctx.config.openaiApiKey
      ? 'set'
      : 'missing — needed for embeddings, answers and diarization',
  });
  checks.push({
    name: 'YOUTUBE_API_KEY',
    ok: ctx.config.youtubeApiKey ? true : 'optional',
    detail: ctx.config.youtubeApiKey ? 'set' : 'missing — needed only for match-youtube',
  });
  checks.push({
    name: 'ffmpeg/ffprobe',
    ok: hasBinary('ffmpeg') && hasBinary('ffprobe') ? true : 'optional',
    detail: 'needed only for --diarize',
  });

  const versions = ctx.store.db
    .prepare('SELECT sqlite_version() AS sqlite, vec_version() AS vec')
    .get() as {
    sqlite: string;
    vec: string;
  };
  checks.push({
    name: 'SQLite + sqlite-vec',
    ok: true,
    detail: `${versions.sqlite} · ${versions.vec} · FTS5 ok`,
  });

  if (opts.online) {
    try {
      checks.push({ name: 'RSS feed', ok: true, detail: await resolveFeedUrl() });
    } catch (error) {
      checks.push({ name: 'RSS feed', ok: false, detail: String(error) });
    }
  }

  for (const ch of checks) {
    const mark = ch.ok === true ? c.green('✓') : ch.ok === 'optional' ? c.yellow('○') : c.red('✗');
    console.log(`${mark} ${ch.name.padEnd(20)} ${c.dim(ch.detail)}`);
  }
  if (checks.some((ch) => ch.ok === false)) process.exitCode = 1;
}
