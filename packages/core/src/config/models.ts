import { DEFAULT_STOCK_VOICE, type StockVoice } from '../schema/ask.ts';

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

/**
 * USD per unit, from https://developers.openai.com/api/docs/pricing (read 2026-10-10). They feed
 * `--dry-run` estimates and the web app's daily spend cap (P6-08), which is only as right as these
 * numbers: update them with the models above.
 */
export const PRICES = {
  answerInputPerMillionTokens: 0.1,
  answerCachedInputPerMillionTokens: 0.01,
  answerOutputPerMillionTokens: 0.5,
  embeddingPerMillionTokens: 0.02,
  transcribeInputPerMillionTokens: 1.25,
  transcribeOutputPerMillionTokens: 5,
  /** OpenAI's own per-minute estimate, for responses that report a duration instead of tokens. */
  transcribePerMinute: 0.003,
  speechTextPerMillionTokens: 0.6,
  speechAudioPerMillionTokens: 12,
  diarizePerAudioHour: 0.36,
} as const;

/** Token counts as the Responses API reports them (cached input is part of input). */
export interface TokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

const perMillion = (tokens: number, usd: number) => (Math.max(0, tokens) / 1_000_000) * usd;

export function answerCostUsd(u: TokenUsage): number {
  const cached = Math.min(u.cachedInputTokens, u.inputTokens);
  return (
    perMillion(u.inputTokens - cached, PRICES.answerInputPerMillionTokens) +
    perMillion(cached, PRICES.answerCachedInputPerMillionTokens) +
    perMillion(u.outputTokens, PRICES.answerOutputPerMillionTokens)
  );
}

export const embeddingCostUsd = (tokens: number) =>
  perMillion(tokens, PRICES.embeddingPerMillionTokens);

export function transcriptionCostUsd(
  u: { inputTokens: number; outputTokens: number } | { seconds: number },
): number {
  return 'seconds' in u
    ? (Math.max(0, u.seconds) / 60) * PRICES.transcribePerMinute
    : perMillion(u.inputTokens, PRICES.transcribeInputPerMillionTokens) +
        perMillion(u.outputTokens, PRICES.transcribeOutputPerMillionTokens);
}

/**
 * Speech returns audio, not a usage count, so this is an estimate from the text: about four
 * characters a token in, and about 1,250 audio tokens a minute out at ~900 characters a minute of
 * speech: roughly $0.015 a minute of audio.
 */
export function speechCostUsd(text: string): number {
  const chars = text.length;
  return (
    perMillion(chars / 4, PRICES.speechTextPerMillionTokens) +
    perMillion((chars / 900) * 1_250, PRICES.speechAudioPerMillionTokens)
  );
}

/** The default stock voice; listeners can pick another from `STOCK_VOICES` (P5-07). */
export const SPEECH_VOICE: StockVoice = DEFAULT_STOCK_VOICE;
