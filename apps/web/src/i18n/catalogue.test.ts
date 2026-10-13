import { describe, expect, it } from 'vitest';
import { de } from './de.ts';
import { en } from './en.ts';

type Leaf = { path: string; en: unknown; de: unknown };

/** Every string (or function) in the reference catalogue, paired with the German one. */
function leaves(a: unknown, b: unknown, path = ''): Leaf[] {
  if (typeof a === 'object' && a !== null && !Array.isArray(a)) {
    return Object.entries(a).flatMap(([key, value]) =>
      leaves(
        value,
        (b as Record<string, unknown> | undefined)?.[key],
        path ? `${path}.${key}` : key,
      ),
    );
  }
  if (Array.isArray(a))
    return a.flatMap((value, i) => leaves(value, (b as unknown[])?.[i], `${path}[${i}]`));
  return [{ path, en: a, de: b }];
}

/** Words that are the same in both languages, or names. */
const SAME_IN_GERMAN = new Set([
  'composer.placeholder',
  'status.short.demo',
  'status.short.broken',
  'inspector.tabs.video',
  'video.audioHeading',
  'voice.voice',
  'setup.optional',
  // A name.
  'talk.steven',
  // Keys on a keyboard are the same keys in German.
  'home.shortcuts[0].keys',
  'home.shortcuts[1].keys',
  'home.shortcuts[2].keys',
  'home.shortcuts[3].keys',
]);

/** A function entry's output for sample arguments: numbers, or strings where it expects text. */
function sample(value: unknown): unknown {
  if (typeof value !== 'function') return value;
  const format = value as (...args: unknown[]) => unknown;
  try {
    return format(2, 3, 'x', 'y');
  } catch {
    return format('≈ 4:10', '5:20', 'x', 'y');
  }
}

describe('interface catalogues (P6-02)', () => {
  const all = leaves(en, de);

  it('German has every entry, of the same kind', () => {
    for (const leaf of all) {
      // `null` in English means "nothing to say"; another language may still need a note there.
      if (leaf.en === null) continue;
      expect(typeof leaf.de, leaf.path).toBe(typeof leaf.en);
      if (typeof leaf.en === 'function') expect(typeof sample(leaf.de), leaf.path).toBe('string');
    }
  });

  it('German is translated, not copied', () => {
    const copied = all
      .filter((leaf) => typeof leaf.en === 'string' || typeof leaf.en === 'function')
      .filter((leaf) => sample(leaf.en) === sample(leaf.de) && !SAME_IN_GERMAN.has(leaf.path))
      .map((leaf) => leaf.path);
    expect(copied).toEqual([]);
  });

  it('keeps code spans intact, so commands and file names read the same in both', () => {
    const codes = (text: unknown) => String(sample(text)).match(/`[^`]+`/g) ?? [];
    for (const leaf of all) expect(codes(leaf.de), leaf.path).toEqual(codes(leaf.en));
  });

  it('formats numbers the German way', () => {
    expect(de.status.ready(8394)).toBe('8.394 Gespräche bereit');
    expect(de.thinking.elapsed(3.1)).toBe('3,1 s');
    expect(de.thinking.elapsed(75.4)).toBe('1 min 15,4 s');
    expect(en.thinking.elapsed(75.4)).toBe('1m 15.4s');
    expect(de.cards.moments(1)).toBe('1 Moment');
  });

  it('only the terms page says its text is English only', () => {
    expect(en.termsPage.englishOnly).toBe(null);
    expect(de.termsPage.englishOnly).toMatch(/Englisch/);
  });
});

describe('no "·" separators (P7-02)', () => {
  /** Every string a catalogue can produce: plain values, and functions called with sample values. */
  function* strings(value: unknown, path: string): Generator<[string, string]> {
    if (typeof value === 'string') yield [path, value];
    else if (typeof value === 'function') {
      for (const args of [
        [3, 7, '2026-10-13', 4],
        ['Ada', '12:34', 'Speaker not verified', 'twelve minutes', 'x'],
        [true, false],
        [1],
      ]) {
        try {
          const out = (value as (...a: unknown[]) => unknown)(...args);
          yield* strings(out, `${path}()`);
        } catch {
          // Not this signature; the next sample set may fit.
        }
      }
    } else if (Array.isArray(value)) {
      for (const [i, v] of value.entries()) yield* strings(v, `${path}[${i}]`);
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) yield* strings(v, `${path}.${k}`);
    }
  }

  it('no visible string in either language uses a middle dot to separate things', () => {
    for (const [locale, messages] of Object.entries({ en, de })) {
      const dotted = [...strings(messages, locale)].filter(([, s]) => s.includes('·'));
      expect(dotted.map(([p, s]) => `${p}: ${s}`)).toEqual([]);
    }
  });
});
