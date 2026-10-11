import type OpenAI from 'openai';
import { describe, expect, it } from 'vitest';
import type { TokenUsage } from '../config/models.ts';
import { openAIEmbedder } from '../openai/embedder.ts';
import { speechInstructions, type TranscriptionUsage, transcribeSpeech } from '../openai/voice.ts';
import { personaLint } from '../persona/persona.ts';
import { restingAnswer } from './compose.ts';
import { openAIAnswerModel } from './model.ts';

const usage = {
  input_tokens: 1200,
  input_tokens_details: { cached_tokens: 1000 },
  output_tokens: 300,
};

/** Just enough of the OpenAI client for the adapters; nothing goes over the network. */
const fakeClient = (overrides: Record<string, unknown> = {}) =>
  ({
    responses: {
      create: async (body: { stream?: boolean }) =>
        body.stream
          ? (async function* () {
              yield { type: 'response.output_text.delta', delta: '{"a":' };
              yield { type: 'response.output_text.delta', delta: '1}' };
              yield { type: 'response.completed', response: { usage } };
            })()
          : { output_text: ' {"a":1} ', usage },
    },
    embeddings: {
      create: async ({ input }: { input: string[] }) => ({
        data: input.map((_, index) => ({ index, embedding: [0, 1] })),
        usage: { total_tokens: 42 },
      }),
    },
    audio: {
      transcriptions: {
        create: async () => ({ text: ' hello ', usage: { type: 'duration', seconds: 7 } }),
      },
    },
    ...overrides,
  }) as unknown as OpenAI;

const expected: TokenUsage = { inputTokens: 1200, cachedInputTokens: 1000, outputTokens: 300 };
const format = { name: 'x', schema: {} };

describe('usage reporting for the spend cap', () => {
  it('reports what a streamed, a JSON and a text request used', async () => {
    const seen: TokenUsage[] = [];
    const model = openAIAnswerModel(fakeClient(), 'm', { onUsage: (u) => seen.push(u) });
    let text = '';
    for await (const d of model.streamJson({ instructions: '', input: [], format })) text += d;
    expect(text).toBe('{"a":1}');
    await model.completeJson({ instructions: '', input: [], format });
    await model.completeText({ instructions: '', input: [] });
    expect(seen).toEqual([expected, expected, expected]);
  });

  it('reports embedding tokens per batch', async () => {
    const tokens: number[] = [];
    await openAIEmbedder(fakeClient(), 'e', { onTokens: (t) => tokens.push(t) }).embed(['a', 'b']);
    expect(tokens).toEqual([42]);
  });

  it('reports transcription usage, by duration or by tokens', async () => {
    const seen: TranscriptionUsage[] = [];
    const audio = { bytes: new Uint8Array([1]), name: 'a.webm', type: 'audio/webm' };
    expect(await transcribeSpeech(fakeClient(), audio, undefined, (u) => seen.push(u))).toBe(
      'hello',
    );
    const byTokens = fakeClient({
      audio: {
        transcriptions: {
          create: async () => ({
            text: 'hi',
            usage: { type: 'tokens', input_tokens: 50, output_tokens: 5, total_tokens: 55 },
          }),
        },
      },
    });
    await transcribeSpeech(byTokens, audio, undefined, (u) => seen.push(u));
    expect(seen).toEqual([{ seconds: 7 }, { inputTokens: 50, outputTokens: 5 }]);
  });
});

describe('restingAnswer', () => {
  it('answers in character, with no sources and nothing for the validator to doubt', () => {
    const events = [...restingAnswer('en', 0, () => 5)];
    const final = events.at(-1);
    expect(final?.type).toBe('final');
    if (final?.type !== 'final') return;
    expect(final.answer).toMatchObject({ mode: 'conversational', citations: [], episodes: [] });
    expect(final.answer.blocks[0]).toMatchObject({ kind: 'paragraph' });
    const text = JSON.stringify(final.answer.blocks) + final.answer.spoken;
    expect(personaLint(text)).toEqual([]);
    expect(text).toMatch(/daily limit/);
  });

  it('rests in the interface language, and says which language it is in (P6-02)', () => {
    const final = [...restingAnswer('de', 0, () => 5)].at(-1);
    if (final?.type !== 'final') throw new Error('no final answer');
    expect(final.answer.language).toBe('de');
    expect(JSON.stringify(final.answer.blocks)).toMatch(/Tageslimit/);
  });
});

describe('speechInstructions (P6-02)', () => {
  it('keeps the style, and names the language when the text is not English', () => {
    expect(speechInstructions()).toMatch(/^Warm, relaxed/);
    expect(speechInstructions('en')).toBe(speechInstructions());
    expect(speechInstructions('de')).toMatch(/The text is in German/);
    expect(speechInstructions('zz')).toBe(speechInstructions());
  });
});
