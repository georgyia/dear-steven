import type OpenAI from 'openai';
import { toFile } from 'openai';
import { MODELS, SPEECH_VOICE } from '../config/models.ts';

/**
 * The voice seams (ADR-003): speech-to-text for browsers without Web Speech, and text-to-speech
 * for spoken replies. A stock OpenAI voice — deliberately never an imitation of Steven's voice.
 */

export async function transcribeSpeech(
  client: OpenAI,
  audio: { bytes: Uint8Array; name: string; type: string },
  signal?: AbortSignal,
): Promise<string> {
  const file = await toFile(audio.bytes, audio.name, { type: audio.type });
  const result = await client.audio.transcriptions.create(
    { file, model: MODELS.transcribe },
    { signal },
  );
  return result.text.trim();
}

export async function synthesizeSpeech(
  client: OpenAI,
  text: string,
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array> | null> {
  const audio = await client.audio.speech.create(
    {
      model: MODELS.speech,
      voice: SPEECH_VOICE,
      input: text,
      instructions:
        'Warm, relaxed and conversational, like a thoughtful podcast host talking to one person. Natural pauses; never theatrical.',
      response_format: 'mp3',
    },
    { signal },
  );
  return audio.body;
}
