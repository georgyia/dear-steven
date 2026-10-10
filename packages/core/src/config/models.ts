/**
 * Every OpenAI model id lives here (ADR-003). Models get renamed and retired; when that happens,
 * this is the only file that changes. `gpt-6-luna` (released 2026-09-22; structured outputs,
 * prompt caching, configurable reasoning effort) was re-checked on 2026-10-10; the audio and
 * embedding ids come from the plan's research briefs (plan/11-research/).
 */
export const MODELS = {
  /** Answers, follow-up condensation, guest-name extraction. Reasoning effort kept low for latency. */
  answer: 'gpt-6-luna',
  embedding: 'text-embedding-3-small',
  /** Browser-voice fallback (Firefox, errors). */
  transcribe: 'gpt-4o-mini-transcribe',
  /** Ingest: speaker-labelled transcripts with host voice enrollment. */
  diarize: 'gpt-4o-transcribe-diarize',
  /** Spoken replies. Scheduled for retirement in Jan 2027 — swap here when it goes. */
  speech: 'gpt-4o-mini-tts',
} as const;

export const EMBEDDING_DIMENSIONS = 1536;

/** USD per unit, for `--dry-run` estimates only. Update with the models above. */
export const PRICES = {
  embeddingPerMillionTokens: 0.02,
  diarizePerAudioHour: 0.36,
} as const;

export const SPEECH_VOICE = 'ash';
