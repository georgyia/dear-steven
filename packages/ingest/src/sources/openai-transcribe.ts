import { createReadStream, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { MODELS, PRICES } from '@dear-steven/core/models';
import type { OpenAI } from '@dear-steven/core/openai';
import type { Segment } from '@dear-steven/core/schema';
import type { AudioChunk } from '../lib/ffmpeg.ts';
import { mapLimit, withRetry } from '../lib/http.ts';

/** The label OpenAI returns for the enrolled host voice. */
export const HOST_LABEL = 'Steven';

export interface DiarizedChunk {
  offsetMs: number;
  segments: { start: number; end: number; speaker: string; text: string }[];
}

/**
 * Diarized chunks → transcript segments. The enrolled host voice becomes `host`. Other voices are
 * credited to the guest(s) only when a chunk leaves no doubt (P8-11): the host was heard in it, and
 * there are no more other voices than the episode has guests (one when none is known). OpenAI
 * doesn't always recognise the host: the same five minutes once came back with 47 s of his voice
 * under a second label, which would have put his words in the guest's mouth. Anything less clear
 * is "speaker not verified", as RSS transcripts are. A guest is named only when the episode has
 * exactly one; panels keep the speaker anonymous rather than guessing which guest spoke.
 */
export function mapDiarizedSegments(chunks: DiarizedChunk[], guestNames: string[]): Segment[] {
  const soleGuest = guestNames.length === 1 ? (guestNames[0] ?? null) : null;
  const out: Segment[] = [];
  for (const chunk of chunks) {
    const spoken = chunk.segments.filter((s) => s.text.trim());
    const others = new Set(spoken.map((s) => s.speaker).filter((v) => v !== HOST_LABEL));
    const clear =
      spoken.some((s) => s.speaker === HOST_LABEL) && others.size <= Math.max(1, guestNames.length);
    for (const s of spoken) {
      const isHost = s.speaker === HOST_LABEL;
      const speaker = isHost ? 'host' : clear ? 'guest' : 'unknown';
      out.push({
        idx: out.length,
        startMs: Math.round(chunk.offsetMs + s.start * 1000),
        endMs: Math.round(chunk.offsetMs + s.end * 1000),
        speaker,
        speakerName:
          speaker === 'host' ? 'Steven Bartlett' : speaker === 'guest' ? soleGuest : null,
        attributionMethod: speaker === 'unknown' ? 'none' : 'diarization',
        attributionConfidence: null,
        text: s.text.trim(),
      });
    }
  }
  return out;
}

export const diarizationCostUsd = (durationMs: number) =>
  (durationMs / 3_600_000) * PRICES.diarizePerAudioHour;

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.webm': 'audio/webm',
};

/** A 2–10 s clip of the host's voice, as the data URL the API expects. */
export function hostReference(path: string): string {
  const mime = MIME[extname(path).toLowerCase()];
  if (!mime) throw new Error('Host clip must be .mp3, .wav, .m4a or .webm');
  return `data:${mime};base64,${readFileSync(path).toString('base64')}`;
}

/**
 * OpenAI takes about 0.45× a chunk's length to answer (measured 2026-10-15: 115–136 s for five
 * minutes), and Node's fetch gives up on a response with no headers after five minutes. So chunks
 * are five minutes long, and ten are asked at once to keep a long batch to hours, not days (the
 * account allows 3,000 requests a minute; ten at once is about five).
 */
export const DIARIZE_CHUNK_SECONDS = 300;
export const DIARIZE_PARALLEL = 10;

/**
 * Each request gets its own timeout, past the shared client's 60 s, and no retries of the SDK's
 * own: `withRetry` decides (`retryDiarization`).
 */
export const DIARIZE_REQUEST = { timeout: 10 * 60_000, maxRetries: 0 } as const;

/**
 * Rate limits, server errors and dropped connections are tried again. A timeout is not: OpenAI may
 * have finished, and billed, the attempt the client stopped waiting for. Nor is a request it
 * refused (4xx), which would fail the same way again.
 */
export function retryDiarization(error: unknown): boolean {
  if (
    error instanceof Error &&
    (error.name.includes('Timeout') || /timed out/i.test(error.message))
  ) {
    return false;
  }
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status !== 'number' || status === 429 || status >= 500;
}

/** Each chunk diarized with the host enrolled, `parallel` at a time, returned in order. */
export async function diarizeChunks(
  client: OpenAI,
  chunks: AudioChunk[],
  reference: string,
  onChunk?: (i: number) => void,
  parallel = DIARIZE_PARALLEL,
): Promise<DiarizedChunk[]> {
  return mapLimit(chunks, parallel, async (chunk, i) => {
    const res = await withRetry(
      () =>
        client.audio.transcriptions.create(
          {
            file: createReadStream(chunk.path),
            model: MODELS.diarize,
            response_format: 'diarized_json',
            chunking_strategy: 'auto',
            language: 'en',
            known_speaker_names: [HOST_LABEL],
            known_speaker_references: [reference],
          },
          DIARIZE_REQUEST,
        ),
      { retry: retryDiarization, baseMs: 5_000 },
    );
    const segments = 'segments' in res && Array.isArray(res.segments) ? res.segments : [];
    onChunk?.(i);
    return {
      offsetMs: chunk.offsetMs,
      segments: segments.map((s) => ({
        start: Number((s as { start: number }).start),
        end: Number((s as { end: number }).end),
        speaker: String((s as { speaker?: string }).speaker ?? ''),
        text: String((s as { text: string }).text),
      })),
    };
  });
}
