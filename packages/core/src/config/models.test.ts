import { describe, expect, it } from 'vitest';
import {
  answerCostUsd,
  embeddingCostUsd,
  PRICES,
  speechCostUsd,
  transcriptionCostUsd,
} from './models.ts';

describe('cost estimates (P6-08)', () => {
  it('prices answer tokens, with cached input at the cached rate', () => {
    const fresh = answerCostUsd({ inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 0 });
    expect(fresh).toBeCloseTo(PRICES.answerInputPerMillionTokens);
    const cached = answerCostUsd({
      inputTokens: 1_000_000,
      cachedInputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cached).toBeCloseTo(
      PRICES.answerCachedInputPerMillionTokens + PRICES.answerOutputPerMillionTokens,
    );
  });

  it('never counts more cached tokens than input, or negative tokens', () => {
    expect(answerCostUsd({ inputTokens: 10, cachedInputTokens: 99, outputTokens: -5 })).toBeCloseTo(
      (10 / 1e6) * PRICES.answerCachedInputPerMillionTokens,
    );
  });

  it('prices embeddings, transcription by tokens or by duration, and speech by length', () => {
    expect(embeddingCostUsd(500_000)).toBeCloseTo(0.01);
    expect(transcriptionCostUsd({ inputTokens: 1_000_000, outputTokens: 0 })).toBeCloseTo(1.25);
    expect(transcriptionCostUsd({ seconds: 120 })).toBeCloseTo(2 * PRICES.transcribePerMinute);
    // ~a minute of speech (900 characters) is about a cent and a half
    expect(speechCostUsd('x'.repeat(900))).toBeGreaterThan(0.014);
    expect(speechCostUsd('x'.repeat(900))).toBeLessThan(0.016);
    expect(speechCostUsd('')).toBe(0);
  });
});
