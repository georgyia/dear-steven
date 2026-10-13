import {
  CitationSchema,
  RelatedMomentsSchema,
  ResolvedBlockSchema,
} from '@dear-steven/core/schema';
import { describe, expect, it } from 'vitest';
import {
  DEMO_ANSWERS,
  demoEpisodePage,
  demoPassageContext,
  demoRelatedMoments,
  pickDemoAnswer,
} from './demo-fixtures.ts';
import { GERMAN, inGerman } from './demo-fixtures-de.ts';

describe('demo fixtures', () => {
  it.each(DEMO_ANSWERS.map((a) => [a.key, a] as const))(
    '%s is a valid resolved answer',
    (_, answer) => {
      for (const b of answer.blocks) expect(() => ResolvedBlockSchema.parse(b)).not.toThrow();
      for (const c of answer.citations) expect(() => CitationSchema.parse(c)).not.toThrow();

      const ids = new Set(answer.citations.map((c) => c.id));
      for (const b of [...answer.blocks, answer.talk.block]) {
        const refs = b.kind === 'quote' ? [b.citationId] : b.segments.flatMap((s) => s.citationIds);
        for (const r of refs) expect(ids.has(r)).toBe(true);
        if (b.kind !== 'quote') {
          for (const s of b.segments) {
            if (s.attribution === 'synthesis') expect(s.citationIds).toEqual([]);
            else expect(s.citationIds.length).toBeGreaterThan(0);
          }
        }
      }
    },
  );

  it('is unmistakably fictional: demo episodes, no video links, no words in the host’s mouth', () => {
    for (const a of DEMO_ANSWERS) {
      for (const c of a.citations) {
        expect(c.episode.demo).toBe(true);
        expect(c.episode.title).toMatch(/\(fixture\)/);
        expect(c.youtubeUrl).toBe(null);
        expect(c.speaker).not.toBe('host');
      }
      for (const b of a.blocks) {
        if (b.kind !== 'quote') for (const s of b.segments) expect(s.attribution).not.toBe('host');
      }
    }
  });

  it('has a talk reply for every topic: one short paragraph, at most one source (P7-05)', () => {
    const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
    for (const a of DEMO_ANSWERS) {
      const { block, spoken } = a.talk;
      expect(block.kind).toBe('paragraph');
      if (block.kind === 'quote') continue;
      expect(words(block.segments.map((s) => s.text).join(' '))).toBeLessThan(60);
      expect(words(spoken)).toBeLessThan(60);
      expect(new Set(block.segments.flatMap((s) => s.citationIds)).size).toBeLessThanOrEqual(1);
      for (const s of block.segments) expect(s.attribution).not.toBe('host');
    }
  });

  it('quotes are verbatim spans of their passage', () => {
    for (const a of DEMO_ANSWERS) {
      for (const b of a.blocks) {
        if (b.kind !== 'quote') continue;
        const c = a.citations.find((x) => x.id === b.citationId);
        const ctx = c ? demoPassageContext(c.passageId) : null;
        expect(ctx?.citation.text).toContain(b.text);
      }
    }
  });

  it('routes questions to a topic and falls back to an honest insufficient answer', () => {
    expect(pickDemoAnswer('Why do I keep procrastinating?').key).toBe('procrastination');
    expect(pickDemoAnswer('How do I build discipline?').key).toBe('discipline');
    expect(pickDemoAnswer('Should I start a business?').key).toBe('business');
    expect(pickDemoAnswer('Ich schiebe mein Projekt seit Wochen vor mir her.').key).toBe(
      'procrastination',
    );
    expect(pickDemoAnswer('Wie bleibe ich diszipliniert?').key).toBe('discipline');
    expect(pickDemoAnswer('Soll ich ein Unternehmen gründen?').key).toBe('business');
    const fallback = pickDemoAnswer('What is the capital of Peru?');
    expect(fallback.mode).toBe('insufficient');
    expect(fallback.citations).toEqual([]);
  });

  it('serves context for every cited passage and nothing else', () => {
    for (const a of DEMO_ANSWERS)
      for (const c of a.citations) expect(demoPassageContext(c.passageId)).not.toBe(null);
    expect(demoPassageContext('ps_real_1')).toBe(null);
  });
});

describe('demo fixtures in German (P6-02)', () => {
  it('has German for every piece of prose, and for every quote', () => {
    const prose = DEMO_ANSWERS.flatMap((a) => [
      a.spoken,
      ...a.caveats,
      ...a.citations.flatMap((c) => (c.relevance ? [c.relevance] : [])),
      ...a.blocks.flatMap((b) =>
        b.kind === 'quote' ? [b.text, ...(b.lead ? [b.lead] : [])] : b.segments.map((s) => s.text),
      ),
      a.talk.spoken,
      ...(a.talk.block.kind === 'quote' ? [] : a.talk.block.segments.map((s) => s.text)),
    ]);
    expect(prose.filter((text) => !GERMAN[text])).toEqual([]);
  });

  it('keeps quotes verbatim and English, with the translation beneath', () => {
    for (const a of DEMO_ANSWERS) {
      const de = inGerman(a);
      expect(de.citations.map((c) => c.excerpt)).toEqual(a.citations.map((c) => c.excerpt));
      de.blocks.forEach((b, i) => {
        const original = a.blocks[i];
        if (b.kind === 'quote' && original?.kind === 'quote') {
          expect(b.text).toBe(original.text);
          expect(b.translation).toBe(GERMAN[original.text]);
        }
        expect(() => ResolvedBlockSchema.parse(b)).not.toThrow();
      });
    }
  });
});

describe('demoEpisodePage', () => {
  it('lists the fixture episodes newest first, labelled demo, searchable by guest', () => {
    const all = demoEpisodePage('', 0);
    expect(all.total).toBe(3);
    expect(all.episodes.every((e) => e.demo && e.youtubeUrl === null)).toBe(true);
    expect(all.episodes.map((e) => e.publishedAt)).toEqual(
      [...all.episodes.map((e) => e.publishedAt)].sort().reverse(),
    );
    expect(demoEpisodePage('founder', 0).episodes.map((e) => e.guestNames[0])).toEqual([
      'Demo Guest, Founder',
    ]);
    expect(demoEpisodePage('nobody', 0).total).toBe(0);
  });
});

describe('demoRelatedMoments', () => {
  it('relates fixtures only across episodes, and knows nothing about real ids', () => {
    for (const a of DEMO_ANSWERS)
      for (const c of a.citations) {
        const related = RelatedMomentsSchema.parse(demoRelatedMoments(c.passageId));
        for (const p of related.passages) {
          expect(p.episode.id).not.toBe(c.episode.id);
          expect(p.episode.demo).toBe(true);
          expect(p.youtubeUrl).toBe(null);
        }
      }
    expect(demoRelatedMoments('demo_ps_problem')).toEqual({ passages: [] });
    expect(demoRelatedMoments('ps_real_1')).toBe(null);
  });
});
