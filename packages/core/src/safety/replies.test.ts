import { describe, expect, it } from 'vitest';
import type { AskEvent, FinalAnswer, ResolvedBlock } from '../schema/index.ts';
import { crisisAnswer, sensitivePreface } from './replies.ts';
import { BY_COUNTRY, crisisResources } from './resources.ts';

const textOf = (blocks: ResolvedBlock[]) =>
  blocks.flatMap((b) => (b.kind === 'quote' ? [b.text] : b.segments.map((s) => s.text))).join(' ');

const finalOf = (events: Iterable<AskEvent>): FinalAnswer => {
  for (const e of events) if (e.type === 'final') return e.answer;
  throw new Error('no final answer');
};

const DIRECTORY = /findahelpline\.com/g;
/** A locale for each country in the table, and locales that name no country the table knows. */
const COUNTRIES = Object.keys(BY_COUNTRY).map((country) => `en-${country}`);
const NO_COUNTRY = [undefined, null, 'en', 'ja-JP', 'pt-BR'];

describe('a crisis reply always says how to find a helpline in any country (P10-07)', () => {
  it.each(COUNTRIES)('%s: the country’s own help, then the international line', (locale) => {
    const r = crisisResources(locale);
    const final = finalOf(crisisAnswer(locale, 0, () => 0));
    const said = textOf(final.blocks);
    expect(final.language).toBe('en');
    expect(said.match(DIRECTORY)).toHaveLength(1);
    // The country's helpline and emergency number come first; the international line follows.
    const own = said.indexOf(r.helpline);
    const emergency = said.indexOf(`call ${r.emergencyNumber}.`);
    expect(own).toBeGreaterThanOrEqual(0);
    expect(emergency).toBeGreaterThan(own);
    expect(said.indexOf('findahelpline.com')).toBeGreaterThan(emergency);
    expect(final.spoken.match(DIRECTORY)).toHaveLength(1);
  });

  it.each(NO_COUNTRY)('%s: the international line, said once', (locale) => {
    const final = finalOf(crisisAnswer(locale, 0, () => 0));
    expect(textOf(final.blocks).match(DIRECTORY)).toHaveLength(1);
    expect(textOf(final.blocks)).toMatch(/call your local emergency number/);
    expect(final.spoken.match(DIRECTORY)).toHaveLength(1);
  });

  it.each([...COUNTRIES, ...NO_COUNTRY])(
    '%s: the helpline before an answer on suicide as a topic says it too',
    (locale) => {
      expect(textOf([sensitivePreface(locale)]).match(DIRECTORY)).toHaveLength(1);
    },
  );

  it('leaves the reviewed wording as it was, and only adds the line', () => {
    const final = finalOf(crisisAnswer('en-US', 0, () => 0));
    expect(final.blocks[0]).toEqual({
      kind: 'paragraph',
      segments: [
        {
          text: 'I’m really glad you said something. Please talk to someone who can help right now.',
          attribution: 'synthesis',
          citationIds: [],
        },
        {
          text: 'The 988 Suicide & Crisis Lifeline is there day and night: call or text 988. If you are in danger right now, call 911. Wherever you are, you can find a free, confidential helpline in your country at findahelpline.com.',
          attribution: 'synthesis',
          citationIds: [],
        },
      ],
    });
  });
});
