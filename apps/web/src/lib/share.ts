const PREFIX = '#share=';

/**
 * A share link (P6-17). The token rides in the fragment, which browsers never send to a server —
 * so the question in it stays out of every request log until the page hands it over to be opened.
 */
export const shareLink = (origin: string, token: string): string => `${origin}/${PREFIX}${token}`;

/** The token in a share link's fragment, or `null` when the page wasn't opened from one. */
export function sharedToken(hash: string): string | null {
  return hash.startsWith(PREFIX) ? hash.slice(PREFIX.length) : null;
}
