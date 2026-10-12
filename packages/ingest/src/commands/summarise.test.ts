import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AnswerModel } from '@dear-steven/core/answer';
import { chunkSegments, contextPrefix } from '@dear-steven/core/ingest';
import type { Segment } from '@dear-steven/core/schema';
import { episodeIdFor, KnowledgeStore } from '@dear-steven/core/store';
import { describe, expect, it } from 'vitest';
import { planSummaries, SUMMARY_INSTRUCTIONS, writeSummaries } from './summarise.ts';

function storeWith(n: number): KnowledgeStore {
  const store = KnowledgeStore.open(join(mkdtempSync(join(tmpdir(), 'ds-summ-')), 'kb.db'), {
    create: true,
  });
  for (let i = 1; i <= n; i++) {
    const input = {
      sourceGuid: `g${i}`,
      title: `Guest ${i}: A Conversation (fixture)`,
      description: '',
      publishedAt: `2026-0${i}-01T05:00:00Z`,
      durationMs: 600_000,
      episodeType: 'full' as const,
      guestNames: [`Guest ${i}`],
      audioUrl: null,
      transcriptUrl: null,
    };
    store.upsertEpisodes([input]);
    const id = episodeIdFor(input.sourceGuid);
    const segments: Segment[] = [
      {
        idx: 0,
        startMs: 0,
        endMs: 5000,
        speaker: 'unknown',
        speakerName: null,
        attributionMethod: 'none',
        attributionConfidence: null,
        text: `A fixture conversation number ${i} about building habits that last.`,
      },
    ];
    store.replaceTranscript(id, segments, 'rss-vtt');
    store.replacePassages(id, chunkSegments(segments), contextPrefix(input));
  }
  return store;
}

const fakeModel = (prompts: string[]): AnswerModel => ({
  // biome-ignore lint/correctness/useYield: unused here
  async *streamJson() {
    throw new Error('unused');
  },
  async completeJson() {
    throw new Error('unused');
  },
  async completeText(r) {
    prompts.push(`${r.instructions}\n${r.input.map((m) => m.content).join('\n')}`);
    return 'A conversation about building habits that last, with practical advice on starting small.';
  },
});

describe('summarise (P6-07)', () => {
  it('plans only indexed episodes without a summary, and prices them before anything is sent', () => {
    const store = storeWith(3);
    const plan = planSummaries(store, { force: false });
    expect(plan.items).toHaveLength(3);
    expect(plan.totalUsd).toBeGreaterThan(0);
    expect(plan.totalUsd).toBeLessThan(0.001);
    store.setSummary(plan.items[0]?.episode.id ?? '', 'Already summarised.');
    expect(planSummaries(store, { force: false }).items).toHaveLength(2);
    expect(planSummaries(store, { force: true, limit: 1 }).items).toHaveLength(1);
  });

  it('writes summaries, and stops before the next one would pass the budget', async () => {
    const store = storeWith(3);
    const plan = planSummaries(store, { force: false });
    const prompts: string[] = [];
    const spent = { usd: 0 };
    const tiny = (plan.items[0]?.estimateUsd ?? 0) * 1.5;
    const result = await writeSummaries(fakeModel(prompts), store, plan.items, tiny, spent, () => {
      spent.usd += plan.items[0]?.estimateUsd ?? 0;
    });
    expect(result).toEqual({ written: 1, stoppedAtBudget: true });
    expect(store.getEpisode(plan.items[0]?.episode.id ?? '')?.summary).toMatch(/building habits/);
    expect(prompts[0]).toContain(SUMMARY_INSTRUCTIONS);
    expect(prompts[0]).toContain('Do not say who said what');
  });
});
