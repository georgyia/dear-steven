import { createReadStream, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { MODELS, PRICES } from '@dear-steven/core/models';
import type { OpenAI } from '@dear-steven/core/openai';
import type { Segment } from '@dear-steven/core/schema';
import type { AudioChunk } from '../lib/ffmpeg.ts';
import { withRetry } from '../lib/http.ts';

/** The label OpenAI returns for the enrolled host voice. */
export const HOST_LABEL = 'Steven';

export interface DiarizedChunk {
  offsetMs: number;
  segments: { start: number; end: number; speaker: string; text: string }[];
}

/**
 * Diarized chunks → transcript segments. The enrolled host voice becomes `host`; every other voice
 * is a `guest`, named only when the episode has exactly one known guest (multi-guest panels keep
 * the speaker anonymous rather than guessing which guest spoke).
 */
export function mapDiarizedSegments(chunks: DiarizedChunk[], guestNames: string[]): Segment[] {
  const soleGuest = guestNames.length === 1 ? (guestNames[0] ?? null) : null;
  const out: Segment[] = [];
  for (const chunk of chunks) {
    for (const s of chunk.segments) {
      const text = s.text.trim();
      if (!text) continue;
      const isHost = s.speaker === HOST_LABEL;
      out.push({
        idx: out.length,
        startMs: Math.round(chunk.offsetMs + s.start * 1000),
        endMs: Math.round(chunk.offsetMs + s.end * 1000),
        speaker: isHost ? 'host' : 'guest',
        speakerName: isHost ? 'Steven Bartlett' : soleGuest,
        attributionMethod: 'diarization',
        attributionConfidence: null,
        text,
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

export async function diarizeChunks(
  client: OpenAI,
  chunks: AudioChunk[],
  reference: string,
  onChunk?: (i: number) => void,
): Promise<DiarizedChunk[]> {
  const out: DiarizedChunk[] = [];
  for (const [i, chunk] of chunks.entries()) {
    const res = await withRetry(() =>
      client.audio.transcriptions.create({
        file: createReadStream(chunk.path),
        model: MODELS.diarize,
        response_format: 'diarized_json',
        chunking_strategy: 'auto',
        language: 'en',
        known_speaker_names: [HOST_LABEL],
        known_speaker_references: [reference],
      }),
    );
    const segments = 'segments' in res && Array.isArray(res.segments) ? res.segments : [];
    out.push({
      offsetMs: chunk.offsetMs,
      segments: segments.map((s) => ({
        start: Number((s as { start: number }).start),
        end: Number((s as { end: number }).end),
        speaker: String((s as { speaker?: string }).speaker ?? ''),
        text: String((s as { text: string }).text),
      })),
    });
    onChunk?.(i);
  }
  return out;
}
