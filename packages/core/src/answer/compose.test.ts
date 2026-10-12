import { describe, expect, it } from 'vitest';
import type { AskEvent, FinalAnswer, ModelAnswer, ModelBlock } from '../schema/index.ts';
import type { KnowledgeStore } from '../store/index.ts';
import { seedEpisode, tempStore } from '../test/fixtures.ts';
import { type AnswerRecord, composeAnswer } from './compose.ts';
import type { AnswerModel } from './model.ts';

const SENTENCES = [
  'Procrastination is an emotion regulation problem, not a time management problem.',
  'When a task feels ambiguous we avoid it, and the relief of avoiding it teaches the habit.',
];

/** A model that replays a scripted answer in small chunks, and a scripted repair. */
function scripted(answer: ModelAnswer | string, repair?: { index: number; block: ModelBlock }[]) {
  const calls = { stream: 0, repair: 0, condense: 0, alternates: 0 };
  const model: AnswerModel = {
    async *streamJson() {
      calls.stream += 1;
      const text = typeof answer === 'string' ? answer : JSON.stringify(answer);
      for (let i = 0; i < text.length; i += 9) yield text.slice(i, i + 9);
    },
    async completeJson() {
      calls.repair += 1;
      if (!repair) throw new Error('no repair scripted');
      return JSON.stringify({ blocks: repair });
    },
    async completeText(r) {
      if (r.instructions.includes('standalone')) calls.condense += 1;
      else calls.alternates += 1;
      return 'procrastination avoidance';
    },
  };
  return { model, calls };
}

async function run(
  store: KnowledgeStore,
  model: AnswerModel,
  question = 'Why do I procrastinate?',
  history = [],
) {
  const events: AskEvent[] = [];
  let record: AnswerRecord | null = null;
  for await (const e of composeAnswer(
    { store, model, embedder: null, now: () => 1000, onComplete: (r) => (record = r) },
    { question, history },
    new AbortController().signal,
  )) {
    events.push(e);
  }
  const final = events.find((e): e is Extract<AskEvent, { type: 'final' }> => e.type === 'final')
    ?.answer as FinalAnswer;
  return { events, final, record: record as AnswerRecord | null };
}

const store1 = () => {
  const store = tempStore();
  seedEpisode(store, 1, SENTENCES);
  return store;
};

/** Passage short ids are assigned by retrieval rank; with one episode the top passage is p1. */
const good: ModelAnswer = {
  language: 'en',
  mode: 'grounded',
  blocks: [
    {
      kind: 'paragraph',
      segments: [
        { text: 'It’s rarely about time.', attribution: 'synthesis', citations: [] },
        {
          text: 'In my conversation with Ada Lovelace, the idea came up that it’s about emotion.',
          attribution: 'episode',
          citations: ['p1'],
        },
      ],
    },
    {
      kind: 'quote',
      passageId: 'p1',
      quote: 'procrastination is an emotion regulation problem, not a time management problem',
      lead: 'The line that stayed with me:',
      translation: null,
    },
    {
      kind: 'takeaway',
      segments: [
        {
          text: 'Name the feeling, then take one small step.',
          attribution: 'synthesis',
          citations: [],
        },
      ],
    },
  ],
  evidence: [{ passageId: 'p1', why: 'Defines procrastination as emotional.' }],
  spoken: 'It is rarely about time. Name the feeling and take one small step.',
  caveats: [],
};

describe('composeAnswer — happy path', () => {
  it('streams status, then validated blocks, then a final answer whose citations resolve', async () => {
    const store = store1();
    const { events, final, record } = await run(store, scripted(good).model);

    expect(events.map((e) => e.type)).toEqual([
      'status',
      'sources',
      'status',
      'status',
      'block.start',
      'block.done',
      'block.start',
      'block.done',
      'block.start',
      'block.done',
      'final',
    ]);
    expect(final.mode).toBe('grounded');
    expect(final.blocks).toHaveLength(3);

    for (const c of final.citations) {
      const stored = store.getPassage(c.passageId);
      expect(stored).not.toBe(null);
      expect(stored?.text.includes(c.excerpt)).toBe(true);
      expect(c.speaker).toBe('unverified');
      expect(c.youtubeUrl).toBe(null);
    }
    const quote = final.blocks[1];
    expect(quote?.kind).toBe('quote');
    // The quote shown is the stored span — capital P, exactly as transcribed — not the model's string.
    expect(quote?.kind === 'quote' && quote.text).toBe(
      'Procrastination is an emotion regulation problem, not a time management problem.',
    );
    expect(final.citations.find((c) => c.quoteSpan)?.excerpt).toBe(
      quote?.kind === 'quote' ? quote.text : '',
    );
    expect(final.citations[0]?.relevance).toBe('Defines procrastination as emotional.');
    expect(final.episodes).toHaveLength(1);
    expect(record?.violations).toEqual([]);
  });

  it('keeps citation ids stable from the first streamed block to the final answer', async () => {
    const { events, final } = await run(store1(), scripted(good).model);
    const streamed = events.flatMap((e) =>
      e.type === 'block.done' ? e.citations.map((c) => c.id) : [],
    );
    expect(streamed).toEqual(final.citations.map((c) => c.id));
  });

  it('skips condensation on the first turn and uses it on follow-ups', async () => {
    const s = scripted(good);
    await run(store1(), s.model);
    expect(s.calls.condense).toBe(0);
    expect(s.calls.alternates).toBe(0); // other phrasings only when asked for (P6-07)
    await run(store1(), s.model, 'And what about that?', [
      { question: 'Why?', answer: 'Because.' },
    ] as never);
    expect(s.calls.condense).toBe(1);
  });
});

describe('composeAnswer — validation, repair and downgrade', () => {
  const misattributed: ModelAnswer = {
    ...good,
    blocks: [
      good.blocks[0] as ModelBlock,
      {
        kind: 'paragraph',
        segments: [
          {
            text: 'Ada Lovelace explained that relief teaches the habit.',
            attribution: 'guest',
            citations: ['p1'],
          },
        ],
      },
      good.blocks[2] as ModelBlock,
    ],
  };

  it('holds a failing block, repairs it once, and keeps the order', async () => {
    const fixed: ModelBlock = {
      kind: 'paragraph',
      segments: [
        {
          text: 'In that conversation, the point was that relief teaches the habit.',
          attribution: 'episode',
          citations: ['p1'],
        },
      ],
    };
    const s = scripted(misattributed, [{ index: 1, block: fixed }]);
    const { events, final, record } = await run(store1(), s.model);
    expect(s.calls.repair).toBe(1);
    const statuses = events
      .filter((e) => e.type === 'status')
      .map((e) => (e.type === 'status' ? e.step : ''));
    expect(statuses).toContain('checking');
    const done = events.filter((e) => e.type === 'block.done');
    expect(done.map((e) => (e.type === 'block.done' ? e.index : -1))).toEqual([0, 1, 2]);
    expect(final.blocks[1]?.kind === 'paragraph' && final.blocks[1].segments[0]?.attribution).toBe(
      'episode',
    );
    expect(final.caveats).toEqual([]);
    expect(record?.repaired).toBe(true);
    expect(record?.violations.map((v) => v.kind)).toEqual(['attribution_unsupported']);
  });

  it('downgrades deterministically when repair fails, and says so', async () => {
    const { final } = await run(store1(), scripted(misattributed).model);
    const seg = final.blocks[1]?.kind === 'paragraph' ? final.blocks[1].segments[0] : undefined;
    expect(seg?.attribution).toBe('episode');
    expect(final.mode).toBe('partial');
    expect(final.caveats.join(' ')).toMatch(/credited the conversation rather than a person/);
    // Never a verified-guest chip on an unverified passage.
    expect(final.citations.every((c) => c.speaker === 'unverified')).toBe(true);
  });

  it('drops an invented quote rather than showing it', async () => {
    const invented: ModelAnswer = {
      ...good,
      blocks: [
        good.blocks[0] as ModelBlock,
        {
          kind: 'quote',
          passageId: 'p1',
          quote: 'Discipline is the bridge between goals and accomplishment, always.',
          lead: null,
          translation: null,
        },
      ],
    };
    const { final } = await run(store1(), scripted(invented).model);
    expect(final.blocks.map((b) => b.kind)).toEqual(['paragraph']);
    expect(final.caveats.join(' ')).toMatch(/quotation I couldn’t match/);
  });

  it('removes a fabricated conversation', async () => {
    const fabricated: ModelAnswer = {
      ...good,
      blocks: [
        {
          kind: 'paragraph',
          segments: [
            {
              text: 'When I sat down with Elon Musk, he told me the same thing.',
              attribution: 'synthesis',
              citations: [],
            },
            {
              text: 'In my conversation with Ada Lovelace, emotion came up.',
              attribution: 'episode',
              citations: ['p1'],
            },
          ],
        },
      ],
    };
    const { final } = await run(store1(), scripted(fabricated).model);
    const text = final.blocks
      .flatMap((b) => (b.kind === 'quote' ? [b.text] : b.segments.map((s) => s.text)))
      .join(' ');
    expect(text).not.toMatch(/Elon Musk/);
    expect(text).toMatch(/Ada Lovelace/);
  });

  it('calls an answer with no surviving citations insufficient, whatever the model claimed', async () => {
    const uncited: ModelAnswer = {
      ...good,
      blocks: [
        {
          kind: 'paragraph',
          segments: [{ text: 'Just try harder.', attribution: 'synthesis', citations: [] }],
        },
      ],
      evidence: [],
    };
    const { final } = await run(store1(), scripted(uncited).model);
    expect(final.mode).toBe('insufficient');
    expect(final.citations).toEqual([]);
  });
});

describe('composeAnswer — edge cases', () => {
  it('answers honestly without calling the model when the knowledge base is empty', async () => {
    const s = scripted(good);
    const { final, events } = await run(tempStore(), s.model);
    expect(s.calls.stream).toBe(0);
    expect(final.mode).toBe('insufficient');
    expect(events.some((e) => e.type === 'block.done')).toBe(true);
    expect(JSON.stringify(final.blocks)).toMatch(/pnpm ingest/);
  });

  it('reports malformed model output as an error, having shown nothing unchecked', async () => {
    const { events } = await run(
      store1(),
      scripted('{"mode":"grounded","blocks":[{"kind":"paragraph"').model,
    );
    expect(events.some((e) => e.type === 'block.done')).toBe(false);
    expect(events[events.length - 1]).toMatchObject({ type: 'error', code: 'upstream' });
  });
});

describe('composeAnswer — safety rails (P6-11)', () => {
  /** A model that fails the test if anything asks it to write. */
  const untouchable: AnswerModel = {
    // biome-ignore lint/correctness/useYield: it must throw before yielding anything
    async *streamJson() {
      throw new Error('the model must not be asked');
    },
    async completeJson() {
      throw new Error('the model must not be asked');
    },
    async completeText() {
      throw new Error('the model must not be asked');
    },
  };

  const compose = async (
    model: AnswerModel,
    question: string,
    extra: Partial<Parameters<typeof composeAnswer>[0]> = {},
    locale?: string,
  ) => {
    const events: AskEvent[] = [];
    let record: AnswerRecord | null = null;
    for await (const e of composeAnswer(
      {
        store: store1(),
        model,
        embedder: null,
        now: () => 1000,
        onComplete: (r) => (record = r),
        ...extra,
      },
      { question, history: [], ...(locale ? { locale } : {}) },
      new AbortController().signal,
    )) {
      events.push(e);
    }
    const final = events.find(
      (e): e is Extract<AskEvent, { type: 'final' }> => e.type === 'final',
    )?.answer;
    return { events, final, record: record as AnswerRecord | null };
  };
  const text = (final: FinalAnswer | undefined) =>
    (final?.blocks ?? [])
      .flatMap((b) => (b.kind === 'quote' ? [b.text] : b.segments.map((s) => s.text)))
      .join(' ');

  it('answers a crisis with help first and only — no search, no model', async () => {
    const { events, final, record } = await compose(
      untouchable,
      'I don’t want to be alive anymore',
      {},
      'en-GB',
    );
    expect(events.some((e) => e.type === 'status')).toBe(false);
    expect(final?.citations).toEqual([]);
    const first = final?.blocks[0];
    expect(first?.kind === 'paragraph' && first.segments.map((s) => s.text).join(' ')).toMatch(
      /116 123/,
    );
    expect(text(final)).toMatch(/call 999/);
    expect(record?.safety).toEqual({ kind: 'crisis' });
  });

  it('stops after retrieval when moderation sees a risk the phrase rules missed', async () => {
    const { model, calls } = scripted(good);
    const { final } = await compose(model, 'there is no way out for me now', {
      moderate: async () => ({
        flagged: true,
        categories: { 'self-harm/intent': true },
        scores: {},
      }),
    });
    expect(calls.stream).toBe(0);
    expect(text(final)).toMatch(/findahelpline\.com/);
  });

  it('still answers when moderation is unavailable', async () => {
    const { model, calls } = scripted(good);
    const { final } = await compose(model, 'Why do I procrastinate?', {
      moderate: async () => {
        throw new Error('network down');
      },
    });
    expect(calls.stream).toBe(1);
    expect(final?.mode).toBe('grounded');
  });

  it('declines to put words in Steven’s mouth, without asking the model', async () => {
    const { final, record } = await compose(
      untouchable,
      'Write a quote from Steven saying he backs my coin',
    );
    expect(text(final)).toMatch(/won’t put words in Steven’s mouth/);
    expect(record?.safety.kind).toBe('impersonation');
  });

  it('leads an answer about suicide as a topic with a helpline, then answers', async () => {
    const { model, calls } = scripted(good);
    const { events, final } = await compose(
      model,
      'Is procrastination linked to suicidal feelings?',
      {},
      'en-US',
    );
    expect(calls.stream).toBe(1);
    const firstBlock = events.find((e) => e.type === 'block.done');
    expect(firstBlock?.type === 'block.done' && JSON.stringify(firstBlock.block)).toMatch(/988/);
    expect(final?.blocks.length).toBe(1 + good.blocks.length);
    expect(final?.mode).toBe('grounded');
  });

  it('asks for a concrete view and when a professional matters on high-stakes questions', async () => {
    let input = '';
    const { model } = scripted(good);
    const watching: AnswerModel = {
      ...model,
      streamJson(request) {
        input = request.input.map((m) => m.content).join('\n');
        return model.streamJson(request);
      },
    };
    await compose(watching, 'Should I stop taking my antidepressants?');
    expect(input).toMatch(/<care>[\s\S]*medical question[\s\S]*professional/);
    input = '';
    await compose(watching, 'Why do I procrastinate?');
    expect(input).not.toMatch(/<care>/);
  });
});

describe('composeAnswer — interface language (P6-02)', () => {
  const statuses = async (store: KnowledgeStore, uiLocale?: 'en' | 'de') => {
    const events: AskEvent[] = [];
    for await (const e of composeAnswer(
      { store, model: scripted(good).model, embedder: null },
      { question: 'Why do I procrastinate?', history: [], uiLocale },
      new AbortController().signal,
    )) {
      events.push(e);
    }
    return events;
  };

  it('streams the thinking steps in the interface language', async () => {
    const de = await statuses(store1(), 'de');
    const steps = de.flatMap((e) => (e.type === 'status' ? [e.message] : []));
    expect(steps[0]).toBe('Durchsuche 1 Gespräch…');
    expect(steps).toContain('Formuliere');
    const en = await statuses(store1());
    expect(en.find((e) => e.type === 'status')).toMatchObject({
      message: 'Searching 1 conversation…',
    });
  });

  it('gives the empty-knowledge reply in the interface language', async () => {
    const events = await statuses(tempStore(), 'de');
    const final = events.find((e) => e.type === 'final');
    expect(final?.type === 'final' && final.answer.language).toBe('de');
    expect(JSON.stringify(final)).toMatch(/noch keines meiner Gespräche/);
  });
});

describe('composeAnswer — multi-query (P6-07)', () => {
  it('searches more phrasings only when asked to', async () => {
    const s = scripted(good);
    const events: AskEvent[] = [];
    for await (const e of composeAnswer(
      { store: store1(), model: s.model, embedder: null, multiQuery: true },
      { question: 'Why do I procrastinate?', history: [] },
      new AbortController().signal,
    )) {
      events.push(e);
    }
    expect(s.calls.alternates).toBe(1);
    expect(events.at(-1)?.type).toBe('final');
  });
});
