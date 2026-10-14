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

const SPEECH_STYLE =
  'Warm, relaxed and conversational, like a thoughtful podcast host talking to one person. Natural pauses; never theatrical.';

/** The delivery instructions; a non-English text is pronounced as its own language (P6-02). */
export function speechInstructions(language?: string): string {
  if (!language || language === 'en') return SPEECH_STYLE;
  let name: string | undefined;
  try {
    name = new Intl.DisplayNames(['en'], { type: 'language' }).of(language);
  } catch {
    name = undefined;
  }
  return name && name !== language
    ? `${SPEECH_STYLE} The text is in ${name}: speak it as a native ${name} speaker would.`
    : SPEECH_STYLE;
}

/**
 * Speech as it is synthesised (P9-01): raw PCM (`SPEECH_SAMPLE_RATE`, mono, 16-bit), which the
 * browser can start playing from the first bytes, where an MP3 had to arrive whole first.
 */
export async function synthesizeSpeech(
  client: OpenAI,
  text: string,
  options: { voice?: StockVoice; language?: string; signal?: AbortSignal } = {},
): Promise<ReadableStream<Uint8Array> | null> {
  const audio = await client.audio.speech.create(
    {
      model: MODELS.speech,
      voice: options.voice ?? SPEECH_VOICE,
      input: text,
      instructions: speechInstructions(options.language),
      response_format: 'pcm',
    },
    { signal: options.signal },
  );
  return audio.body;
}
