'use client';

import { formatMoment, formatTimestamp } from '@dear-steven/core/format';
import type { Citation } from '@dear-steven/core/schema';
import { podcastAudioAt } from '@dear-steven/core/youtube';
import { HeadphonesIcon, PlayIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useId, useRef, useState } from 'react';
import { brand } from '@/brand';
import { YouTubeLink } from '@/components/ui/YouTubeLink';

/**
 * The inspector's Video tab (P5-05): the privacy-enhanced YouTube player at the aligned second
 * and the podcast audio at the exact podcast moment. Both are click-to-load — nothing is
 * requested from YouTube or the audio host until the user presses play.
 */
export function VideoTab({ citation }: { citation: Citation }) {
  const audio = podcastAudioAt(citation.episode.audioUrl, citation.startMs);
  if (!citation.youtubeUrl && !audio) {
    return (
      <p className="text-[14.5px] leading-relaxed text-ivory-1">
        {citation.episode.demo
          ? 'Video links are switched off in demo mode — demo episodes are fixtures, not real recordings.'
          : 'This episode isn’t linked to its YouTube video yet. Run the match-youtube ingest step to add it.'}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {citation.youtubeUrl ? (
        <VideoPlayer citation={citation} youtubeUrl={citation.youtubeUrl} />
      ) : (
        <p className="text-[14.5px] leading-relaxed text-ivory-1">
          This episode isn’t linked to its YouTube video yet — the podcast audio is below.
        </p>
      )}
      {audio ? <PodcastAudio src={audio} startMs={citation.startMs} /> : null}
    </div>
  );
}

function VideoPlayer({ citation, youtubeUrl }: { citation: Citation; youtubeUrl: string }) {
  const [loaded, setLoaded] = useState(false);
  const moment = formatMoment(citation.timestamp.ms, citation.timestamp.state);
  const embed = citation.embedUrl ? new URL(citation.embedUrl) : null;
  embed?.searchParams.set('autoplay', '1');
  embed?.searchParams.set('rel', '0');

  return (
    <div className="flex flex-col gap-4">
      {embed ? (
        loaded ? (
          <iframe
            src={embed.toString()}
            title={`YouTube video: ${citation.episode.title}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="aspect-video w-full rounded-[var(--radius-card)] border border-ink-3 bg-ink-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setLoaded(true)}
            className="group grid aspect-video w-full place-items-center rounded-[var(--radius-card)] border border-ink-3 bg-ink-2 px-6 transition-colors hover:border-ink-4"
          >
            <span className="flex flex-col items-center gap-3 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-ember-0 text-ink-0 transition-transform duration-200 group-hover:scale-105">
                <HugeiconsIcon icon={PlayIcon} size={22} strokeWidth={2} />
              </span>
              <span className="text-[14.5px] text-ivory-0">
                {moment ? `Play the video here from ${moment}` : 'Play the video here'}
              </span>
              <span className="font-mono text-[11px] leading-relaxed text-steel">
                YouTube’s privacy-enhanced player. Nothing loads from Google until you press play.
              </span>
            </span>
          </button>
        )
      ) : null}
      <YouTubeLink href={youtubeUrl}>
        {moment ? brand.copy.youtube.watchFrom(moment) : brand.copy.youtube.watch}
      </YouTubeLink>
      <p className="text-[13.5px] leading-relaxed text-ivory-2">
        {citation.timestamp.state === 'exact'
          ? 'The video and the podcast are aligned for this episode.'
          : citation.timestamp.state === 'estimated'
            ? 'Approximate (≈) — the video can run slightly ahead of or behind the podcast audio.'
            : `The exact moment isn’t aligned yet, so the video starts from the beginning. In the podcast it’s at ${formatTimestamp(citation.startMs)}.`}
      </p>
    </div>
  );
}

function PodcastAudio({ src, startMs }: { src: string; startMs: number }) {
  const ref = useRef<HTMLAudioElement>(null);
  const headingId = useId();
  const [state, setState] = useState<'idle' | 'started' | 'error'>('idle');
  const start = Math.floor(startMs / 1000);

  const play = () => {
    const el = ref.current;
    if (!el) return;
    setState('started');
    el.src = src;
    // Started inside the click, so iOS Safari counts it as user-initiated playback.
    el.play().catch((error: unknown) => {
      // NotAllowed/Abort leave the visible controls for a second tap; anything else is a failure.
      if (error instanceof DOMException && ['NotAllowedError', 'AbortError'].includes(error.name))
        return;
      setState('error');
    });
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 border-t border-ink-3 pt-5">
      <h3 id={headingId} className="font-mono text-[10.5px] tracking-[0.14em] text-steel uppercase">
        Podcast audio
      </h3>
      {state !== 'started' ? (
        <button
          type="button"
          onClick={play}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-ink-3 px-4 py-2.5 text-[14px] text-ivory-0 transition-colors hover:border-ink-4 hover:bg-ink-2"
        >
          <HugeiconsIcon icon={HeadphonesIcon} size={16} strokeWidth={2} />
          {state === 'error'
            ? 'Try the podcast audio again'
            : `Play the podcast audio here from ${formatTimestamp(startMs)}`}
        </button>
      ) : null}
      {/* No src until the click: an <audio> without one makes no request. */}
      {/* biome-ignore lint/a11y/useMediaCaption: podcast audio; the transcript is the Context tab */}
      <audio
        ref={ref}
        controls
        preload="none"
        hidden={state !== 'started'}
        onLoadedMetadata={(e) => {
          // Media fragments are widely supported; seek explicitly where they are not.
          if (Math.abs(e.currentTarget.currentTime - start) > 2)
            e.currentTarget.currentTime = start;
        }}
        onError={() => setState('error')}
        className="w-full"
      />
      <p className="text-[13px] leading-relaxed text-ivory-2">
        {state === 'error'
          ? 'The podcast host didn’t send the audio just now.'
          : 'Streams from the podcast’s own host once you press play. Ads the host inserts can shift the moment by a few seconds.'}
      </p>
    </section>
  );
}
