import { LinkSquare02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import type { ReactNode } from 'react';
import { brand } from '@/brand';

/**
 * The one way to send someone to YouTube (P6-14): a quiet ink pill, or an inline link inside a
 * line of metadata. No red branding, no ember (that is for the primary action). The URL always
 * comes from core (`linksAt` / `resolveMoment`); nothing is requested until the click, and a
 * plain https link opens the YouTube app where it is installed.
 */
export function YouTubeLink({
  href,
  children = brand.copy.youtube.watch,
  variant = 'pill',
}: {
  href: string;
  children?: ReactNode;
  variant?: 'pill' | 'inline';
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        variant === 'pill'
          ? 'inline-flex w-fit items-center gap-1.5 rounded-full border border-ink-3 px-2.5 py-1 font-mono text-[11px] text-ivory-1 transition-colors hover:border-ink-4 hover:bg-ink-2 hover:text-ivory-0'
          : 'inline-flex items-center gap-1 text-ivory-1 underline-offset-2 hover:text-ivory-0 hover:underline'
      }
    >
      <HugeiconsIcon icon={LinkSquare02Icon} size={12} strokeWidth={2} />
      {children}
      <span className="sr-only">{brand.copy.youtube.newTab}</span>
    </a>
  );
}

/** Said where a link would be, so a missing video is never silent. */
export function NoVideo({ demo }: { demo: boolean }) {
  return (
    <span className="font-mono text-[11px] text-steel">
      {demo ? brand.copy.youtube.fixture : brand.copy.youtube.unmatched}
    </span>
  );
}
