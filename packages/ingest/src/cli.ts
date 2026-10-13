#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { all } from './commands/all.ts';
import { attribute } from './commands/attribute.ts';
import { chunk } from './commands/chunk.ts';
import { discover } from './commands/discover.ts';
import { doctor } from './commands/doctor.ts';
import { index } from './commands/index.ts';
import { latest } from './commands/latest.ts';
import { purge } from './commands/purge.ts';
import { status } from './commands/status.ts';
import { summarise } from './commands/summarise.ts';
import { transcribe } from './commands/transcribe.ts';
import { align, matchYouTube } from './commands/youtube.ts';
import { createContext } from './context.ts';
import { c } from './lib/output.ts';

const HELP = `${c.bold('pnpm ingest <command>')} — build Dear Steven's knowledge base (docs/INGESTION.md)

${c.ember('Start here')}
  all [--limit 20]                 discover → RSS transcripts → chunk → embed → YouTube, in one go
  latest [--days 14] [--dry-run | --budget <usd>] [--feed <url>]
                                   bring in only the newest episodes; safe to schedule

${c.ember('Stages')} ${c.dim('(each idempotent and resumable)')}
  discover [--include-bonus] [--guests llm] [--feed <url>]
                                   read the official RSS feed into the episode table
  match-youtube [--refresh]        link episodes to YouTube videos (needs YOUTUBE_API_KEY)
  transcribe --from vtt [--limit N] [--episode <ref>] [--force]
                                   fetch the publisher's free VTT transcripts
  transcribe --diarize --budget <usd> --host-clip <file> [--limit N | --episode <ref>]
                                   paid: speaker-labelled transcripts from the audio
  attribute                        QA report on diarized speaker labels
  chunk [--force] [--episode <ref>] split transcripts into passages (keyword search works now)
  index [--dry-run] [--budget <usd>]
                                   embed passages for semantic search (prints cost first)
  summarise --dry-run | --budget <usd> [--limit N] [--episode <ref>] [--force]
                                   paid: a summary of each conversation, quoted from its
                                   transcript (prints cost first)

${c.ember('Inspect & maintain')}
  status [--episodes]              counts, failures, spend, and what to run next
  doctor [--online]                check keys, tools and the database
  align <episode> [--video <id>] [--offset <seconds>] [--exact | --unknown]
                                   correct a video link or its timing by hand
  purge <episode|all> --yes        remove an episode (or everything) for takedown requests

<episode> is an episode id, RSS guid, or a unique piece of its title.`;

async function main(argv: string[]) {
  const [command, ...rest] = argv;
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(HELP);
    return;
  }

  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    strict: true,
    options: {
      limit: { type: 'string' },
      days: { type: 'string' },
      episode: { type: 'string' },
      force: { type: 'boolean', default: false },
      from: { type: 'string' },
      diarize: { type: 'boolean', default: false },
      budget: { type: 'string' },
      'host-clip': { type: 'string' },
      'include-bonus': { type: 'boolean', default: false },
      guests: { type: 'string' },
      feed: { type: 'string' },
      refresh: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      episodes: { type: 'boolean', default: false },
      online: { type: 'boolean', default: false },
      video: { type: 'string' },
      offset: { type: 'string' },
      exact: { type: 'boolean', default: false },
      unknown: { type: 'boolean', default: false },
      yes: { type: 'boolean', default: false },
    },
  });

  const num = (v: string | undefined, name: string) => {
    if (v === undefined) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`--${name} must be a number`);
    return n;
  };

  const ctx = createContext();
  try {
    switch (command) {
      case 'all':
        return await all(ctx, { limit: num(values.limit, 'limit') ?? 20, feed: values.feed });
      case 'latest': {
        const days = num(values.days, 'days') ?? 14;
        if (!Number.isInteger(days) || days < 1 || days > 365)
          throw new Error('--days must be a whole number of days from 1 to 365');
        return await latest(ctx, {
          days,
          dryRun: values['dry-run'],
          budget: num(values.budget, 'budget'),
          feed: values.feed,
        });
      }
      case 'discover':
        return await discover(ctx, {
          feed: values.feed,
          includeBonus: values['include-bonus'],
          guests: values.guests === 'llm' ? 'llm' : 'title',
        });
      case 'match-youtube':
        return await matchYouTube(ctx, { refresh: values.refresh });
      case 'transcribe': {
        const from = values.diarize ? 'diarize' : values.from;
        if (from !== 'vtt' && from !== 'diarize')
          throw new Error('Choose a source: --from vtt, or --diarize.');
        return await transcribe(ctx, {
          from,
          limit: num(values.limit, 'limit'),
          episode: values.episode,
          force: values.force,
          budget: num(values.budget, 'budget'),
          hostClip: values['host-clip'],
        });
      }
      case 'attribute':
        return attribute(ctx);
      case 'chunk':
        return chunk(ctx, { force: values.force, episode: values.episode });
      case 'index':
        return await index(ctx, {
          dryRun: values['dry-run'],
          budget: num(values.budget, 'budget'),
        });
      case 'summarise':
      case 'summarize':
        await summarise(ctx, {
          dryRun: values['dry-run'],
          budget: num(values.budget, 'budget'),
          limit: num(values.limit, 'limit'),
          episode: values.episode,
          force: values.force,
        });
        return;
      case 'status':
        return status(ctx, { episodes: values.episodes });
      case 'doctor':
        return await doctor(ctx, { online: values.online });
      case 'align': {
        const ref = positionals[0];
        if (!ref)
          throw new Error('Usage: pnpm ingest align <episode> [--video <id>] [--offset <seconds>]');
        return align(ctx, ref, {
          video: values.video,
          offsetSeconds: num(values.offset, 'offset'),
          exact: values.exact,
          unknown: values.unknown,
        });
      }
      case 'purge': {
        const ref = positionals[0];
        if (!ref) throw new Error('Usage: pnpm ingest purge <episode|all> --yes');
        return purge(ctx, ref, { yes: values.yes });
      }
      default:
        console.log(HELP);
        process.exitCode = 1;
    }
  } finally {
    ctx.store.close();
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(c.red(`✗ ${error instanceof Error ? error.message : String(error)}`));
  process.exitCode = 1;
});
