/**
 * WebVTT parser for podcast transcripts (`<podcast:transcript type="text/vtt">`).
 * Tolerant of BOMs, CRLF, cue identifiers, cue settings, NOTE/STYLE/REGION blocks, inline tags
 * and `mm:ss.ttt` timestamps. Voice tags (`<v Name>`) are kept as the cue's speaker label.
 */

export interface VttCue {
  startMs: number;
  endMs: number;
  text: string;
  voice: string | null;
}

const TIMING =
  /^((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})\s+-->\s+((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})(?:\s+.*)?$/;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  lrm: '',
  rlm: '',
};

export function parseTimestamp(raw: string): number {
  const parts = raw.replace(',', '.').split(':');
  const secPart = parts.pop() ?? '0';
  const [s = '0', frac = '0'] = secPart.split('.');
  const ms = Number(frac.padEnd(3, '0').slice(0, 3));
  const sec = Number(s);
  const min = Number(parts.pop() ?? 0);
  const hours = Number(parts.pop() ?? 0);
  return ((hours * 60 + min) * 60 + sec) * 1000 + ms;
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

function cleanText(lines: string[]): { text: string; voice: string | null } {
  let voice: string | null = null;
  const joined = lines.join(' ');
  const voiceMatch = /<v(?:\.[^\s>]+)?\s+([^>]+)>/.exec(joined);
  if (voiceMatch?.[1]) voice = decodeEntities(voiceMatch[1].trim());
  const text = decodeEntities(joined.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
  return { text, voice };
}

export function parseVtt(input: string): VttCue[] {
  const source = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!/^WEBVTT/.test(source.trimStart()))
    throw new Error('Not a WebVTT file (missing WEBVTT header).');

  const cues: VttCue[] = [];
  for (const block of source.split(/\n{2,}/)) {
    const lines = block.split('\n').filter((l) => l.length > 0);
    if (lines.length === 0) continue;
    const head = lines[0] ?? '';
    if (/^(WEBVTT|NOTE|STYLE|REGION)\b/.test(head)) continue;

    const timingIndex = lines.findIndex((l) => l.includes('-->'));
    if (timingIndex === -1) continue;
    const m = TIMING.exec((lines[timingIndex] ?? '').trim());
    if (!m?.[1] || !m[2]) continue;

    const { text, voice } = cleanText(lines.slice(timingIndex + 1));
    if (!text) continue;
    const startMs = parseTimestamp(m[1]);
    const endMs = Math.max(startMs, parseTimestamp(m[2]));

    const prev = cues[cues.length - 1];
    if (prev && prev.text === text && startMs - prev.endMs < 1500) {
      prev.endMs = Math.max(prev.endMs, endMs);
      continue;
    }
    cues.push({ startMs, endMs, text, voice });
  }
  cues.sort((a, b) => a.startMs - b.startMs);
  return cues;
}
