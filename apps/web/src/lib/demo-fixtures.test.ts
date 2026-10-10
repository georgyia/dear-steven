import { CitationSchema, ResolvedBlockSchema } from '@dear-steven/core/schema';
import { describe, expect, it } from 'vitest';
import { DEMO_ANSWERS, demoPassageContext, pickDemoAnswer } from './demo-fixtures.ts';

describe('demo fixtures', () => {
  it.each(DEMO_ANSWERS.map((a) => [a.key, a] as const))(
    '%s is a valid resolved answer',
    (_, answer) => {
      for (const b of answer.blocks) expect(() => ResolvedBlockSchema.parse(b)).not.toThrow();
      for (const c of answer.citations) expect(() => CitationSchema.parse(c)).not.toThrow();

      const ids = new Set(answer.citations.map((c) => c.id));
      for (const b of answer.blocks) {
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
