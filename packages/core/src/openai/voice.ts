import type OpenAI from 'openai';
import { toFile } from 'openai';
import { MODELS, SPEECH_VOICE } from '../config/models.ts';
import type { StockVoice } from '../schema/index.ts';

/**
 * The voice seams (ADR-003): speech-to-text for browsers without Web Speech, and text-to-speech
 * for spoken replies. A stock OpenAI voice — deliberately never an imitation of Steven's voice.
 */

export type TranscriptionUsage =
  | { inputTokens: number; outputTokens: number }
  | { seconds: number };

export async function transcribeSpeech(
  client: OpenAI,
  audio: { bytes: Uint8Array; name: string; type: string },
  signal?: AbortSignal,
  onUsage?: (usage: TranscriptionUsage) => void,
): Promise<string> {
  const file = await toFile(audio.bytes, audio.name, { type: audio.type });
  const result = await client.audio.transcriptions.create(
    { file, model: MODELS.transcribe },
    { signal },
  );
  const usage = result.usage;
  if (usage?.type === 'tokens') {
    onUsage?.({ inputTokens: usage.input_tokens, outputTokens: usage.output_tokens });
  } else if (usage?.type === 'duration') {
    onUsage?.({ seconds: usage.seconds });
  }
  return result.text.trim();
}

export async function synthesizeSpeech(
  client: OpenAI,
  text: string,
  options: { voice?: StockVoice; signal?: AbortSignal } = {},
): Promise<ReadableStream<Uint8Array> | null> {
  const audio = await client.audio.speech.create(
    {
      model: MODELS.speech,
      voice: options.voice ?? SPEECH_VOICE,
      input: text,
      instructions:
        'Warm, relaxed and conversational, like a thoughtful podcast host talking to one person. Natural pauses; never theatrical.',
      response_format: 'mp3',
    },
    { signal: options.signal },
  );
  return audio.body;
}
