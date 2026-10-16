import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MARK_COLOURS, MARK_PATH, MARK_TRANSFORM } from './mark';

/**
 * The icon (P10-10) is one mark in two files: `icon.svg`, served as it is, and `apple-icon.tsx`,
 * drawn from `mark.ts`. They must not drift apart, and the colours must be the design's own.
 */
const svg = readFileSync(new URL('./icon.svg', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');

/** `#rrggbb` as `rgb(r, g, b)`, the way the mark writes its colours. */
const rgb = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
};
const token = (name: string) => {
  const hex = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(tokens)?.[1];
  if (!hex) throw new Error(`no --${name} in tokens.css`);
  return rgb(hex);
};

describe('the icon (P10-10)', () => {
  it('draws the same outline, in the same place, as mark.ts', () => {
    expect(svg).toContain(`d="${MARK_PATH}"`);
    expect(svg).toContain(`transform="${MARK_TRANSFORM}"`);
  });

  it('uses the design’s ink and ember, in both files', () => {
    expect(MARK_COLOURS).toEqual({ ink: token('ink-0'), ember: token('ember-0') });
    expect(svg).toContain(`fill="${MARK_COLOURS.ink}"`);
    expect(svg).toContain(`fill="${MARK_COLOURS.ember}"`);
  });

  it('is a plain image: no script, no link, nothing fetched', () => {
    expect(svg).not.toMatch(/<script|href=|url\(|on[a-z]+=/i);
  });
});
