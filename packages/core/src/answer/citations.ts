import { type RelatedOptions, relatedPassages } from '../retrieval/related.ts';
import type {
  Citation,
  Episode,
  EpisodeRef,
  EpisodeSummary,
  PassageContext,
  RelatedMoments,
  Segment,
  SpeakerState,
} from '../schema/index.ts';
import type { KnowledgeStore, StoredPassage } from '../store/index.ts';
import { httpsUrl, resolveMoment } from '../youtube/links.ts';

export const isVerified = (s: Segment) =>
  (s.attributionMethod === 'diarization' || s.attributionMethod === 'manual') &&
  s.speaker !== 'unknown';

export function episodeRef(e: Episode): EpisodeRef {
  return {
    id: e.id,
    title: e.title,
    guestNames: e.guestNames,
    publishedAt: e.publishedAt,
    youtubeVideoId: e.youtubeVideoId,
    audioUrl: httpsUrl(e.audioUrl),
    demo: false,
  };
}

/** An episode as the explorer lists it. The video link has no timestamp: it opens the episode. */
export function episodeSummary(e: Episode & { passages: number }): EpisodeSummary {
  const video = e.youtubeVideoId ? e.youtubeAlignment : 'none';
  return {
    id: e.id,
    title: e.title,
    guestNames: e.guestNames,
    publishedAt: e.publishedAt,
    passages: e.passages,
    speakers:
      e.transcriptSource === 'openai-diarize' || e.transcriptSource === 'manual'
        ? 'verified'
        : 'unverified',
    video,
    youtubeUrl: resolveMoment({
      videoId: e.youtubeVideoId,
      startMs: 0,
      offsetMs: 0,
      alignment: 'unknown',
    }).url,
    demo: false,
  };
}

/** Who spoke a run of segments — only when every one is verified and they are the same person. */
export function speakerOf(segments: Segment[]): { speaker: SpeakerState; name: string | null } {
  const first = segments[0];
  if (!first || !segments.every(isVerified)) return { speaker: 'unverified', name: null };
  const same = segments.every(
    (s) => s.speaker === first.speaker && s.speakerName === first.speakerName,
  );
  if (!same || first.speaker === 'unknown') return { speaker: 'unverified', name: null };
  return { speaker: first.speaker, name: first.speakerName };
}

/** Both RSS VTT and diarized transcripts are machine transcription; only manual ones are reviewed. */
export const transcriptQuality = (e: Episode): Citation['quality'] =>
  e.transcriptSource === 'manual' ? 'reviewed' : 'asr';

export function momentOf(episode: Episode, startMs: number) {
  const m = resolveMoment({
    videoId: episode.youtubeVideoId,
    startMs,
    offsetMs: episode.youtubeOffsetMs,
    alignment: episode.youtubeAlignment,
  });
  return { timestamp: { ms: m.ms, state: m.state }, youtubeUrl: m.url, embedUrl: m.embedUrl };
}

/** Everything about a cited passage except what depends on the claim citing it. */
export function citationBase(p: StoredPassage) {
  return {
    passageId: p.id,
    episode: episodeRef(p.episode),
    startMs: p.startMs,
    endMs: p.endMs,
    quality: transcriptQuality(p.episode),
    ...momentOf(p.episode, p.startMs),
  };
}

const trimTo = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

const passageSpeaker = (store: KnowledgeStore, p: StoredPassage) =>
  speakerOf(store.getSegments(p.episodeId, p.segmentStartIdx, p.segmentEndIdx));

/** Up to three passages from other conversations near a cited one, with their own speaker state. */
export function buildRelatedMoments(
  store: KnowledgeStore,
  passageId: string,
  options: Partial<RelatedOptions> = {},
): RelatedMoments {
  return {
    passages: relatedPassages(store, passageId, options).map((p) => {
      const who = passageSpeaker(store, p);
      return {
        ...citationBase(p),
        speaker: who.speaker,
        speakerName: who.name,
        excerpt: trimTo(p.text, 240),
        text: p.text,
      };
    }),
  };
}

/** The evidence drawer's view of a passage: the passage, who spoke it, and its neighbours. */
export function buildPassageContext(
  store: KnowledgeStore,
  passageId: string,
): PassageContext | null {
  const p = store.getPassage(passageId);
  if (!p) return null;
  const segments = store.getSegments(
    p.episodeId,
    Math.max(0, p.segmentStartIdx - 3),
    p.segmentEndIdx + 3,
  );
  const inside = segments.filter((s) => s.idx >= p.segmentStartIdx && s.idx <= p.segmentEndIdx);
  const who = speakerOf(inside);
  const line = (s: Segment) => ({ text: trimTo(s.text, 400), startMs: s.startMs });

  const lines: NonNullable<PassageContext['lines']> = [];
  for (const s of inside) {
    const verified = isVerified(s);
    const last = lines[lines.length - 1];
    const speaker = verified ? s.speaker : 'unknown';
    const name = verified ? s.speakerName : null;
    if (last && last.speaker === speaker && last.speakerName === name) last.text += ` ${s.text}`;
    else lines.push({ startMs: s.startMs, speaker, speakerName: name, text: s.text });
  }

  return {
    citation: {
      ...citationBase(p),
      speaker: who.speaker,
      speakerName: who.name,
      excerpt: p.text,
      text: p.text,
    },
    before: segments.filter((s) => s.idx < p.segmentStartIdx).map(line),
    after: segments.filter((s) => s.idx > p.segmentEndIdx).map(line),
    lines: lines.some((l) => l.speaker !== 'unknown') ? lines : null,
  };
}
