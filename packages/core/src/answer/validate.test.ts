import { describe, expect, it } from 'vitest';
import { hybridSearch } from '../retrieval/index.ts';
import type { ModelBlock, ModelSegment, Segment } from '../schema/index.ts';
import { seedEpisode, tempStore } from '../test/fixtures.ts';
import { buildContext } from './context.ts';
import { downgradeBlock, matchesGuest, validateBlock } from './validate.ts';

const diarized = (texts: [Segment['speaker'], string][]): Segment[] =>
  texts.map(([speaker, text], idx) => ({
    idx,
    startMs: idx * 9000,
    endMs: idx * 9000 + 8000,
    speaker,
    speakerName: speaker === 'host' ? 'Steven Bartlett' : 'Grace Hopper',
    attributionMethod: 'diarization',
    attributionConfidence: null,
    text,
  }));

async function setup() {
  const store = tempStore();
  // Episode 1: RSS VTT — speakers unknown.
  seedEpisode(store, 1, [
    'Procrastination is really about avoiding a bad feeling, not about laziness at all.',
  ]);
  // Episode 2: diarized — verified host and guest.
  seedEpisode(
    store,
    2,
    [],
    diarized([
      ['host', 'Why do people procrastinate on the work that matters most to them?'],
      [
        'guest',
        'Procrastination is an emotion regulation problem and the relief of avoidance teaches the habit.',
      ],
    ]),
  );
  // Episode 3 exists in the knowledge base but will not be retrieved.
  seedEpisode(store, 3, [
    'Sleep debt compounds like financial debt, and you cannot repay it at the weekend.',
  ]);
  const { passages } = await hybridSearch(store, 'procrastination avoidance feeling', null);
  const ctx = buildContext(store, passages);
  const vtt = ctx.sources.find((s) => s.passage.episode.guestNames[0] === 'Ada Lovelace');
  const dia = ctx.sources.find((s) => s.passage.episode.guestNames[0] === 'Grace Hopper');
  if (!vtt || !dia) throw new Error('fixture retrieval failed');
  return { ctx, vtt: vtt.shortId, dia: dia.shortId };
}

const para = (segments: ModelSegment[]): ModelBlock => ({
  kind: 'paragraph',
  segments,
});

describe('validateBlock — speaker evidence', () => {
  it('accepts a guest statement only when the passage has verified guest lines', async () => {
    const { ctx, vtt, dia } = await setup();
    const ok = validateBlock(
      para([
        {
          text: 'Grace Hopper explained it is about emotion.',
          attribution: 'guest',
          citations: [dia],
        },
      ]),
      0,
      ctx,
    );
    expect(ok.violations).toEqual([]);
    const bad = validateBlock(
      para([
        {
          text: 'Ada Lovelace explained it is about feelings.',
          attribution: 'guest',
          citations: [vtt],
        },
      ]),
      0,
      ctx,
    );
    expect(bad.violations.map((v) => v.kind)).toEqual(['attribution_unsupported']);
  });

  it('accepts a host statement only with verified host lines', async () => {
    const { ctx, vtt, dia } = await setup();
    expect(
      validateBlock(para([{ text: 'I asked why.', attribution: 'host', citations: [dia] }]), 0, ctx)
        .violations,
    ).toEqual([]);
    expect(
      validateBlock(
        para([{ text: 'I said it is laziness.', attribution: 'host', citations: [vtt] }]),
        0,
        ctx,
      ).violations[0]?.kind,
    ).toBe('attribution_unsupported');
  });

  it('allows episode-level claims on unverified passages', async () => {
    const { ctx, vtt } = await setup();
    const r = validateBlock(
      para([
        {
          text: 'In my conversation with Ada Lovelace, avoidance came up.',
          attribution: 'episode',
          citations: [vtt],
        },
      ]),
      0,
      ctx,
    );
    expect(r.violations).toEqual([]);
  });
});

describe('validateBlock — citations', () => {
  it('drops citations to passages that were never retrieved', async () => {
    const { ctx, vtt } = await setup();
    const r = validateBlock(
      para([{ text: 'It came up.', attribution: 'episode', citations: ['p99', vtt] }]),
      0,
      ctx,
    );
    expect(r.block.kind === 'paragraph' && r.block.segments[0]?.citations).toEqual([vtt]);
    expect(r.violations).toEqual([]);
  });

  it('flags a sourced claim left with no valid citation', async () => {
    const { ctx } = await setup();
    const r = validateBlock(
      para([{ text: 'Someone said this.', attribution: 'guest', citations: ['p42'] }]),
      0,
      ctx,
    );
    expect(r.violations.map((v) => v.kind)).toEqual(['uncited_claim']);
  });

  it('clears citations from synthesis instead of letting reasoning borrow a source', async () => {
    const { ctx, vtt } = await setup();
    const r = validateBlock(
      para([{ text: 'I’d start small.', attribution: 'synthesis', citations: [vtt] }]),
      0,
      ctx,
    );
    expect(r.block.kind === 'paragraph' && r.block.segments[0]?.citations).toEqual([]);
    expect(r.violations).toEqual([]);
  });
});

describe('validateBlock — fabricated guests and conversations', () => {
  it('flags a conversation that is not in the sources', async () => {
    const { ctx } = await setup();
    const r = validateBlock(
      para([
        {
          text: 'When I sat down with Elon Musk, he said the same.',
          attribution: 'synthesis',
          citations: [],
        },
      ]),
      0,
      ctx,
    );
    expect(r.violations.map((v) => v.kind)).toEqual(['conversation_not_in_sources']);
  });

  it('flags a known guest from elsewhere in the knowledge base', async () => {
    const { ctx } = await setup();
    const r = validateBlock(
      para([{ text: 'Alan Turing would disagree.', attribution: 'synthesis', citations: [] }]),
      0,
      ctx,
    );
    expect(r.violations.map((v) => v.kind)).toContain('unknown_guest');
  });

  it('flags crediting one conversation with another episode’s passage', async () => {
    const { ctx, vtt } = await setup();
    const r = validateBlock(
      para([
        {
          text: 'In my conversation with Grace Hopper, avoidance came up.',
          attribution: 'episode',
          citations: [vtt],
        },
      ]),
      0,
      ctx,
    );
    expect(r.violations.map((v) => v.kind)).toEqual(['guest_not_in_cited_episode']);
  });
});

describe('validateBlock — quotes', () => {
  it('accepts a verbatim quote and rejects an invented one', async () => {
    const { ctx, vtt } = await setup();
    const ok = validateBlock(
      {
        kind: 'quote',
        passageId: vtt,
        quote: 'Procrastination is really about avoiding a bad feeling',
        lead: null,
      },
      0,
      ctx,
    );
    expect(ok.violations).toEqual([]);
    const bad = validateBlock(
      {
        kind: 'quote',
        passageId: vtt,
        quote: 'Discipline beats motivation every single day of the week',
        lead: null,
      },
      0,
      ctx,
    );
    expect(bad.violations.map((v) => v.kind)).toEqual(['quote_not_found']);
    const unknown = validateBlock(
      { kind: 'quote', passageId: 'p77', quote: 'Anything at all goes here', lead: null },
      0,
      ctx,
    );
    expect(unknown.violations.map((v) => v.kind)).toEqual(['quote_unknown_passage']);
  });
});

describe('downgradeBlock', () => {
  it('turns unsupported speaker claims into episode-level, and uncited claims into synthesis', async () => {
    const { ctx, vtt } = await setup();
    const block = para([
      { text: 'Ada Lovelace explained it.', attribution: 'guest', citations: [vtt] },
      { text: 'A guest said this.', attribution: 'guest', citations: [] },
      { text: 'When I spoke with Elon Musk he agreed.', attribution: 'synthesis', citations: [] },
    ]);
    const { block: out, notes } = downgradeBlock(block, validateBlock(block, 0, ctx).violations);
    expect(out?.kind === 'paragraph' && out.segments.map((s) => s.attribution)).toEqual([
      'episode',
      'synthesis',
    ]);
    expect([...notes].sort()).toEqual(['removed', 'speaker']);
  });

  it('drops a quote that could not be matched', () => {
    const { block, notes } = downgradeBlock(
      { kind: 'quote', passageId: 'p1', quote: 'x', lead: null },
      [{ blockIndex: 0, segmentIndex: null, kind: 'quote_not_found', message: '' }],
    );
    expect(block).toBe(null);
    expect([...notes]).toEqual(['quote']);
  });
});

describe('matchesGuest', () => {
  it('matches full names, surnames and honorific variants', () => {
    expect(matchesGuest('Huberman', ['Andrew Huberman'])).toBe(true);
    expect(matchesGuest('Andy Galpin', ['Dr Andy Galpin'])).toBe(true);
    expect(matchesGuest('Elon Musk', ['Andrew Huberman'])).toBe(false);
  });
});
