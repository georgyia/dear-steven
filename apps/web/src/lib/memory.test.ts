import type { FinalAnswer } from '@dear-steven/core/schema';
import { describe, expect, it } from 'vitest';
import { conversationReducer, initialConversation, type Turn } from './conversation';
import { DEMO_ANSWERS } from './demo-fixtures';
import { parseStored, restoredTurns, toStored } from './memory';

const demo = DEMO_ANSWERS[0];
if (!demo) throw new Error('no demo answer');
const final: FinalAnswer = {
  language: 'en',
  mode: demo.mode,
  blocks: demo.blocks,
  citations: demo.citations,
  episodes: [],
  spoken: demo.spoken,
  caveats: demo.caveats,
  demo: true,
  elapsedMs: 3200,
};
const turn = (id: string, over: Partial<Turn> = {}): Turn => ({
  id,
  question: 'Why do I keep procrastinating?',
  status: 'done',
  steps: [{ step: 'searching', message: 'Searching…' }],
  sources: { passages: 9, episodes: 3 },
  writingIndex: null,
  blocks: final.blocks,
  citations: Object.fromEntries(final.citations.map((c) => [c.id, c])),
  final,
  error: null,
  startedAt: 100,
  elapsedMs: 3200,
  ...over,
});

describe('conversations stored before answers had a language (P6-01)', () => {
  it('still restore, as English, with quotes untranslated', () => {
    const legacy = toStored([turn('t1')]) as unknown as {
      turns: { final: Record<string, unknown> }[];
    };
    const old = JSON.parse(JSON.stringify(legacy));
    for (const t of old.turns) {
      delete t.final.language;
      for (const b of t.final.blocks as Record<string, unknown>[]) delete b.translation;
    }
    const [restored] = parseStored(old) ?? [];
    expect(restored?.final.language).toBe('en');
    const quote = restored?.final.blocks.find((b) => b.kind === 'quote');
    expect(quote && 'translation' in quote ? quote.translation : 'missing').toBeNull();
  });
});

describe('conversation memory', () => {
  it('keeps only finished turns, and restores them ready to read', () => {
    const stored = toStored([
      turn('t1'),
      turn('t2', { status: 'streaming', final: null }),
      turn('t3', { status: 'error', final: null }),
    ]);
    expect(stored.turns.map((t) => t.id)).toEqual(['t1']);
    const back = parseStored(JSON.parse(JSON.stringify(stored)));
    expect(back).toHaveLength(1);
    const [restored] = restoredTurns(back ?? []);
    expect(restored).toMatchObject({ id: 't1', status: 'done', elapsedMs: 3200 });
    expect(restored?.blocks).toEqual(final.blocks);
    expect(Object.keys(restored?.citations ?? {})).toEqual(final.citations.map((c) => c.id));
  });

  it('treats storage as untrusted: bad answers are dropped and links are rebuilt from ids', () => {
    const stored = JSON.parse(JSON.stringify(toStored([turn('t1'), turn('t2')])));
    stored.turns[0].final.blocks = 'not blocks';
    const c = stored.turns[1].final.citations[0];
    c.youtubeUrl = 'javascript:alert(1)';
    c.embedUrl = 'https://evil.example/embed';
    c.episode.audioUrl = 'http://insecure.example/a.mp3';
    const d = stored.turns[1].final.citations[1];
    d.episode.youtubeVideoId = 'dQw4w9WgXcQ';
    d.timestamp = { ms: 61_500, state: 'exact' };
    d.youtubeUrl = 'https://evil.example/watch';
    stored.turns[1].id = '<img src=x>';
    stored.turns[1].steps.push({ step: 'hacking', message: 'x' });
    const back = parseStored(stored);
    expect(back).toHaveLength(1);
    const kept = back?.[0];
    expect(kept?.id).toBe('restored1');
    expect(kept?.steps.map((s) => s.step)).toEqual(['searching']);
    const relinked = kept?.final.citations[0];
    expect(relinked?.youtubeUrl).toBe(null); // demo citations have no video id
    expect(relinked?.embedUrl).toBe(null);
    expect(relinked?.episode.audioUrl).toBe(null);
    expect(kept?.final.citations[1]?.youtubeUrl).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=61s',
    );
  });

  it('ignores anything that is not a stored conversation', () => {
    expect(parseStored(null)).toBe(null);
    expect(parseStored('text')).toBe(null);
    expect(parseStored({ version: 2, turns: [] })).toBe(null);
    expect(parseStored({ version: 1, turns: 'x' })).toBe(null);
    expect(parseStored({ version: 1, turns: [] })).toEqual([]);
  });

  it('restores only into an empty conversation', () => {
    const turns = restoredTurns(parseStored(toStored([turn('t1')])) ?? []);
    expect(conversationReducer(initialConversation, { type: 'restore', turns }).turns).toHaveLength(
      1,
    );
    const started = { turns: [turn('mine', { status: 'streaming', final: null })] };
    expect(conversationReducer(started, { type: 'restore', turns })).toBe(started);
  });
});

describe('talk turns in memory (P7-05)', () => {
  it('come back as talk turns; anything else stored as a mode is ignored', () => {
    const stored = JSON.parse(JSON.stringify(toStored([turn('t1', { mode: 'talk' }), turn('t2')])));
    expect(stored.turns.map((t: { mode?: string }) => t.mode)).toEqual(['talk', undefined]);
    stored.turns[1].mode = 'interview<script>';
    const [talk, ask] = restoredTurns(parseStored(stored) ?? []);
    expect(talk?.mode).toBe('talk');
    expect(ask && 'mode' in ask).toBe(false);
  });
});

describe('the conversation reducer and modes (P7-05)', () => {
  it('marks a turn started in talk mode, and only that one', () => {
    let state = conversationReducer(initialConversation, {
      type: 'turn.start',
      id: 'a',
      question: 'Hi',
      at: 0,
      mode: 'talk',
    });
    state = conversationReducer(state, { type: 'turn.start', id: 'b', question: 'Hi', at: 0 });
    state = conversationReducer(state, {
      type: 'turn.start',
      id: 'c',
      question: 'Hi',
      at: 0,
      mode: 'ask',
    });
    expect(state.turns.map((t) => t.mode)).toEqual(['talk', undefined, undefined]);
  });
});
