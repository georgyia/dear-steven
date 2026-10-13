import { describe, expect, it } from 'vitest';
import { type ConversationSummary, SUMMARY_VERSION } from '../schema/index.ts';
import { seedEpisode, tempStore } from '../test/fixtures.ts';
import { summaryView } from './view.ts';

/** The explorer's view of a stored summary (P8-04): every item with the citation it opens. */
const SENTENCES = [
  'Why do we wait for permission before we begin anything new in our lives?',
  'Because starting feels risky, and waiting feels safe even when it costs us years.',
  'Sleep matters more than any productivity trick, because tired people decide badly.',
  'The workshop grew slowly for ten years, and nobody outside the town had heard of it.',
];

function seeded() {
  const store = tempStore();
  const id = seedEpisode(store, 1, SENTENCES);
  const passages = store.episodePassages(id);
  const at = (text: string) => {
    const p = passages.find((x) => x.text.includes(text));
    if (!p) throw new Error(`no passage holds "${text}"`);
    return p;
  };
  const span = (text: string, startMs: number) => ({ passageId: at(text).id, startMs, text });
  const summary: ConversationSummary = {
    version: SUMMARY_VERSION,
    model: 'test-model',
    createdAt: '2026-10-13T12:00:00.000Z',
    speakers: 'unverified',
    about: 'The conversation covers starting before you feel ready.',
    topics: [{ title: 'Starting', passageId: at(SENTENCES[0] as string).id, startMs: 0 }],
    moments: [{ ...span(SENTENCES[2] as string, 16_000), label: 'On sleep' }],
    exchanges: [
      { question: span(SENTENCES[0] as string, 0), answer: span(SENTENCES[1] as string, 8000) },
    ],
  };
  store.saveConversationSummary(id, summary);
  return { store, id, summary, at };
}

describe('summaryView (P8-04)', () => {
  it('gives every item the citation the drawer opens, at the moment it starts', () => {
    const { store, id } = seeded();
    const view = summaryView(store, id);
    expect(view?.episode).toMatchObject({ id, speakers: 'unverified' });
    const moment = view?.summary?.moments[0];
    expect(moment?.label).toBe('On sleep');
    expect(moment?.citation).toMatchObject({
      id: 'summary-moment-0',
      excerpt: SENTENCES[2],
      startMs: 16_000,
      timestamp: { ms: 16_000 },
      speaker: 'unverified',
      speakerName: null,
      quality: 'asr',
    });
    const quoted = moment?.citation;
    const passage = store.getPassage(quoted?.passageId ?? '');
    expect(passage?.text.slice(quoted?.quoteSpan?.start, quoted?.quoteSpan?.end)).toBe(
      SENTENCES[2],
    );
    expect(view?.summary?.exchanges[0]?.question.excerpt).toBe(SENTENCES[0]);
    expect(view?.summary?.exchanges[0]?.answer.id).toBe('summary-answer-0');
    // A topic opens its passage from the start, with the passage as the excerpt.
    expect(view?.summary?.topics[0]?.citation).toMatchObject({ quoteSpan: null, startMs: 0 });
  });

  it('says plainly when there is no summary, and nothing for an episode it doesn’t know', () => {
    const store = tempStore();
    const id = seedEpisode(store, 1, SENTENCES);
    expect(summaryView(store, id)).toMatchObject({ episode: { id }, summary: null });
    expect(summaryView(store, 'ep_unknown')).toBe(null);
  });

  it('leaves out an item whose words are no longer in its passage, rather than show it wrong', () => {
    const { store, id, summary, at } = seeded();
    store.saveConversationSummary(id, {
      ...summary,
      moments: [
        {
          passageId: at(SENTENCES[2] as string).id,
          startMs: 16_000,
          text: 'Words that were never said here.',
          label: 'Gone',
        },
        ...summary.moments,
      ],
    });
    expect(summaryView(store, id)?.summary?.moments.map((m) => m.label)).toEqual(['On sleep']);
  });
});
