import { spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { USER_AGENT, withRetry } from './http.ts';

const run = (cmd: string, args: string[]) =>
  spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });

export function hasBinary(name: 'ffmpeg' | 'ffprobe'): boolean {
  const r = run(name, ['-version']);
  return r.status === 0;
}

export function probeDurationMs(path: string): number {
  const r = run('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    path,
  ]);
  const seconds = Number(r.stdout.trim());
  if (r.status !== 0 || !Number.isFinite(seconds))
    throw new Error(`ffprobe could not read ${path}`);
  return Math.round(seconds * 1000);
}

export async function download(url: string, path: string): Promise<void> {
  if (existsSync(path) && statSync(path).size > 0) return;
  await withRetry(async () => {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
    if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);
    await pipeline(
      Readable.fromWeb(res.body as import('node:stream/web').ReadableStream),
      createWriteStream(path),
    );
  });
}

export interface AudioChunk {
  path: string;
  offsetMs: number;
  durationMs: number;
}

/**
 * Splits audio into mono 16 kHz MP3 chunks of at most `seconds` (default 1,380 s ≈ 8 MB), safely
 * under OpenAI's 25 MB / 1,400 s per-request limits. Offsets come from probing each chunk, so
 * timestamps stay exact across chunk boundaries.
 */
export function splitAudio(input: string, outDir: string, seconds = 1380): AudioChunk[] {
  mkdirSync(outDir, { recursive: true });
  const r = run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    input,
    '-ac',
    '1',
    '-ar',
    '16000',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '48k',
    '-f',
    'segment',
    '-segment_time',
    String(seconds),
    '-reset_timestamps',
    '1',
    join(outDir, 'chunk_%03d.mp3'),
  ]);
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr.trim().slice(0, 300)}`);
  const files = readdirSync(outDir)
    .filter((f) => /^chunk_\d{3}\.mp3$/.test(f))
    .sort();
  let offset = 0;
  return files.map((f) => {
    const path = join(outDir, f);
    const durationMs = probeDurationMs(path);
    const chunk = { path, offsetMs: offset, durationMs };
    offset += durationMs;
    return chunk;
  });
}
