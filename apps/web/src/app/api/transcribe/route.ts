import { transcriptionCostUsd } from '@dear-steven/core/models';
import { transcribeSpeech } from '@dear-steven/core/openai';
import { readBytes } from '@/server/body';
import { describeFailure } from '@/server/errors';
import { freeLimitApplies } from '@/server/free-questions';
import { getOpenAI } from '@/server/knowledge';
import { clientKey, takeToken } from '@/server/rate-limit';
import { requestConfig } from '@/server/request-config';
import { overBudget, recordSpend } from '@/server/spend';
import { jsonError } from '@/server/sse';

export const dynamic = 'force-dynamic';

/** 60 s of compressed speech is well under 1 MB; 8 MB leaves room for uncompressed WAV. */
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
/** The recording, and room for the form around it. */
const MAX_BODY_BYTES = MAX_AUDIO_BYTES + 64 * 1024;
const AUDIO_TYPES = /^audio\/(webm|mp4|m4a|x-m4a|mpeg|mp3|ogg|wav|x-wav)(;|$)/;

/**
 * Server speech-to-text for browsers without Web Speech (Firefox) — multipart form, one `audio`
 * field. Audio is passed straight to OpenAI and never stored.
 */
export async function POST(req: Request) {
  const { config, refused } = requestConfig(req);
  if (refused) return refused;
  const client = config.mode === 'live' ? getOpenAI(config) : null;
  if (!client) {
    return jsonError(
      503,
      'not_configured',
      'Server transcription needs an OpenAI key; your browser’s own recognition still works.',
    );
  }
  // On free questions (P8-02) it would transcribe any audio for free: the browser's recognition only.
  if (freeLimitApplies(config)) {
    return jsonError(
      402,
      'needs_key',
      'Server transcription needs your own OpenAI key; your browser’s own recognition still works.',
    );
  }
  const limit = takeToken('transcribe', clientKey(req));
  if (!limit.ok)
    return jsonError(429, 'rate_limited', 'Too many recordings at once.', {
      'Retry-After': String(limit.retryAfter),
    });

  if (overBudget(config)) {
    return jsonError(
      503,
      'not_configured',
      'I’ve reached today’s limit for server transcription. Typing still works.',
    );
  }

  const body = await readBytes(req, MAX_BODY_BYTES);
  if (body === null) return jsonError(413, 'bad_request', 'Recording too long.');

  let audio: File | null = null;
  try {
    const type = req.headers.get('content-type') ?? '';
    const form = await new Response(body, { headers: { 'content-type': type } }).formData();
    const value = form.get('audio');
    audio = value instanceof File ? value : null;
  } catch {
    return jsonError(400, 'bad_request', 'Expected multipart form data with an audio file.');
  }
  if (!audio || audio.size === 0) return jsonError(400, 'bad_request', 'No audio received.');
  if (audio.size > MAX_AUDIO_BYTES) return jsonError(413, 'bad_request', 'Recording too long.');
  if (!AUDIO_TYPES.test(audio.type))
    return jsonError(415, 'bad_request', 'Unsupported audio format.');

  try {
    const text = await transcribeSpeech(
      client,
      {
        bytes: new Uint8Array(await audio.arrayBuffer()),
        name: audio.name || 'speech.webm',
        type: audio.type,
      },
      req.signal,
      (usage) => recordSpend(config, transcriptionCostUsd(usage)),
    );
    return Response.json(
      { text: text.slice(0, 2000) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const failure = describeFailure(error, undefined, config.keySource);
    console.error('[transcribe] failed:', failure.log);
    return jsonError(502, failure.code, failure.message);
  }
}
