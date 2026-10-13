import { describe, expect, it } from 'vitest';
import { aboutFromLearned, cleanAbout, parseAbout } from './aboutYou';

describe('what Dear Steven keeps about you (P7-08)', () => {
  it('builds one short text from what was learned, whole lines only, within 600 characters', () => {
    expect(
      aboutFromLearned([
        { text: 'You run a design studio in Leeds.', evidence: 'I run a design studio' },
        { text: '  Your first client paid in pizza. ', evidence: 'paid us in pizza' },
      ]),
    ).toBe('You run a design studio in Leeds. Your first client paid in pizza.');
    const long = Array.from({ length: 20 }, (_, i) => ({
      text: `Line ${i} ${'x'.repeat(40)}.`,
      evidence: '',
    }));
    const kept = aboutFromLearned(long);
    expect(kept.length).toBeLessThanOrEqual(600);
    expect(kept.endsWith('.')).toBe(true);
  });

  it('can be built from the visitor’s own words instead (demo lines have fixed headings)', () => {
    expect(
      aboutFromLearned(
        [
          {
            text: 'How you describe what you do.',
            evidence: 'I run a small design studio in Leeds.',
          },
          { text: 'Where it started for you.', evidence: 'It started at my kitchen table.' },
        ],
        'evidence',
      ),
    ).toBe('I run a small design studio in Leeds. It started at my kitchen table.');
  });

  it('tidies and bounds whatever is kept', () => {
    expect(cleanAbout('  a\n\n b  ')).toBe('a b');
    expect(cleanAbout('x'.repeat(700))).toHaveLength(600);
  });

  it('treats storage as untrusted: only a short text of the right shape comes back', () => {
    expect(parseAbout({ version: 1, savedAt: 'x', text: ' You run a studio. ' })).toBe(
      'You run a studio.',
    );
    expect(parseAbout({ version: 2, text: 'You run a studio.' })).toBeNull();
    expect(parseAbout({ version: 1, text: 42 })).toBeNull();
    expect(parseAbout({ version: 1, text: '   ' })).toBeNull();
    expect(parseAbout({ version: 1, text: 'x'.repeat(601) })).toBeNull();
    expect(parseAbout(null)).toBeNull();
  });
});
