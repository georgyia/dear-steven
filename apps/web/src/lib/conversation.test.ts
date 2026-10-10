import type { AskEvent, Citation, ResolvedBlock } from '@dear-steven/core/schema';
import { describe, expect, it } from 'vitest';
import {
  answerText,
  type ConversationState,
  citationOrder,
  conversationReducer,
  historyFor,
  initialConversation,
} from './conversation.ts';

const citation = (id: string): Citation => ({
  id,
  passageId: `ps_${id}`,
  episode: {
    id: 'ep_1',
    title: 'Episode',
    guestNames: ['Guest'],
    publishedAt: '2026-01-01T00:00:00Z',
    youtubeVideoId: null,
    demo: true,
  },
  speaker: 'unverified',
  speakerName: null,
  startMs: 0,
  endMs: 1000,
  timestamp: { ms: 0, state: 'unknown' },
  youtubeUrl: null,
  excerpt: 'text',
  quoteSpan: null,
  relevance: null,
  quality: 'asr',
});

const paragraph = (ids: string[]): ResolvedBlock => ({
  kind: 'paragraph',
  segments: [
    { text: 'Hello.', attribution: ids.length ? 'episode' : 'synthesis', citationIds: ids },
  ],
});

const start = (): ConversationState =>
  conversationReducer(initialConversation, {
    type: 'turn.start',
    id: 't1',
    question: 'Why?',
    at: 0,
  });

const send = (state: ConversationState, event: AskEvent, at = 10) =>
  conversationReducer(state, { type: 'turn.event', id: 't1', event, at });

describe('conversationReducer', () => {
  it('collects steps, replacing a repeated step instead of duplicating it', () => {
    let s = start();
    s = send(s, { type: 'status', step: 'searching', message: 'Searching…' });
    s = send(s, { type: 'status', step: 'searching', message: 'Searching 12…' });
    s = send(s, { type: 'status', step: 'found', message: 'Found 3' });
    expect(s.turns[0]?.steps.map((x) => x.message)).toEqual(['Searching 12…', 'Found 3']);
  });

  it('places validated blocks by index and merges their citations', () => {
    let s = start();
    s = send(s, { type: 'block.start', index: 0 });
    expect(s.turns[0]?.writingIndex).toBe(0);
    s = send(s, {
      type: 'block.done',
      index: 0,
      block: paragraph(['c1']),
      citations: [citation('c1')],
    });
    expect(s.turns[0]?.writingIndex).toBe(null);
    expect(s.turns[0]?.blocks).toHaveLength(1);
    expect(Object.keys(s.turns[0]?.citations ?? {})).toEqual(['c1']);
  });

  it('takes the final answer as authoritative', () => {
    let s = start();
    s = send(s, {
      type: 'block.done',
      index: 0,
      block: paragraph(['c1']),
      citations: [citation('c1')],
    });
    s = send(s, {
      type: 'final',
      answer: {
        mode: 'partial',
        blocks: [paragraph([])],
        citations: [],
        episodes: [],
        spoken: '',
        caveats: ['Only one source.'],
        demo: true,
        elapsedMs: 1200,
      },
    });
    const t = s.turns[0];
    expect(t?.status).toBe('done');
    expect(t?.citations).toEqual({});
    expect(t?.elapsedMs).toBe(1200);
  });

  it('ignores events after the turn has settled', () => {
    let s = start();
    s = conversationReducer(s, { type: 'turn.stopped', id: 't1', at: 50 });
    s = send(s, { type: 'block.done', index: 0, block: paragraph([]), citations: [] });
    expect(s.turns[0]?.status).toBe('stopped');
    expect(s.turns[0]?.blocks).toHaveLength(0);
  });

  it('records server errors with their code', () => {
    const s = send(start(), { type: 'error', code: 'rate_limited', message: 'Slow down' });
    expect(s.turns[0]?.status).toBe('error');
    expect(s.turns[0]?.error?.code).toBe('rate_limited');
  });
});

describe('citationOrder', () => {
  it('orders citations by first appearance, including quotes', () => {
    const order = citationOrder({
      blocks: [
        paragraph(['c2', 'c1']),
        { kind: 'quote', citationId: 'c3', lead: null, text: 'q' },
        paragraph(['c1']),
      ],
      citations: { c1: citation('c1'), c2: citation('c2'), c3: citation('c3') },
    });
    expect(order).toEqual(['c2', 'c1', 'c3']);
  });
});

describe('historyFor', () => {
  it('sends only finished turns, as plain text', () => {
    let s = start();
    s = send(s, { type: 'block.done', index: 0, block: paragraph([]), citations: [] });
    expect(historyFor(s.turns)).toEqual([]);
    s = conversationReducer(s, { type: 'turn.stopped', id: 't1', at: 99 });
    expect(historyFor(s.turns)).toEqual([{ question: 'Why?', answer: 'Hello.' }]);
  });

  it('renders quotes in quotation marks', () => {
    expect(answerText([{ kind: 'quote', citationId: 'c', lead: null, text: 'Do the work.' }])).toBe(
      '“Do the work.”',
    );
  });
});
