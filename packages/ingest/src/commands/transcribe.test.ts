import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from '@dear-steven/core/config';
import type { Episode } from '@dear-steven/core/schema';
import { type EpisodeInput, episodeIdFor, KnowledgeStore } from '@dear-steven/core/store';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context } from '../context.ts';

/**
 * Paid transcription in batches (H-05): only episodes with no transcript yet, and no episode's
 * audio left behind to fill the disk. ffmpeg and OpenAI are stand-ins here; the real ones are
 * exercised by `openai-transcribe.test.ts` and the first paid run.
 */
const audio = vi.hoisted(() => ({ downloaded: [] as string[], fail: new Set<string>() }));

vi.mock('../lib/ffmpeg.ts', async (actual) => ({
  ...(await actual<typeof import('../lib/ffmpeg.ts')>()),
  hasBinary: () => true,
  probeDurationMs: () => 6000,
  download: async (_url: string, path: string) => {
    writeFileSync(path, 'mp3');
    audio.downloaded.push(path);
  },
  splitAudio: (input: string) => [{ path: input, offsetMs: 0, durationMs: 3_600_000 }],
}));

vi.mock('../sources/openai-transcribe.ts', async (actual) => ({
  ...(await actual<typeof import('../sources/openai-transcribe.ts')>()),
  hostReference: () => 'data:audio/wav;base64,AAAA',
  diarizeChunks: async (_client: unknown, chunks: { path: string }[]) => {
    if (chunks.some((c) => [...audio.fail].some((id) => c.path.includes(id)))) {
      throw new Error('OpenAI said no');
    }
    return [
      {
        offsetMs: 0,
        segments: [
          { speaker: 'Steven', start: 0, end: 4, text: 'What did you do first?' },
          { speaker: 'A', start: 4, end: 9, text: 'I started before I felt ready.' },
        ],
      },
    ];
  },
}));

const { diarizable, transcribe } = await import('./transcribe.ts');
const { download } = await vi.importActual<typeof import('../lib/ffmpeg.ts')>('../lib/ffmpeg.ts');

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 15);

const episode = (
  guid: string,
  ageDays: number,
  extra: Partial<EpisodeInput> = {},
): EpisodeInput => ({
  sourceGuid: guid,
  title: `Fixture ${guid}`,
  description: '',
  publishedAt: new Date(NOW - ageDays * DAY).toISOString(),
  durationMs: 3_600_000,
  episodeType: 'full',
  guestNames: ['Fixture Guest'],
  audioUrl: `https://example.test/${guid}.mp3`,
  transcriptUrl: null,
  ...extra,
});

/** The newest has the publisher's transcript; two have none; one has none and no audio. */
function context(): Context {
  const dir = mkdtempSync(join(tmpdir(), 'dear-steven-transcribe-'));
  const store = KnowledgeStore.open(join(dir, 'kb.db'), { create: true });
  store.upsertEpisodes([
    episode('covered', 1, { transcriptUrl: 'https://example.test/covered.vtt' }),
    episode('missing-new', 2),
    episode('missing-old', 3),
    episode('no-audio', 4, { audioUrl: null }),
  ]);
  store.replaceTranscript(
    episodeIdFor('covered'),
    [
      {
        idx: 0,
        startMs: 0,
        endMs: 3000,
        speaker: 'unknown',
        speakerName: null,
        attributionMethod: 'none',
        attributionConfidence: null,
        text: 'Already in.',
      },
    ],
    'rss-vtt',
  );
  writeFileSync(join(dir, 'steven.wav'), 'clip');
  return {
    root: dir,
    config: readConfig({ DEAR_STEVEN_DB_PATH: join(dir, 'kb.db') }),
    store,
    dataDir: dir,
    openai: () => ({}) as ReturnType<Context['openai']>,
  };
}

const run = (ctx: Context, extra: Record<string, unknown> = {}) =>
  transcribe(ctx, {
    from: 'diarize',
    force: false,
    budget: 5,
    hostClip: join(ctx.dataDir, 'steven.wav'),
    ...extra,
  });

const byGuid = (ctx: Context, guid: string) =>
  ctx.store.findEpisodes(guid).find((e) => e.sourceGuid === guid) as Episode;

beforeEach(() => {
  audio.downloaded.length = 0;
  audio.fail.clear();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('diarizable', () => {
  const base = {
    audioUrl: 'https://example.test/a.mp3',
    transcriptStatus: 'none',
    transcriptSource: null,
  } as unknown as Episode;

  it('with --missing, takes only episodes with no transcript at all', () => {
    expect(diarizable(base, { force: false, missing: true })).toBe(true);
    expect(
      diarizable({ ...base, transcriptStatus: 'failed' }, { force: false, missing: true }),
    ).toBe(true);
    const covered = {
      ...base,
      transcriptStatus: 'fetched',
      transcriptSource: 'rss-vtt',
    } as Episode;
    expect(diarizable(covered, { force: false, missing: true })).toBe(false);
    // Without it, as before: anything not yet diarized, and with --force, everything.
    expect(diarizable(covered, { force: false })).toBe(true);
    const diarized = { ...covered, transcriptSource: 'openai-diarize' } as Episode;
    expect(diarizable(diarized, { force: false })).toBe(false);
    expect(diarizable(diarized, { force: true })).toBe(true);
  });

  it('never takes an episode without audio', () => {
    const silent = { ...base, audioUrl: null } as Episode;
    for (const opts of [{ force: false, missing: true }, { force: false }, { force: true }]) {
      expect(diarizable(silent, opts)).toBe(false);
    }
  });
});

describe('a batch of paid transcription (H-05)', () => {
  it('with --missing and a limit, transcribes the newest episodes with no transcript', async () => {
    const ctx = context();
    await run(ctx, { missing: true, limit: 1 });
    expect(byGuid(ctx, 'missing-new')).toMatchObject({
      transcriptStatus: 'fetched',
      transcriptSource: 'openai-diarize',
    });
    expect(byGuid(ctx, 'missing-old').transcriptStatus).toBe('none');
    // The publisher's transcript is left as it is.
    expect(byGuid(ctx, 'covered').transcriptSource).toBe('rss-vtt');
    // A second run carries on where the first stopped.
    await run(ctx, { missing: true, limit: 1 });
    expect(byGuid(ctx, 'missing-old').transcriptSource).toBe('openai-diarize');
  });

  it('leaves no audio behind, whether an episode worked or failed', async () => {
    const ctx = context();
    audio.fail.add(episodeIdFor('missing-old'));
    await run(ctx, { missing: true });
    expect(audio.downloaded).toHaveLength(2);
    for (const path of audio.downloaded) expect(existsSync(path), path).toBe(false);
    expect(readdirSync(join(ctx.dataDir, 'cache', 'audio'))).toEqual([]);
    expect(byGuid(ctx, 'missing-old').transcriptStatus).toBe('none');
  });

  it('says what the run covers before it starts, and stops at the budget', async () => {
    const ctx = context();
    const said = vi.mocked(console.log);
    // Each hour-long episode is estimated at $0.36: a $0.50 budget covers one.
    await run(ctx, { missing: true, budget: 0.5 });
    const lines = said.mock.calls.map((call) => String(call[0]));
    expect(lines[0]).toMatch(/^2 episodes, about \$0\.720 of audio; this run stops at \$0\.500\.$/);
    expect(lines.some((line) => line.includes('Stopping:'))).toBe(true);
    expect(byGuid(ctx, 'missing-old').transcriptStatus).toBe('none');
  });
});

describe('download', () => {
  let server: Server;
  let base = '';
  let cut = true;
  const body = Buffer.alloc(64 * 1024, 7);

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { 'content-length': String(body.length) });
      if (cut) {
        // Half the file, then the connection drops.
        res.write(body.subarray(0, body.length / 2), () => res.destroy());
      } else res.end(body);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('never leaves a cut-short download where the whole file belongs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dear-steven-download-'));
    const path = join(dir, 'episode.mp3');
    cut = true;
    await expect(download(`${base}/episode.mp3`, path)).rejects.toThrow();
    expect(existsSync(path)).toBe(false);
    cut = false;
    await download(`${base}/episode.mp3`, path);
    expect(readFileSync(path).equals(body)).toBe(true);
    expect(existsSync(`${path}.part`)).toBe(false);
  }, 20_000); // a dropped connection is retried, with backoff, before it gives up
});
