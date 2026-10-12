import type { Episode, OffsetStep, YouTubeAlignment } from '@dear-steven/core/schema';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  durationMs: number | null;
  /** Read for chapter timestamps while matching; never stored (we display the RSS metadata). */
  description: string;
}

/** What a match rests on — printed in the report so a person can check the doubtful ones. */
export interface MatchEvidence {
  dayGap: number;
  durationGapMs: number | null;
  titleSimilarity: number;
  guestInTitle: boolean;
  sharedChapters: number;
}

export interface YouTubeMatch {
  episodeId: string;
  videoId: string;
  durationMs: number | null;
  /** Video position = podcast position + offsetMs (until the first step). */
  offsetMs: number;
  /** Where the offset changes later in the episode; only ever measured, never estimated. */
  offsetSteps: OffsetStep[];
  alignment: YouTubeAlignment;
  confidence: number;
  evidence: MatchEvidence;
}

export interface MatchResult {
  matches: YouTubeMatch[];
  /** Full episodes with no video good enough, most recent first. */
  unmatched: string[];
}

/** ISO-8601 duration (`PT1H28M24S`) → milliseconds. */
export function parseIsoDuration(iso: string): number | null {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(iso);
  if (!m) return null;
  const [, d = '0', h = '0', min = '0', s = '0'] = m;
  return Math.round(((Number(d) * 24 + Number(h)) * 3600 + Number(min) * 60 + Number(s)) * 1000);
}

const normalise = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&#?\w+;/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const words = (title: string) =>
  new Set(
    normalise(title)
      .split(' ')
      .filter((w) => w.length > 2),
  );

/** Jaccard similarity of title word sets. */
export function titleSimilarity(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter += 1;
  return inter / (A.size + B.size - inter);
}

/** A guest's surname in the video title: the show retitles videos, but keeps who is on. */
export function guestInTitle(guestNames: string[], videoTitle: string): boolean {
  const title = words(videoTitle);
  return guestNames.some((name) => {
    const surname = normalise(name).split(' ').at(-1) ?? '';
    return surname.length > 2 && title.has(surname);
  });
}

// ------------------------------------------------------------------------------------- chapters

export interface Chapter {
  ms: number;
  title: string;
}

/** `2:38`, `02:38`, `1:02:38`, optionally in brackets — not part of a longer number. */
const TIMESTAMP = /[[(]?(?<![\d:])((?:\d{1,2}:)?\d{1,2}:\d{2})(?![\d:])[\])]?/g;

/**
 * Chapter timestamps from a description ("02:38 How Childhood Shaped Who You Became"). Both the
 * podcast and the video list them, each timed against its own edit. The list starts at the first
 * `0:00` and runs while the times go forwards; each title is the text up to the next timestamp or
 * line break (feeds sometimes lose the line breaks: "Intro00:02:12 How To…"). Fewer than three
 * chapters aren't a list.
 */
export function parseChapters(description: string): Chapter[] {
  const stamps = [...description.matchAll(TIMESTAMP)].map((m) => ({
    time: m[1] ?? '',
    from: (m.index ?? 0) + m[0].length,
    at: m.index ?? 0,
  }));
  const start = stamps.findIndex((s) => /^0?0:00(:00)?$/.test(s.time));
  if (start < 0) return [];
  const chapters: Chapter[] = [];
  for (const [i, stamp] of stamps.entries()) {
    if (i < start) continue;
    const ms = stamp.time.split(':').reduce((total, part) => total * 60 + Number(part), 0) * 1000;
    if (chapters.length && ms <= (chapters.at(-1)?.ms ?? 0)) break;
    const end = stamps[i + 1]?.at ?? description.length;
    const text = description.slice(stamp.from, end).split(/\r?\n/)[0] ?? '';
    const title = normalise(text.replace(/^\s*[-–—:|]\s*/, ''));
    if (title) chapters.push({ ms, title });
  }
  return chapters.length >= 3 ? chapters : [];
}

/** Titles this alike name the same chapter; the podcast often rewords a title slightly. */
const SAME_CHAPTER = 0.6;

const uniqueTitles = (chapters: Chapter[]) => {
  const count = new Map<string, number>();
  for (const c of chapters) count.set(c.title, (count.get(c.title) ?? 0) + 1);
  // A title used twice ("Ads", "Ad Break") can't tell us which occurrence is which, and the 00:00
  // opener every list starts with measures nothing.
  return chapters.filter((c) => count.get(c.title) === 1 && c.ms > 0);
};

/** A chapter both lists share: where it starts in the podcast, and how far the video is ahead. */
export interface SharedChapter {
  podcastMs: number;
  deltaMs: number;
}

/**
 * The chapters both lists share, in podcast order, pairing titles one-to-one, most alike first.
 */
export function sharedChapters(podcast: Chapter[], video: Chapter[]): SharedChapter[] {
  const pairs: { p: Chapter; v: Chapter; similarity: number }[] = [];
  const videoChapters = uniqueTitles(video);
  for (const p of uniqueTitles(podcast)) {
    for (const v of videoChapters) {
      const similarity = p.title === v.title ? 1 : titleSimilarity(p.title, v.title);
      if (similarity >= SAME_CHAPTER) pairs.push({ p, v, similarity });
    }
  }
  pairs.sort((a, b) => b.similarity - a.similarity || a.p.ms - b.p.ms);
  const usedP = new Set<Chapter>();
  const usedV = new Set<Chapter>();
  const shared: SharedChapter[] = [];
  for (const { p, v } of pairs) {
    if (usedP.has(p) || usedV.has(v)) continue;
    usedP.add(p);
    usedV.add(v);
    shared.push({ podcastMs: p.ms, deltaMs: v.ms - p.ms });
  }
  return shared.sort((a, b) => a.podcastMs - b.podcastMs);
}

/** Callers pass at least one value. */
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const upper = sorted[mid] ?? 0;
  return sorted.length % 2 ? upper : ((sorted[mid - 1] ?? upper) + upper) / 2;
};

/** Chapter times are whole seconds; agreeing within this is the same offset. */
const CHAPTER_AGREEMENT_MS = 2_000;
/** Measured alignment must account for this share of the shared chapters. */
const EXPLAINED = 0.9;

export interface MeasuredAlignment {
  /** The offset from the start of the episode. */
  offsetMs: number;
  /** Where it changes later on (an ad break or a cut only one edit has). */
  steps: OffsetStep[];
}

/**
 * The alignment measured on shared chapters. Consecutive chapters shifted by the same amount form
 * a run; where the shift changes, a new run starts and becomes a step (from that chapter's podcast
 * time on). A lone chapter that fits neither neighbour is a mis-paired title and is ignored. Only
 * if the runs account for nine in ten shared chapters, at least three, is it evidence enough to
 * call `exact`; otherwise `null`, and the match is an estimate.
 */
export function chapterAlignment(podcast: Chapter[], video: Chapter[]): MeasuredAlignment | null {
  const shared = sharedChapters(podcast, video);
  if (shared.length < 3) return null;
  const runs: { fromMs: number; deltas: number[] }[] = [];
  for (const chapter of shared) {
    const run = runs.at(-1);
    if (run && Math.abs(chapter.deltaMs - median(run.deltas)) <= CHAPTER_AGREEMENT_MS) {
      run.deltas.push(chapter.deltaMs);
    } else {
      runs.push({ fromMs: chapter.podcastMs, deltas: [chapter.deltaMs] });
    }
  }
  const merged: typeof runs = [];
  for (const run of runs.filter((r) => r.deltas.length >= 2)) {
    const last = merged.at(-1);
    if (last && Math.abs(median(last.deltas) - median(run.deltas)) <= CHAPTER_AGREEMENT_MS) {
      last.deltas.push(...run.deltas);
    } else {
      merged.push({ fromMs: run.fromMs, deltas: [...run.deltas] });
    }
  }
  const explained = merged.reduce((n, r) => n + r.deltas.length, 0);
  const [first, ...later] = merged;
  if (!first || explained < 3 || explained < shared.length * EXPLAINED) return null;
  return {
    offsetMs: Math.round(median(first.deltas)),
    steps: later.map((r) => ({ fromMs: r.fromMs, offsetMs: Math.round(median(r.deltas)) })),
  };
}

// ------------------------------------------------------------------------------------- matching

const DAY = 86_400_000;
export const WINDOW_DAYS = 4;
/** Shorts and clips are shorter than any full conversation on the channel. */
export const MIN_VIDEO_MS = 20 * 60_000;
/** Podcast and video edits of one conversation differ by seconds to a few minutes. */
const DURATION_SCALE_MS = 10 * 60_000;
export const MIN_SCORE = 0.6;
/** Below this a match is kept but listed in the report for a person to check. */
export const CONFIDENT_SCORE = 0.8;

/**
 * How well a video fits an episode, in [0, 1]. The show retitles its videos (often sharing few
 * words with the podcast title), so the strong signals are the publication date and the running
 * time; title words, the guest's name and shared chapter titles corroborate.
 */
export function scoreCandidate(
  episode: Episode,
  video: YouTubeVideo,
  chapters: { podcast: Chapter[]; video: Chapter[] },
): { score: number; evidence: MatchEvidence } | null {
  if (video.durationMs === null || video.durationMs < MIN_VIDEO_MS) return null;
  const dayGap = Math.abs(Date.parse(video.publishedAt) - Date.parse(episode.publishedAt)) / DAY;
  if (!(dayGap <= WINDOW_DAYS)) return null;

  const durationGapMs =
    episode.durationMs === null ? null : Math.abs(episode.durationMs - video.durationMs);
  const evidence: MatchEvidence = {
    dayGap,
    durationGapMs,
    titleSimilarity: titleSimilarity(episode.title, video.title),
    guestInTitle: guestInTitle(episode.guestNames, video.title),
    sharedChapters: sharedChapters(chapters.podcast, chapters.video).length,
  };
  const date = 1 - dayGap / WINDOW_DAYS;
  const duration =
    durationGapMs === null ? 0.5 : Math.max(0, 1 - durationGapMs / DURATION_SCALE_MS);
  const title = Math.min(1, evidence.titleSimilarity * 2);
  const corroboration = evidence.sharedChapters >= 3 || evidence.guestInTitle ? 1 : title;
  const score = 0.35 * date + 0.4 * duration + 0.25 * corroboration;
  return { score, evidence };
}

export interface MatchOptions {
  /** Videos already linked to an episode outside this run. */
  taken?: ReadonlySet<string>;
  /** Offsets already measured on episodes outside this run, to estimate from. */
  measured?: MeasuredOffset[];
}

export interface MeasuredOffset {
  publishedAt: string;
  offsetMs: number;
}

/**
 * Pairs full episodes with uploads one-to-one, strongest pairs first, so a weaker pair can't take a
 * video that fits another episode better. Alignment is honest about what we know: `exact` only
 * when shared chapters measure the offset; otherwise `estimated` (the UI shows "≈"), with the
 * offset estimated from the episodes that were measured. A manual `ingest align` can still make
 * any episode exact.
 */
export function matchEpisodes(
  episodes: Episode[],
  videos: YouTubeVideo[],
  options: MatchOptions = {},
): MatchResult {
  const full = episodes.filter((e) => e.episodeType === 'full');
  const podcastChapters = new Map(full.map((e) => [e.id, parseChapters(e.description)]));
  const videoChapters = new Map(videos.map((v) => [v.videoId, parseChapters(v.description)]));
  const candidates: Candidate[] = [];
  for (const episode of full) {
    for (const video of videos) {
      if (options.taken?.has(video.videoId)) continue;
      const scored = scoreCandidate(episode, video, {
        podcast: podcastChapters.get(episode.id) ?? [],
        video: videoChapters.get(video.videoId) ?? [],
      });
      if (scored && scored.score >= MIN_SCORE) candidates.push({ episode, video, ...scored });
    }
  }
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.episode.id.localeCompare(b.episode.id) ||
      a.video.videoId.localeCompare(b.video.videoId),
  );

  const paired: (Candidate & { measured: MeasuredAlignment | null })[] = [];
  const usedEpisodes = new Set<string>();
  const usedVideos = new Set<string>();
  for (const candidate of candidates) {
    if (usedEpisodes.has(candidate.episode.id) || usedVideos.has(candidate.video.videoId)) continue;
    usedEpisodes.add(candidate.episode.id);
    usedVideos.add(candidate.video.videoId);
    const measured = chapterAlignment(
      podcastChapters.get(candidate.episode.id) ?? [],
      videoChapters.get(candidate.video.videoId) ?? [],
    );
    paired.push({ ...candidate, measured });
  }

  const known: MeasuredOffset[] = [
    ...(options.measured ?? []),
    ...paired.flatMap((p) =>
      p.measured ? [{ publishedAt: p.episode.publishedAt, offsetMs: p.measured.offsetMs }] : [],
    ),
  ];
  const newestFirst = (a: Episode, b: Episode) =>
    b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id);
  return {
    matches: paired
      .sort((a, b) => newestFirst(a.episode, b.episode))
      .map(({ episode, video, score, evidence, measured }) => ({
        episodeId: episode.id,
        videoId: video.videoId,
        durationMs: video.durationMs,
        offsetMs: measured?.offsetMs ?? estimateOffset(episode, video, known),
        offsetSteps: measured?.steps ?? [],
        alignment: measured ? 'exact' : 'estimated',
        confidence: Math.round(score * 100) / 100,
        evidence,
      })),
    unmatched: full
      .filter((e) => !usedEpisodes.has(e.id))
      .sort(newestFirst)
      .map((e) => e.id),
  };
}

interface Candidate {
  episode: Episode;
  video: YouTubeVideo;
  score: number;
  evidence: MatchEvidence;
}

/** Edits this close in length differ only in their intro, so the difference is the offset. */
const INTRO_ONLY_MS = 15_000;
/** The show changes its intro edit every few months; nearby measurements predict it best. */
const NEARBY_DAYS = 60;

/**
 * The offset to assume where chapters can't measure one, still `estimated`: the length difference
 * when the two edits are within seconds of each other; otherwise the median offset measured on
 * episodes published within two months; otherwise zero. On the real feed, holding each measured
 * episode out in turn, this lands within ten seconds about two times in three.
 */
export function estimateOffset(
  episode: Episode,
  video: YouTubeVideo,
  measured: MeasuredOffset[],
): number {
  if (episode.durationMs !== null && video.durationMs !== null) {
    const difference = video.durationMs - episode.durationMs;
    if (Math.abs(difference) <= INTRO_ONLY_MS) return difference;
  }
  const when = Date.parse(episode.publishedAt);
  const near = measured.filter(
    (m) => Math.abs(Date.parse(m.publishedAt) - when) <= NEARBY_DAYS * DAY,
  );
  return near.length >= 3 ? Math.round(median(near.map((m) => m.offsetMs))) : 0;
}
