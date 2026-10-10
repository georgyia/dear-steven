/**
 * Which voice path this browser gets (plan §F, research brief R-03). Pure, so the decision table is
 * unit-tested rather than discovered in production:
 *
 *   input:  Web Speech API (Chrome, Edge, Safari) → MediaRecorder + server STT (Firefox, or after a
 *           Web Speech failure) → none (typing always works)
 *   output: server TTS (stock OpenAI voice) → browser speechSynthesis → none
 */

export type VoiceInput = 'browser' | 'server' | 'none';
export type VoiceOutput = 'server' | 'browser' | 'none';

export interface VoiceEnvironment {
  secureContext: boolean;
  hasGetUserMedia: boolean;
  hasSpeechRecognition: boolean;
  hasMediaRecorder: boolean;
  hasSpeechSynthesis: boolean;
  /** The server has an OpenAI key (live mode), so /api/transcribe and /api/speech work. */
  serverVoice: boolean;
  /** Web Speech failed earlier this session (e.g. a network error); prefer the server path. */
  browserRecognitionFailed: boolean;
}

export function chooseVoiceInput(env: VoiceEnvironment): VoiceInput {
  if (!env.secureContext || !env.hasGetUserMedia) return 'none';
  const server = env.hasMediaRecorder && env.serverVoice;
  if (env.hasSpeechRecognition && !(env.browserRecognitionFailed && server)) return 'browser';
  return server ? 'server' : 'none';
}

export function chooseVoiceOutput(
  env: Pick<VoiceEnvironment, 'serverVoice' | 'hasSpeechSynthesis'>,
): VoiceOutput {
  if (env.serverVoice) return 'server';
  return env.hasSpeechSynthesis ? 'browser' : 'none';
}

/** MediaRecorder formats in preference order; Safari only does mp4. */
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

export function pickRecorderMime(isTypeSupported: (mime: string) => boolean): string {
  return MIME_CANDIDATES.find((m) => isTypeSupported(m)) ?? '';
}

export const extensionFor = (mime: string) =>
  mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';

export function detectEnvironment(
  serverVoice: boolean,
  browserRecognitionFailed: boolean,
): VoiceEnvironment {
  if (typeof window === 'undefined') {
    return {
      secureContext: false,
      hasGetUserMedia: false,
      hasSpeechRecognition: false,
      hasMediaRecorder: false,
      hasSpeechSynthesis: false,
      serverVoice,
      browserRecognitionFailed,
    };
  }
  const w = window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return {
    secureContext: window.isSecureContext,
    hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
    hasSpeechRecognition: Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition),
    hasMediaRecorder: typeof MediaRecorder !== 'undefined',
    hasSpeechSynthesis: 'speechSynthesis' in window,
    serverVoice,
    browserRecognitionFailed,
  };
}
