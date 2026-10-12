import { describe, expect, it } from 'vitest';
import { searchQuery } from '../answer/condense.ts';
import { buildContext } from '../answer/context.ts';
import type { AnswerModel } from '../answer/model.ts';
import { CitationRegistry, resolveBlock } from '../answer/resolve.ts';
import { validateBlock } from '../answer/validate.ts';
import { embeddingInput } from '../openai/embedder.ts';
import { hybridSearch } from '../retrieval/index.ts';
import { fakeEmbedder, seedEpisode, tempStore } from '../test/fixtures.ts';

/** A model whose only job here is the one-line query rewrite. */
const rewriter = (reply: string | Error) => {
  const calls: string[] = [];
  const model: AnswerModel = {
    // biome-ignore lint/correctness/useYield: not used in these tests
    async *streamJson() {
      throw new Error('unused');
    },
    async completeJson() {
      throw new Error('unused');
    },
    async completeText(r) {
      calls.push(r.input.map((m) => m.content).join('\n'));
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
  return { model, calls };
};

describe('searchQuery (P6-01)', () => {
  it('searches a first English question as it is, without asking the model', async () => {
    const { model, calls } = rewriter('unused');
    expect(await searchQuery(model, 'Why do I procrastinate?', [], 'en')).toBe(
      'Why do I procrastinate?',
    );
    expect(calls).toEqual([]);
  });

  it('turns a question in another language into an English search query', async () => {
    const { model, calls } = rewriter('"why do I procrastinate"');
    expect(await searchQuery(model, 'Warum prokrastiniere ich?', [], 'de')).toBe(
      'why do I procrastinate',
    );
    expect(calls).toEqual(['Warum prokrastiniere ich?']);
  });

  it('falls back to the question itself when the rewrite fails', async () => {
    const { model } = rewriter(new Error('down'));
    expect(await searchQuery(model, '¿Por qué procrastino?', [], 'es')).toBe(
      '¿Por qué procrastino?',
    );
  });
});

describe('hybridSearch — the question in its own language as well (P6-01)', () => {
  it('runs a semantic search for each text and fuses them', async () => {
    const store = tempStore();
    seedEpisode(store, 1, ['Procrastination is about avoiding a bad feeling.']);
    seedEpisode(store, 2, ['Kaffee am Nachmittag ruiniert den Schlaf.']);
    const passages = store.passagesNeedingEmbedding(fakeEmbedder.model, 100);
    store.setEmbeddings(
      await Promise.all(
        passages.map(async (p) => ({
          pk: p.pk,
          embedding: (await fakeEmbedder.embed([embeddingInput(p)]))[0] as Float32Array,
        })),
      ),
      fakeEmbedder.model,
    );
    const english = await hybridSearch(store, 'procrastination feeling', fakeEmbedder, { take: 1 });
    expect(english.modes).toEqual(['keyword', 'semantic']);
    const both = await hybridSearch(store, 'procrastination feeling', fakeEmbedder, {
      alsoSemantic: ['Kaffee Nachmittag Schlaf'],
    });
    expect(both.modes).toEqual(['keyword', 'semantic']);
    expect(new Set(both.passages.map((p) => p.episodeId)).size).toBe(2);
  });
});

describe('quotes in an answer that is not in English (P6-01)', () => {
  const setup = async () => {
    const store = tempStore();
    seedEpisode(store, 1, [
      'Procrastination is really about avoiding a bad feeling, not about laziness at all.',
    ]);
    const retrieval = await hybridSearch(store, 'procrastination', null);
    return buildContext(store, retrieval.passages);
  };

  it('still rejects a quote that is a translation instead of the words said — no rule relaxed', async () => {
    const ctx = await setup();
    const check = validateBlock(
      {
        kind: 'quote',
        passageId: 'p1',
        quote: 'Prokrastination bedeutet in Wahrheit, ein schlechtes Gefühl zu vermeiden',
        lead: null,
        translation: null,
      },
      0,
      ctx,
    );
    expect(check.violations.map((v) => v.kind)).toEqual(['quote_not_found']);
  });

  it('shows the stored English span, with the translation kept apart', async () => {
    const ctx = await setup();
    const block = {
      kind: 'quote' as const,
      passageId: 'p1',
      quote: 'Procrastination is really about avoiding a bad feeling',
      lead: 'Der Satz, der hängen blieb:',
      translation: '  Prokrastination bedeutet in Wahrheit, ein schlechtes Gefühl zu vermeiden.  ',
    };
    expect(validateBlock(block, 0, ctx).violations).toEqual([]);
    const resolved = resolveBlock(block, new CitationRegistry(ctx));
    expect(resolved?.block).toEqual({
      kind: 'quote',
      citationId: 'c1',
      lead: 'Der Satz, der hängen blieb:',
      text: 'Procrastination is really about avoiding a bad feeling',
      translation: 'Prokrastination bedeutet in Wahrheit, ein schlechtes Gefühl zu vermeiden.',
    });
  });
});
