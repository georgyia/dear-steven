import type OpenAI from 'openai';
import { EMBEDDING_DIMENSIONS, MODELS } from '../config/models.ts';

/** Anything that turns text into vectors. The OpenAI implementation is the only one today. */
export interface Embedder {
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[], signal?: AbortSignal): Promise<Float32Array[]>;
}

/** OpenAI's limits: 2,048 inputs and ~300k tokens per request; we stay well under both. */
const MAX_INPUTS = 256;

export function openAIEmbedder(client: OpenAI, model: string = MODELS.embedding): Embedder {
  return {
    model,
    dimensions: EMBEDDING_DIMENSIONS,
    async embed(texts, signal) {
      const out: Float32Array[] = [];
      for (let i = 0; i < texts.length; i += MAX_INPUTS) {
        const batch = texts.slice(i, i + MAX_INPUTS).map((t) => t.slice(0, 24_000) || ' ');
        const res = await client.embeddings.create(
          { model, input: batch, dimensions: EMBEDDING_DIMENSIONS, encoding_format: 'float' },
          { signal },
        );
        const sorted = [...res.data].sort((a, b) => a.index - b.index);
        for (const d of sorted) out.push(Float32Array.from(d.embedding));
      }
      return out;
    },
  };
}

/** What gets embedded for a passage: where it is from, then what was said. */
export const embeddingInput = (p: { contextPrefix: string; text: string }) =>
  `${p.contextPrefix}\n\n${p.text}`;
