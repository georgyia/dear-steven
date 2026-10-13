import { describe, expect, it } from 'vitest';
import type { AnswerModel, ModelRequest } from '../answer/model.ts';
import { MODELS } from '../config/models.ts';
import { type ModelSummary, SUMMARY_VERSION } from '../schema/index.ts';
import { seedEpisode, tempStore } from '../test/fixtures.ts';
import { ABOUT_FORMAT, SUMMARY_FORMAT } from './prompt.ts';
import {
  checkSummary,
  type SummarySource,
  summariseEpisode,
  summaryEstimateUsd,
  writtenProblems,
} from './summary.ts';

/**
 * Episode summaries (P8-03), checked in code: a quote is kept only as the stored span it points
 * at, and machine-written text may not quote, count, name or attribute anything the
 * conversation doesn't. Fixture text throughout; nobody's real words.
 */
const SENTENCES = [
  'Welcome back to the fixture show, where every line is made up for the tests.',
  'Why do we wait for permission before we begin anything new in our lives?',
  'Because starting feels risky, and waiting feels safe even when it costs us years.',
  'The fixture guest started a small workshop in 1975 with two friends and one table.',
  'Most of the early customers came from word of mouth and a single local newspaper.',
  'What would you tell someone who is afraid of failing in front of their family?',
  'I would tell them that the fear shrinks once the first small step is behind them.',
  'Sleep matters more than any productivity trick, because tired people decide badly.',
  'The workshop grew slowly for ten years, and nobody outside the town had heard of it.',
  'How did you decide when it was time to hire the first person to help you out?',
  'When I noticed I was saying no to good work because there were not enough hands.',
  'Thank you for listening to the fixture show, and see you again next week everyone.',
];

function source(): SummarySource {
  const store = tempStore();
  const id = seedEpisode(store, 1, SENTENCES);
  const episode = store.getEpisode(id);
  if (!episode) throw new Error('no episode');
  return { episode, passages: store.episodePassages(id), segments: store.getSegments(id) };
}

/** The short id of the passage holding `text`. */
const where = (s: SummarySource, text: string) => {
  const i = s.passages.findIndex((p) => p.text.includes(text));
  if (i < 0) throw new Error(`no passage holds "${text}"`);
  return `p${i}`;
};

const ABOUT =
  'The conversation covers starting before you feel ready, growing a small workshop over ten years, and why sleep shapes good decisions.';

function summaryOf(s: SummarySource, over: Partial<ModelSummary> = {}): ModelSummary {
  const q = SENTENCES[1] as string;
  const a = SENTENCES[2] as string;
  return {
    about: ABOUT,
    topics: [
      { title: 'Starting before you feel ready', passage: where(s, q) },
      { title: 'Growing the workshop', passage: where(s, SENTENCES[8] as string) },
    ],
    moments: [
      {
        passage: where(s, SENTENCES[7] as string),
        quote: SENTENCES[7] as string,
        label: 'Why sleep beats productivity tricks',
      },
      {
        passage: where(s, SENTENCES[3] as string),
        quote: SENTENCES[3] as string,
        label: 'How the workshop began',
      },
    ],
    exchanges: [
      { question: { passage: where(s, q), quote: q }, answer: { passage: where(s, a), quote: a } },
    ],
    ...over,
  };
}

/** A model that answers each completeJson call with the next scripted reply, and records it. */
function scripted(...replies: unknown[]) {
  const seen: (ModelRequest & { format: { name: string } })[] = [];
  const model: AnswerModel = {
    // biome-ignore lint/correctness/useYield: summaries never stream
    async *streamJson() {
      throw new Error('not used');
    },
    async completeJson(request) {
      seen.push(request);
      const next = replies.shift();
      if (next === undefined) throw new Error('no reply scripted');
      return typeof next === 'string' ? next : JSON.stringify(next);
    },
    async completeText() {
      throw new Error('not used');
    },
  };
  return { model, seen };
}

describe('checkSummary: quotes (P8-03)', () => {
  it('keeps a quote as the stored span, timed at the segment it starts in', () => {
    const s = source();
    const checked = checkSummary(summaryOf(s), s);
    expect(checked.dropped).toEqual([]);
    const sleep = checked.moments.find((m) => m.text.startsWith('Sleep matters'));
    expect(sleep).toMatchObject({ text: SENTENCES[7], startMs: 7 * 8000 });
    // In time order, whatever order the model gave them.
    expect(checked.moments.map((m) => m.startMs)).toEqual([3 * 8000, 7 * 8000]);
    expect(checked.exchanges[0]).toMatchObject({
      question: { text: SENTENCES[1], startMs: 8000 },
      answer: { text: SENTENCES[2], startMs: 16_000 },
    });
  });

  it('shows the transcript’s words, not the model’s, when a quote is slightly off', () => {
    const s = source();
    const off = (SENTENCES[7] as string).replace('Sleep matters', 'sleep Matters,');
    const checked = checkSummary(
      summaryOf(s, {
        moments: [{ passage: where(s, SENTENCES[7] as string), quote: off, label: 'On sleep' }],
      }),
      s,
    );
    expect(checked.moments[0]?.text).toBe(SENTENCES[7]);
  });

  it('drops a quote that isn’t in its passage, was shortened, or is too short to stand alone', () => {
    const s = source();
    const at = where(s, SENTENCES[7] as string);
    const checked = checkSummary(
      summaryOf(s, {
        moments: [
          {
            passage: at,
            quote: 'Sleep is the only productivity trick that has ever worked for me.',
            label: 'Invented',
          },
          {
            passage: at,
            quote: 'Sleep matters more … because tired people decide badly.',
            label: 'Shortened',
          },
          { passage: at, quote: 'Sleep matters more', label: 'Too short' },
          { passage: 'p99', quote: SENTENCES[7] as string, label: 'No such passage' },
          {
            passage: where(s, SENTENCES[3] as string),
            quote: SENTENCES[7] as string,
            label: 'Wrong passage',
          },
        ],
      }),
      s,
    );
    expect(checked.moments).toEqual([]);
    expect(checked.dropped).toHaveLength(5);
    expect(checked.dropped.join('\n')).toMatch(
      /not in its passage[\s\S]*"…"[\s\S]*fewer than 8[\s\S]*not a passage/,
    );
  });

  it('keeps only real exchanges: a question, then the reply that follows it', () => {
    const s = source();
    const q = SENTENCES[1] as string;
    const statement = SENTENCES[3] as string;
    const later = SENTENCES[10] as string;
    const checked = checkSummary(
      summaryOf(s, {
        exchanges: [
          {
            question: { passage: where(s, statement), quote: statement },
            answer: { passage: where(s, SENTENCES[4] as string), quote: SENTENCES[4] as string },
          },
          {
            question: { passage: where(s, q), quote: q },
            answer: { passage: where(s, later), quote: later },
          },
          {
            question: { passage: where(s, SENTENCES[5] as string), quote: SENTENCES[5] as string },
            answer: { passage: where(s, SENTENCES[2] as string), quote: SENTENCES[2] as string },
          },
        ],
      }),
      s,
    );
    expect(checked.exchanges).toEqual([]);
    expect(checked.dropped.join('\n')).toMatch(
      /asks nothing[\s\S]*not the reply that follows[\s\S]*not the reply that follows/,
    );
  });

  it('keeps a short question, as long as its answer stands alone', () => {
    const store = tempStore();
    const id = seedEpisode(store, 1, [
      'Who helped you then?',
      'My neighbour did, because she had started a workshop of her own years before me.',
    ]);
    const episode = store.getEpisode(id);
    if (!episode) throw new Error('no episode');
    const s: SummarySource = {
      episode,
      passages: store.episodePassages(id),
      segments: store.getSegments(id),
    };
    const exchange = (answer: string) => ({
      question: { passage: 'p0', quote: 'Who helped you then?' },
      answer: { passage: 'p0', quote: answer },
    });
    const kept = checkSummary(
      {
        about: ABOUT,
        topics: [],
        moments: [],
        exchanges: [
          exchange(
            'My neighbour did, because she had started a workshop of her own years before me.',
          ),
        ],
      },
      s,
    );
    expect(kept.exchanges).toHaveLength(1);
    const short = checkSummary(
      { about: ABOUT, topics: [], moments: [], exchanges: [exchange('My neighbour did, because')] },
      s,
    );
    expect(short.exchanges).toEqual([]);
  });

  it('never shows the same words twice', () => {
    const s = source();
    const q = SENTENCES[1] as string;
    const checked = checkSummary(
      summaryOf(s, {
        moments: [
          { passage: where(s, q), quote: q, label: 'Waiting for permission' },
          { passage: where(s, q), quote: q, label: 'Again' },
        ],
      }),
      s,
    );
    expect(checked.moments).toHaveLength(1);
    expect(checked.exchanges).toEqual([]);
    expect(checked.dropped).toEqual([
      'moment "Again": it repeats another moment',
      expect.stringMatching(/repeats a moment or another exchange/),
    ]);
  });
});

describe('writtenProblems: machine-written text (P8-03)', () => {
  it('accepts a plain overview of the ideas', () => {
    expect(writtenProblems(ABOUT, source(), 'about')).toEqual([]);
  });

  it('refuses quotes, and numbers and names the conversation doesn’t have', () => {
    const s = source();
    expect(writtenProblems('The workshop began in 1975 with two friends.', s, 'about')).toEqual([]);
    expect(writtenProblems('The workshop began in 1976.', s, 'about')).toEqual([
      'the number 1976 is not in the transcript as written',
    ]);
    expect(writtenProblems('It covers how Bridgewater grew.', s, 'about')).toEqual([
      '"Bridgewater" is not in the episode\'s details or transcript',
    ]);
    expect(writtenProblems('Ada Lovelace’s workshop and its growth.', s, 'title')).toEqual([]);
    expect(writtenProblems('It covers “starting before you feel ready”.', s, 'about')).toEqual([
      'it quotes; only the moments may',
    ]);
  });

  it('refuses an overview that reports what someone said', () => {
    const s = source();
    for (const sentence of [
      'Ada Lovelace explains why sleep matters.',
      'Steven argues that waiting is costly.',
      'The guest says the fear shrinks.',
      'He believes in starting small.',
    ]) {
      expect(writtenProblems(sentence, s, 'about'), sentence).toEqual([
        expect.stringMatching(/reports what someone said/),
      ]);
    }
    // Saying verbs are fine when no one is the subject of them.
    expect(writtenProblems('The conversation explains why sleep matters.', s, 'about')).toEqual([]);
  });

  it('keeps titles and labels short', () => {
    const s = source();
    expect(writtenProblems('One two three four five six seven eight nine', s, 'title')).toEqual([
      'it has 9 words, more than 8',
    ]);
    expect(writtenProblems('', s, 'label')).toEqual(['it is empty']);
  });
});

describe('summariseEpisode (P8-03)', () => {
  it('summarises in one call when everything passes', async () => {
    const s = source();
    const { model, seen } = scripted(summaryOf(s));
    const out = await summariseEpisode(model, s, { now: () => new Date('2026-10-13T12:00:00Z') });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.format.name).toBe(SUMMARY_FORMAT.name);
    expect(out.repaired).toBe(false);
    expect(out.summary).toMatchObject({
      version: SUMMARY_VERSION,
      model: MODELS.answer,
      createdAt: '2026-10-13T12:00:00.000Z',
      speakers: 'unverified',
      about: ABOUT,
    });
    expect(out.summary.topics.map((t) => t.title)).toEqual([
      'Starting before you feel ready',
      'Growing the workshop',
    ]);
  });

  it('gives the overview one more try, without the transcript, and keeps it only if it passes', async () => {
    const s = source();
    const fixed =
      'The conversation covers starting before you feel ready and growing a small workshop.';
    const { model, seen } = scripted(
      summaryOf(s, { about: 'Ada Lovelace says the workshop began in 1976.' }),
      { about: fixed },
    );
    const out = await summariseEpisode(model, s);
    expect(seen).toHaveLength(2);
    expect(seen[1]?.format.name).toBe(ABOUT_FORMAT.name);
    expect(JSON.stringify(seen[1]?.input)).not.toContain('<transcript>');
    expect(JSON.stringify(seen[1]?.input)).toContain('1976 is not in the transcript');
    expect(out).toMatchObject({ repaired: true, summary: { about: fixed } });
  });

  it('leaves the overview out when the second try fails too', async () => {
    const s = source();
    const { model } = scripted(
      summaryOf(s, { about: 'Ada Lovelace says the workshop began in 1976.' }),
      { about: 'Ada Lovelace says it began in 1976.' },
    );
    const out = await summariseEpisode(model, s);
    expect(out.summary.about).toBe(null);
    expect(out.dropped.at(-1)).toMatch(/^about: /);
    expect(out.summary.moments).toHaveLength(2);
  });

  it('throws when the reply is not a summary', async () => {
    const s = source();
    await expect(summariseEpisode(scripted('not json').model, s)).rejects.toThrow(
      /not return a summary/,
    );
    await expect(summariseEpisode(scripted({ about: 'x' }).model, s)).rejects.toThrow(
      /not return a summary/,
    );
  });
});

describe('summaryEstimateUsd', () => {
  it('prices a typical episode at under half a cent', () => {
    // The knowledge base averages 74 passages and ~31,700 passage tokens an episode.
    const usd = summaryEstimateUsd(74, 31_700);
    expect(usd).toBeGreaterThan(0.004);
    expect(usd).toBeLessThan(0.005);
  });
});
