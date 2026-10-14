import type { ResolvedBlock } from '../schema/answer.ts';

/**
 * What Dear Steven says aloud (P9-01): a block's own checked text, word for word, so what you hear
 * is what you can read, with its sources. A quote is its lead, then the stored words.
 */
export function speakable(block: ResolvedBlock): string {
  const parts =
    block.kind === 'quote' ? [block.lead ?? '', block.text] : block.segments.map((s) => s.text);
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ');
}

/**
 * Text in pieces of at most `max` characters, split after a sentence where it can be (then after
 * a word, then anywhere), so a long block still fits one speech request each.
 */
export function speechPieces(text: string, max: number): string[] {
  const pieces: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const head = rest.slice(0, max + 1);
    const sentence = Math.max(
      ...['. ', '! ', '? ', '… ', '。'].map((end) => head.lastIndexOf(end)),
    );
    const word = head.lastIndexOf(' ');
    const cut = sentence > 0 ? sentence + 1 : word > 0 ? word : max;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

/**
 * Spoken replies arrive as raw PCM (P9-01), so the browser can play them as they are synthesised:
 * 24 kHz, mono, signed 16-bit little-endian, as OpenAI's `pcm` format sends it.
 */
export const SPEECH_SAMPLE_RATE = 24_000;
export const SPEECH_CONTENT_TYPE = `audio/pcm;rate=${SPEECH_SAMPLE_RATE}`;
