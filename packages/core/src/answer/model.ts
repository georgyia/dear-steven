import type OpenAI from 'openai';
import { MODELS } from '../config/models.ts';

/** One message of conversation input for the model. */
export interface ModelMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface JsonFormat {
  name: string;
  schema: Record<string, unknown>;
}

export interface ModelRequest {
  instructions: string;
  input: ModelMessage[];
  signal?: AbortSignal;
  /** Groups requests that share a static prefix, for prompt caching. */
  cacheKey?: string;
}

/**
 * The seam between answer composition and a model provider (ADR-003). Everything in
 * packages/core/src/answer talks to this interface; tests use a scripted fake.
 */
export interface AnswerModel {
  /** Streams strict-JSON text deltas conforming to `format`. */
  streamJson(request: ModelRequest & { format: JsonFormat }): AsyncIterable<string>;
  completeJson(request: ModelRequest & { format: JsonFormat }): Promise<string>;
  completeText(request: ModelRequest & { maxOutputTokens?: number }): Promise<string>;
}

export class ModelError extends Error {}

export function openAIAnswerModel(client: OpenAI, model: string = MODELS.answer): AnswerModel {
  const base = (r: ModelRequest) => ({
    model,
    instructions: r.instructions,
    input: r.input.map((m) => ({ role: m.role, content: m.content })),
    store: false,
    ...(r.cacheKey ? { prompt_cache_key: r.cacheKey } : {}),
  });
  const format = (f: JsonFormat) => ({
    format: { type: 'json_schema' as const, name: f.name, strict: true, schema: f.schema },
  });

  return {
    async *streamJson(r) {
      const stream = await client.responses.create(
        { ...base(r), reasoning: { effort: 'low' }, text: format(r.format), stream: true },
        { signal: r.signal },
      );
      for await (const event of stream) {
        if (event.type === 'response.output_text.delta') yield event.delta;
        else if (event.type === 'response.refusal.delta')
          throw new ModelError('The model refused to answer.');
        else if (event.type === 'response.failed')
          throw new ModelError(event.response.error?.message ?? 'Response failed');
        else if (event.type === 'error') throw new ModelError(event.message);
      }
    },
    async completeJson(r) {
      const res = await client.responses.create(
        { ...base(r), reasoning: { effort: 'low' }, text: format(r.format) },
        { signal: r.signal },
      );
      if (!res.output_text) throw new ModelError('Empty response');
      return res.output_text;
    },
    async completeText(r) {
      const res = await client.responses.create(
        { ...base(r), reasoning: { effort: 'none' }, max_output_tokens: r.maxOutputTokens ?? 200 },
        { signal: r.signal },
      );
      return res.output_text.trim();
    },
  };
}
