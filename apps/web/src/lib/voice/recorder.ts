'use client';

import { LIMITS } from '@dear-steven/core/limits';
import { keyHeaders } from '@/lib/visitor-key';
import { extensionFor, pickRecorderMime } from './capabilities';

/**
 * The fallback path when the browser has no speech recognition (Firefox) or it failed: record
 * the utterance (≤ 60 s) and send it to /api/transcribe. The stream is released as soon as the
 * recording stops, so the microphone indicator goes away immediately.
 */
export interface Recording {
  stop: () => Promise<Blob>;
  cancel: () => void;
}

export class MicDeniedError extends Error {}

export async function startRecording(
  maxMs: number = LIMITS.audioSeconds * 1000,
): Promise<Recording> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
  } catch (error) {
    throw error instanceof DOMException &&
      (error.name === 'NotAllowedError' || error.name === 'SecurityError')
      ? new MicDeniedError('Microphone access was denied')
      : error;
  }
  const mimeType = pickRecorderMime((m) => MediaRecorder.isTypeSupported(m));
  const recorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined,
  );
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const release = () => {
    for (const t of stream.getTracks()) t.stop();
  };
  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      release();
      resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }));
    };
  });
  recorder.start(250);
  const timer = setTimeout(() => {
    if (recorder.state !== 'inactive') recorder.stop();
  }, maxMs);

  return {
    stop: () => {
      clearTimeout(timer);
      if (recorder.state !== 'inactive') recorder.stop();
      return stopped;
    },
    cancel: () => {
      clearTimeout(timer);
      recorder.onstop = release;
      if (recorder.state !== 'inactive') recorder.stop();
      else release();
    },
  };
}

export async function transcribe(blob: Blob, signal?: AbortSignal): Promise<string> {
  const form = new FormData();
  form.append('audio', blob, `speech.${extensionFor(blob.type)}`);
  const res = await fetch('/api/transcribe', {
    method: 'POST',
    body: form,
    signal,
    headers: await keyHeaders(),
  });
  if (!res.ok) throw new Error(`transcribe ${res.status}`);
  const body = (await res.json()) as { text?: string };
  return (body.text ?? '').trim();
}
