import type { Segment } from '../schema/index.ts';
import type { VttCue } from './vtt.ts';

const HOST_NAMES = /^(steven( bartlett)?|steve|host)$/i;

/**
 * VTT cues → transcript segments. Plain RSS cues carry no speaker, so they are `unknown` with
 * attribution `none`: real passages, but never evidence of who said what. A publisher's voice tag
 * (`<v Name>`) is kept as a `manual` label.
 */
export function cuesToSegments(cues: VttCue[]): Segment[] {
  return cues.map((c, idx) => {
    if (!c.voice) {
      return {
        idx,
        startMs: c.startMs,
        endMs: c.endMs,
        speaker: 'unknown',
        speakerName: null,
        attributionMethod: 'none',
        attributionConfidence: null,
        text: c.text,
      };
    }
    const isHost = HOST_NAMES.test(c.voice.trim());
    return {
      idx,
      startMs: c.startMs,
      endMs: c.endMs,
      speaker: isHost ? 'host' : 'guest',
      speakerName: isHost ? 'Steven Bartlett' : c.voice,
      attributionMethod: 'manual',
      attributionConfidence: null,
      text: c.text,
    };
  });
}
