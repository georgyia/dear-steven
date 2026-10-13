import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AnswerModel } from '@dear-steven/core/answer';
import { readConfig } from '@dear-steven/core/config';
import { chunkSegments, contextPrefix } from '@dear-steven/core/ingest';
import type { TokenUsage } from '@dear-steven/core/models';
import { type Segment, SUMMARY_VERSION } from '@dear-steven/core/schema';
import { type EpisodeInput, episodeIdFor, KnowledgeStore } from '@dear-steven/core/store';
import { summaryEstimateUsd } from '@dear-steven/core/summary';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context } from '../context.ts';
import { summarise } from './summarise.ts';

/** Three fixture episodes with passages; an OpenAI that must not be asked. */
function context(): Context & { ids: string[] } {
  const dir = mkdtempSync(join(tmpdir(), 'dear-steven-summarise-'));
  const store = KnowledgeStore.open(join(dir, 'kb.db'), { create: true });
  const ids = [1, 2, 3].map((n) => {
    const input: EpisodeInput = {
      sourceGuid: `guid-${n}`,
      title: `Demo Guest ${n}: Starting`,
      description: 'A test episode.',
      publishedAt: `2026-0${n}-01T05:00:00Z`,
      durationMs: 3_600_000,
      episodeType: 'full',
      guestNames: [`Demo Guest ${n}`],
      audioUrl: null,
      transcriptUrl: null,
    };
    store.upsertEpisodes([input]);
    const segments: Segment[] = Array.from({ length: 12 }, (_, idx) => ({
      idx,
      startMs: idx * 8000,
      endMs: idx * 8000 + 7000,
      speaker: 'unknown',
      speakerName: null,
      attributionMethod: 'none',
      attributionConfidence: null,
      text: `Sentence ${idx} about starting the work before you feel ready for it, in fixture episode ${n}.`,
    }));
    const id = episodeIdFor(input.sourceGuid);
    store.replaceTranscript(id, segments, 'rss-vtt');
    store.replacePassages(id, chunkSegments(segments), contextPrefix(input));
    return id;
  });
  return {
    root: dir,
    config: readConfig({ DEAR_STEVEN_DB_PATH: join(dir, 'kb.db') }),
    store,
    dataDir: dir,
    openai: () => {
      throw new Error('OpenAI must not be called');
    },
    ids,
  };
}

/** A model whose every summary quotes the first passage, and reports `usage` for it. */
function fake(usage: TokenUsage, calls: string[], fail?: (input: string) => boolean) {
  return (onUsage: (u: TokenUsage) => void): AnswerModel => ({
    // biome-ignore lint/correctness/useYield: summaries never stream
    async *streamJson() {
      throw new Error('not used');
    },
    async completeJson(request) {
      const input = String(request.input[0]?.content);
      calls.push(input);
      onUsage(usage);
      if (fail?.(input)) throw new Error('the model fell over');
      return JSON.stringify({
        about: 'The conversation covers starting the work before you feel ready.',
        topics: [{ title: 'Starting before you feel ready', passage: 'p0' }],
        moments: [
          {
            passage: 'p0',
            quote: 'Sentence 0 about starting the work before you feel ready for it',
            label: 'Starting before you feel ready',
          },
        ],
        exchanges: [],
      });
    },
    async completeText() {
      throw new Error('not used');
    },
  });
}

/** About $0.01 a call at the answer model's prices. */
const USAGE: TokenUsage = { inputTokens: 50_000, cachedInputTokens: 0, outputTokens: 10_000 };

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('summarise (P8-03)', () => {
  it('prints the estimate and spends nothing on a dry run, or without a budget', async () => {
    const ctx = context();
    const calls: string[] = [];
    const out = await summarise(ctx, { dryRun: true, force: false, model: fake(USAGE, calls) });
    expect(out).toEqual({ summarised: 0, failed: 0, left: 0, costUsd: 0 });
    const printed = vi.mocked(console.log).mock.calls.flat().join('\n');
    const [first] = ctx.store.episodesToSummarise({ version: SUMMARY_VERSION });
    expect(printed).toMatch(/^3 episodes to summarise, ~\$0\.0\d\d with gpt-6-luna/);
    expect(first && summaryEstimateUsd(first.passages, first.passageTokens)).toBeGreaterThan(0);

    await expect(
      summarise(ctx, { dryRun: false, force: false, model: fake(USAGE, calls) }),
    ).rejects.toThrow(/--budget <usd>/);
    expect(calls).toEqual([]);
  });

  it('summarises within the budget, and stops before it would go over', async () => {
    const ctx = context();
    const calls: string[] = [];
    // Each episode really costs ~$0.01; the budget covers two of them, not three.
    const out = await summarise(ctx, {
      dryRun: false,
      budget: 0.025,
      force: false,
      concurrency: 1,
      model: fake(USAGE, calls),
    });
    expect(out.summarised).toBeLessThanOrEqual(2);
    expect(out.left).toBeGreaterThanOrEqual(1);
    expect(out.costUsd).toBeLessThanOrEqual(0.025);
    expect(ctx.store.summaryCount(SUMMARY_VERSION)).toBe(out.summarised);
  });

  it('skips what is already summarised, unless forced; and keeps only what passed the checks', async () => {
    const ctx = context();
    const calls: string[] = [];
    const cheap: TokenUsage = { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 100 };
    await summarise(ctx, { dryRun: false, budget: 1, force: false, model: fake(cheap, calls) });
    expect(calls).toHaveLength(3);
    await summarise(ctx, { dryRun: false, budget: 1, force: false, model: fake(cheap, calls) });
    expect(calls).toHaveLength(3);
    await summarise(ctx, {
      dryRun: false,
      budget: 1,
      force: true,
      episode: 'Demo Guest 2',
      model: fake(cheap, calls),
    });
    expect(calls).toHaveLength(4);
    const summary = ctx.store.conversationSummary(ctx.ids[0] as string);
    // The stored words the quote points at, not the model's copy of them.
    expect(summary?.moments[0]?.text).toBe(
      'Sentence 0 about starting the work before you feel ready for it',
    );
  });

  it('records a failed episode and carries on with the rest', async () => {
    const ctx = context();
    const calls: string[] = [];
    const out = await summarise(ctx, {
      dryRun: false,
      budget: 1,
      force: false,
      model: fake({ inputTokens: 1000, cachedInputTokens: 0, outputTokens: 100 }, calls, (input) =>
        input.includes('Demo Guest 2'),
      ),
    });
    expect(out).toMatchObject({ summarised: 2, failed: 1, left: 0 });
    const failed = ctx.store
      .latestRuns()
      .find((r) => r.stage === 'summarise' && r.status === 'failed');
    expect(failed?.error).toBe('the model fell over');
  });
});
