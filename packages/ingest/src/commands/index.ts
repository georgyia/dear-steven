import { MODELS, PRICES } from '@dear-steven/core/models';
import { embeddingInput, openAIEmbedder } from '@dear-steven/core/openai';
import type { Context } from '../context.ts';
import { c, progress, usd } from '../lib/output.ts';

const BATCH = 128;

/** Stage 6: embed every passage that lacks a current embedding. `--dry-run` prints the cost first. */
export async function index(ctx: Context, opts: { dryRun: boolean }) {
  const pending = ctx.store.countNeedingEmbedding(MODELS.embedding);
  const prefixTokens = pending.passages * 30;
  const cost = ((pending.tokens + prefixTokens) / 1_000_000) * PRICES.embeddingPerMillionTokens;
  console.log(
    `${pending.passages.toLocaleString('en-GB')} passages need embeddings · ~${(pending.tokens + prefixTokens).toLocaleString('en-GB')} tokens · ~${usd(cost)} with ${MODELS.embedding}`,
  );
  if (opts.dryRun || pending.passages === 0) return;

  const embedder = openAIEmbedder(ctx.openai());
  const run = ctx.store.startRun(null, 'index', { model: MODELS.embedding });
  const bar = progress(Math.ceil(pending.passages / BATCH), 'embedding batches');
  let embedded = 0;
  try {
    for (;;) {
      const batch = ctx.store.passagesNeedingEmbedding(MODELS.embedding, BATCH);
      if (batch.length === 0) break;
      const vectors = await embedder.embed(batch.map(embeddingInput));
      ctx.store.setEmbeddings(
        batch.map((p, i) => ({ pk: p.pk, embedding: vectors[i] as Float32Array })),
        MODELS.embedding,
      );
      embedded += batch.length;
      bar.tick(`${embedded} passages`);
    }
    bar.end();
    ctx.store.finishRun(run, 'done', { meta: { passages: embedded, costUsd: cost } });
    console.log(
      `Hybrid search is ready for ${embedded.toLocaleString('en-GB')} new passages. ${c.dim('Try: pnpm dev')}`,
    );
  } catch (error) {
    bar.end();
    ctx.store.finishRun(run, 'failed', { error: String(error), meta: { passages: embedded } });
    throw error;
  }
}
