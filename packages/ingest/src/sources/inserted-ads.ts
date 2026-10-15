import type { Segment } from '@dear-steven/core/schema';

/**
 * Ads the ad service inserts into each download of the feed's audio (P8-12). They aren't part of
 * the conversation, and every timestamp after one is late by its length, while citations are timed
 * against the feed's own audio, as the publisher's transcripts are.
 *
 * The episodes are in English and the ads are in the language of wherever the audio is
 * downloaded (German, from Germany). So a line in another language is an ad, and so is an
 * unlabelled line that runs on from one ("Kostenlos starten auf shopify.com"). Ads in English
 * aren't caught this way: the run compares what was dropped with how much longer the download was
 * than the feed says, so a gap shows.
 */

/** Common German words that aren't also English words. */
const GERMAN = new Set(
  'der das den dem des und ist nicht ein eine einen einem du dein deine dich dir mit auf für noch jetzt wie nur zu bei von unser unsere wir ihr auch kann kannst wenn vor steht hier oder sich sind wird mehr schon dann'.split(
    ' ',
  ),
);
/** Common English words, including the short replies a conversation is full of. */
const ENGLISH = new Set(
  'the and to of you i is that it a for on what we this be my are have but not with your do just like yeah yes no okay right sure know think about they he she me our'.split(
    ' ',
  ),
);

const words = (text: string) => text.toLowerCase().match(/[a-zäöüß']+/g) ?? [];

/** A line in German: umlauts or German words, and none of the English ones. */
export function foreign(text: string): boolean {
  const tokens = words(text);
  if (tokens.some((w) => ENGLISH.has(w))) return false;
  const umlauts = /[äöüß]/i.test(text) ? 2 : 0;
  return umlauts + tokens.filter((w) => GERMAN.has(w)).length >= 2;
}

const english = (text: string) => words(text).some((w) => ENGLISH.has(w));

export interface WithoutAds {
  segments: Segment[];
  /** How much of the download the dropped blocks covered. */
  droppedMs: number;
}

/**
 * Drops inserted ads and takes each one's length off everything after it. A block runs from its
 * first ad line to the next line of the conversation (to its own end, at the end of an episode).
 */
export function withoutInsertedAds(segments: Segment[]): WithoutAds {
  const ad = segments.map((s) => foreign(s.text));
  // Unlabelled lines next to an ad, with nothing English in them, belong to it.
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < segments.length; i++) {
      if (ad[i]) continue;
      const s = segments[i] as Segment;
      const runsOn = [i - 1, i + 1].some(
        (j) => ad[j] && segments[j]?.speaker === s.speaker && s.speaker !== 'host',
      );
      if (runsOn && !english(s.text)) {
        ad[i] = true;
        changed = true;
      }
    }
  }

  const kept: Segment[] = [];
  let shift = 0;
  let droppedMs = 0;
  for (let i = 0; i < segments.length; ) {
    if (!ad[i]) {
      const s = segments[i] as Segment;
      kept.push({ ...s, idx: kept.length, startMs: s.startMs - shift, endMs: s.endMs - shift });
      i += 1;
      continue;
    }
    const start = (segments[i] as Segment).startMs;
    let end = (segments[i] as Segment).endMs;
    while (i < segments.length && ad[i]) {
      end = Math.max(end, (segments[i] as Segment).endMs);
      i += 1;
    }
    const next = segments[i];
    const length = (next ? Math.max(next.startMs, end) : end) - start;
    droppedMs += length;
    if (next) shift += length;
  }
  return { segments: kept, droppedMs };
}
