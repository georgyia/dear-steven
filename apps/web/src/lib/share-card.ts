import { formatMoment } from '@dear-steven/core/format';
import type { Citation, FinalAnswer, ResolvedBlock } from '@dear-steven/core/schema';
import { brand } from '@/brand';
import { speakerLabel } from '@/components/answer/speaker';
import type { Messages } from '@/i18n';
import { citationOrder } from './conversation';

/**
 * What an answer's image card shows (P6-17): its opening, first quote and advice, and the
 * conversations it drew on — each once, at its first moment, in reading order.
 */
export interface CardContent {
  question: string;
  lead: string | null;
  quote: { text: string; citation: Citation } | null;
  takeaway: string | null;
  sources: Citation[];
  demo: boolean;
}

const MAX_SOURCES = 3;

const prose = (block: ResolvedBlock | undefined) =>
  block && block.kind !== 'quote' ? block.segments.map((s) => s.text).join(' ') : null;

function firstPerEpisode(cited: Citation[]): Citation[] {
  const seen = new Set<string>();
  return cited.filter((c) => !seen.has(c.episode.id) && seen.add(c.episode.id));
}

export function cardContent(question: string, answer: FinalAnswer): CardContent {
  const citations = Object.fromEntries(answer.citations.map((c) => [c.id, c]));
  const quote = answer.blocks.find((b) => b.kind === 'quote' && citations[b.citationId]);
  const quoted = quote?.kind === 'quote' ? citations[quote.citationId] : undefined;
  return {
    question,
    lead: prose(answer.blocks.find((b) => b.kind === 'paragraph')),
    quote: quote?.kind === 'quote' && quoted ? { text: quote.text, citation: quoted } : null,
    takeaway: prose(answer.blocks.find((b) => b.kind === 'takeaway')),
    sources: firstPerEpisode(
      citationOrder({ blocks: answer.blocks, citations }).flatMap((id) => citations[id] ?? []),
    ).slice(0, MAX_SOURCES),
    demo: answer.demo,
  };
}

/**
 * Greedy word wrap into at most `maxLines` lines no wider than `width`; text that doesn't fit
 * ends in an ellipsis on the last line, so a card never implies it is the whole answer.
 */
export function wrap(
  measure: (text: string) => number,
  text: string,
  width: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (!line || measure(next) <= width) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1] ?? '';
  while (last.includes(' ') && measure(`${last}…`) > width) {
    last = last.slice(0, last.lastIndexOf(' '));
  }
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

// ------------------------------------------------------------------------------------- Canvas

const WIDTH = 1080;
const PAD = 88;
const INNER = WIDTH - PAD * 2;
const QUOTE_INDENT = 32;

type Op =
  | { kind: 'text'; text: string; x: number; y: number; font: string; color: string }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; color: string };

interface Style {
  font: string;
  size: number;
  lineHeight: number;
  color: string;
}

/**
 * Draws the card as a PNG. Colours and typefaces are the design tokens read from the page, so the
 * card is the answer as it looks on screen. The AI-persona disclosure is drawn into every card.
 */
export async function drawShareCard(
  content: CardContent,
  t: Messages,
  host: string,
): Promise<Blob> {
  await document.fonts.ready;
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const [display, sans, mono] = [v('--font-display'), v('--font-sans'), v('--font-mono')];
  const style = (font: string, size: number, lineHeight: number, color: string): Style => ({
    font: font.replace('{size}', `${size}px`),
    size,
    lineHeight,
    color,
  });
  const S = {
    wordmark: style(`400 {size} ${display}`, 40, 1.2, v('--ivory-0')),
    tag: style(`500 {size} ${mono}`, 20, 1.4, v('--ember-0')),
    question: style(`400 {size} ${display}`, 56, 1.16, v('--ivory-0')),
    lead: style(`400 {size} ${sans}`, 32, 1.5, v('--ivory-1')),
    quote: style(`italic 400 {size} ${display}`, 38, 1.4, v('--ivory-0')),
    label: style(`500 {size} ${mono}`, 22, 1.4, v('--ember-0')),
    meta: style(`400 {size} ${mono}`, 22, 1.4, v('--ivory-2')),
    takeaway: style(`400 {size} ${sans}`, 32, 1.45, v('--ivory-0')),
    source: style(`400 {size} ${sans}`, 26, 1.4, v('--ivory-1')),
    small: style(`400 {size} ${sans}`, 24, 1.45, v('--ivory-2')),
  };

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const ops: Op[] = [];
  let y = PAD;
  /** Lays out wrapped text at `y` and moves below it; returns the height used. */
  const text = (value: string, s: Style, maxLines: number, x = PAD, width = INNER) => {
    ctx.font = s.font;
    const lines = wrap((line) => ctx.measureText(line).width, value, width, maxLines);
    const step = s.size * s.lineHeight;
    lines.forEach((line, i) => {
      const top = y + i * step + (step - s.size) / 2;
      ops.push({ kind: 'text', text: line, x, y: top, font: s.font, color: s.color });
    });
    y += lines.length * step;
    return lines.length * step;
  };
  const gap = (px: number) => {
    y += px;
  };

  text(brand.name, S.wordmark, 1);
  gap(40);
  if (content.demo) {
    text(t.turn.demoTag.toUpperCase(), S.tag, 2);
    gap(20);
  }
  text(content.question, S.question, 4);
  gap(44);
  if (content.lead) {
    text(content.lead, S.lead, 6);
    gap(44);
  }
  if (content.quote) {
    const top = y;
    text(`“${content.quote.text}”`, S.quote, 6, PAD + QUOTE_INDENT, INNER - QUOTE_INDENT);
    gap(10);
    const c = content.quote.citation;
    const by = `${speakerLabel(c, t.speaker).short}, ${c.episode.title}`;
    text(by, S.meta, 2, PAD + QUOTE_INDENT, INNER - QUOTE_INDENT);
    ops.push({ kind: 'rect', x: PAD, y: top + 6, w: 4, h: y - top - 12, color: v('--ember-0') });
    gap(44);
  }
  if (content.takeaway) {
    text(t.answer.takeaway.toUpperCase(), S.label, 1);
    gap(8);
    text(content.takeaway, S.takeaway, 4);
    gap(44);
  }
  if (content.sources.length > 0) {
    text(t.share.cardSources.toUpperCase(), { ...S.label, color: v('--steel') }, 1);
    gap(12);
    for (const c of content.sources) {
      text(`${speakerLabel(c, t.speaker).short}, ${c.episode.title}`, S.source, 1);
      const at = formatMoment(c.timestamp.ms, c.timestamp.state);
      const link = c.youtubeUrl?.replace(/^https:\/\/(www\.)?/, '');
      const where = [at, link].filter(Boolean).join('   ');
      if (where) text(where, S.meta, 1);
      gap(14);
    }
    gap(30);
  }
  ops.push({ kind: 'rect', x: PAD, y, w: INNER, h: 2, color: v('--ink-3') });
  gap(32);
  text(t.disclosure, S.small, 3);
  gap(12);
  text(t.share.cardFooter(host), S.meta, 2);
  y += PAD;

  canvas.width = WIDTH;
  canvas.height = Math.ceil(y);
  ctx.fillStyle = v('--ink-1');
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const glow = ctx.createRadialGradient(WIDTH, 0, 0, WIDTH, 0, WIDTH * 0.8);
  glow.addColorStop(0, v('--ember-tint'));
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'top';
  for (const op of ops) {
    ctx.fillStyle = op.color;
    if (op.kind === 'rect') ctx.fillRect(op.x, op.y, op.w, op.h);
    else {
      ctx.font = op.font;
      ctx.fillText(op.text, op.x, op.y);
    }
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No image'))), 'image/png'),
  );
}
