import type { FinalAnswer } from '@dear-steven/core/schema';
import { describe, expect, it } from 'vitest';
import { de } from '@/i18n/de';
import { en } from '@/i18n/en';
import { conversationReducer, initialConversation } from './conversation';
import { DEMO_ANSWERS } from './demo-fixtures';
import { restoredTurns } from './memory';
import { sharedToken, shareLink } from './share';
import { cardContent, wrap } from './share-card';

const demo = DEMO_ANSWERS[0];
if (!demo) throw new Error('no demo answer');
const answer: FinalAnswer = {
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

describe('share links (P6-17)', () => {
  it('carry the token in the fragment, and give it back', () => {
    const link = shareLink('https://example.org', 'v1.abc.def');
    expect(link).toBe('https://example.org/#share=v1.abc.def');
    expect(sharedToken(new URL(link).hash)).toBe('v1.abc.def');
  });

  it('are told apart from any other fragment', () => {
    expect(sharedToken('')).toBeNull();
    expect(sharedToken('#turn-t1')).toBeNull();
    expect(sharedToken('#share=')).toBe('');
  });

  it('open as one finished turn after whatever is already there', () => {
    const [restored] = restoredTurns([
      { id: 'old', question: 'Q1', steps: [], sources: null, final: answer },
    ]);
    const [shared] = restoredTurns([
      { id: 's1', question: 'Q2', steps: [], sources: null, final: answer },
    ]);
    if (!restored || !shared) throw new Error('no turns');
    const before = conversationReducer(initialConversation, { type: 'restore', turns: [restored] });
    const after = conversationReducer(before, {
      type: 'append',
      turn: { ...shared, shared: true },
    });
    expect(after.turns.map((t) => [t.id, t.status, t.shared])).toEqual([
      ['old', 'done', undefined],
      ['s1', 'done', true],
    ]);
  });
});

describe('the image card', () => {
  it('shows the opening, the first quote with who said it, the advice and the sources', () => {
    const card = cardContent('Why do I procrastinate?', answer);
    const quote = answer.blocks.find((b) => b.kind === 'quote');
    expect(card.question).toBe('Why do I procrastinate?');
    expect(card.lead).toBeTruthy();
    expect(card.quote?.text).toBe(quote?.kind === 'quote' ? quote.text : 'missing');
    expect(card.quote?.citation.id).toBe(quote?.kind === 'quote' ? quote.citationId : 'missing');
    expect(card.sources.length).toBeGreaterThan(0);
    expect(card.sources.length).toBeLessThanOrEqual(3);
    const episodes = card.sources.map((c) => c.episode.id);
    expect(new Set(episodes).size).toBe(episodes.length);
    expect(card.sources[0]?.id).toBe(
      answer.blocks.flatMap((b) =>
        b.kind === 'quote' ? [b.citationId] : b.segments.flatMap((s) => s.citationIds),
      )[0],
    );
    expect(card.demo).toBe(true);
  });

  it('never shows a quote it cannot attribute', () => {
    const card = cardContent('Q', { ...answer, citations: [] });
    expect(card.quote).toBeNull();
    expect(card.sources).toEqual([]);
  });

  it('draws the whole disclosure on a card, never cut short (P10-11)', () => {
    // The card's text is 904 px wide (1080 less 88 a side) at 24 px. Measured pessimistically at
    // 0.62 em a character, both languages still fit the three lines the card gives it, uncut.
    const measure = (s: string) => s.length * 24 * 0.62;
    for (const disclosure of [en.disclosure, de.disclosure]) {
      const lines = wrap(measure, disclosure, 904, 3);
      expect(lines.join(' ')).toBe(disclosure);
      expect(lines.at(-1)).not.toMatch(/…$/);
    }
  });

  it('wraps to the width and marks what it had to cut', () => {
    const measure = (s: string) => s.length;
    expect(wrap(measure, 'one two three four', 9, 3)).toEqual(['one two', 'three', 'four']);
    expect(wrap(measure, 'one two three four five', 9, 2)).toEqual(['one two', 'three…']);
    expect(wrap(measure, '  ', 9, 2)).toEqual([]);
    for (const line of wrap(measure, 'alpha beta gamma delta epsilon zeta', 12, 2)) {
      expect(line.length).toBeLessThanOrEqual(12);
    }
  });
});
