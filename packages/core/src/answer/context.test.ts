import { describe, expect, it } from 'vitest';
import { hybridSearch } from '../retrieval/index.ts';
import { seedEpisode, tempStore } from '../test/fixtures.ts';
import { alternateQueries } from './condense.ts';
import { buildContext, renderSources } from './context.ts';
import type { AnswerModel } from './model.ts';
import { validateBlock } from './validate.ts';

const LONG = [
  'First the guest talks about growing up poor in a small town, sharing a bedroom with three brothers, working weekends in a bakery and saving every coin for a second-hand bicycle.',
  'Then the guest explains the first business, a market stall selling phone cases on Saturdays, the early mornings, the cold, the regulars who came back, and the first month that made a profit.',
  'Finally the guest says the stall taught them to sell, to read a face, to price quickly and to walk away from a bad deal, which mattered more than anything they later learned at university.',
];

describe('buildContext — more of each conversation (P6-07)', () => {
  it('shows what was said around a passage, and a generated overview of the conversation', async () => {
    const store = tempStore();
    const id = seedEpisode(store, 1, LONG);
    store.setSummary(id, 'A founder on learning to sell at a market stall.');
    const retrieval = await hybridSearch(store, 'market stall phone cases', null, { take: 1 });
    const ctx = buildContext(store, retrieval.passages);
    expect(ctx.sources[0]?.before).toMatch(/bakery|bicycle/);
    expect(ctx.sources[0]?.after).toMatch(/taught them to sell/);
    expect(ctx.episodes).toEqual([
      { title: expect.any(String), summary: 'A founder on learning to sell at a market stall.' },
    ]);
    const rendered = renderSources(ctx);
    expect(rendered).toMatch(/<episodes>\n<episode title="[^"]+" generated="true">A founder on/);
    expect(rendered).toMatch(
      /<source id="p1"[^>]*>\n<before>[\s\S]*<\/before>\n[\s\S]*\n<after>[\s\S]*<\/after>\n<\/source>/,
    );
  });

  it('keeps neighbours to the strongest sources and trims them to the word budget', async () => {
    const store = tempStore();
    seedEpisode(store, 1, LONG);
    const retrieval = await hybridSearch(store, 'market stall phone cases', null, { take: 1 });
    const none = buildContext(store, retrieval.passages, {
      neighbourSources: 0,
      neighbourWords: 90,
    });
    expect(none.sources[0]?.before).toBeNull();
    const short = buildContext(store, retrieval.passages, {
      neighbourSources: 6,
      neighbourWords: 5,
    });
    expect(short.sources[0]?.before).toMatch(/^…(\S+\s){4}\S+$/);
    expect(short.sources[0]?.after).toMatch(/^(\S+\s){4}\S+…$/);
  });

  it('never lets a quote come from the surrounding text — only the passage itself', async () => {
    const store = tempStore();
    seedEpisode(store, 1, LONG);
    const retrieval = await hybridSearch(store, 'market stall phone cases', null, { take: 1 });
    const ctx = buildContext(store, retrieval.passages);
    const fromNeighbour = validateBlock(
      {
        kind: 'quote',
        passageId: 'p1',
        quote: 'working weekends in a bakery and saving every coin',
        lead: null,
        translation: null,
      },
      0,
      ctx,
    );
    expect(fromNeighbour.violations.map((v) => v.kind)).toEqual(['quote_not_found']);
  });
});

describe('multi-query retrieval (P6-07)', () => {
  it('finds a passage the asker’s words miss, through another phrasing', async () => {
    const store = tempStore();
    seedEpisode(store, 1, ['Selling phone cases at a market stall taught me how to price.']);
    seedEpisode(store, 2, ['Sleep is the foundation of everything else in your health.']);
    const plain = await hybridSearch(store, 'how do I learn negotiation', null);
    expect(plain.passages).toEqual([]);
    const fused = await hybridSearch(store, 'how do I learn negotiation', null, {
      alternates: ['learning to price by selling at a market stall'],
    });
    expect(fused.passages[0]?.text).toMatch(/market stall/);
  });

  it('reads up to two new phrasings, and none when the model fails', async () => {
    const model = (reply: string | Error): AnswerModel => ({
      // biome-ignore lint/correctness/useYield: unused here
      async *streamJson() {
        throw new Error('unused');
      },
      async completeJson() {
        throw new Error('unused');
      },
      async completeText() {
        if (reply instanceof Error) throw reply;
        return reply;
      },
    });
    expect(
      await alternateQueries(
        model(
          '1. "learning to sell young"\n- how founders learned to sell\nhow do i learn negotiation\nthird one',
        ),
        'how do I learn negotiation',
      ),
    ).toEqual(['learning to sell young', 'how founders learned to sell']);
    expect(await alternateQueries(model(new Error('down')), 'q')).toEqual([]);
  });
});
