import 'server-only';
import type { AskEvent, FinalAnswer } from '@dear-steven/core/schema';
import { brand } from '@/brand';
import { DEMO_EPISODE_COUNT, pickDemoAnswer } from '@/lib/demo-fixtures';

export type Sleep = (ms: number, signal: AbortSignal) => Promise<void>;

export const realSleep: Sleep = (ms, signal) =>
  new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });

/**
 * Streams a fixture answer through exactly the same event protocol as a live answer, paced like
 * one, so the whole interface can be built and tested with no API key. Never presented as real:
 * every episode is `demo: true` and the UI shows a persistent demo notice.
 */
export async function* streamDemoAnswer(
  question: string,
  signal: AbortSignal,
  sleep: Sleep = realSleep,
): AsyncGenerator<AskEvent> {
  const started = Date.now();
  const answer = pickDemoAnswer(question);
  const { thinking } = brand.copy;

  yield { type: 'status', step: 'searching', message: thinking.searching(DEMO_EPISODE_COUNT) };
  await sleep(650, signal);
  if (signal.aborted) return;

  yield { type: 'sources', ...answer.searched };
  yield {
    type: 'status',
    step: 'found',
    message: thinking.found(answer.searched.passages, answer.searched.episodes),
  };
  await sleep(550, signal);
  yield { type: 'status', step: 'writing', message: thinking.writing };

  for (const [index, block] of answer.blocks.entries()) {
    if (signal.aborted) return;
    yield { type: 'block.start', index };
    await sleep(index === 0 ? 700 : 520, signal);
    if (signal.aborted) return;
    const ids =
      block.kind === 'quote' ? [block.citationId] : block.segments.flatMap((s) => s.citationIds);
    yield {
      type: 'block.done',
      index,
      block,
      citations: answer.citations.filter((c) => ids.includes(c.id)),
    };
  }

  const episodes = new Map<string, FinalAnswer['episodes'][number]>();
  for (const c of answer.citations) {
    const e = episodes.get(c.episode.id) ?? { ...c.episode, citationIds: [] };
    e.citationIds.push(c.id);
    episodes.set(c.episode.id, e);
  }

  yield {
    type: 'final',
    answer: {
      language: 'en',
      mode: answer.mode,
      blocks: answer.blocks,
      citations: answer.citations,
      episodes: [...episodes.values()],
      spoken: answer.spoken,
      caveats: answer.caveats,
      demo: true,
      elapsedMs: Date.now() - started,
    },
  };
}
