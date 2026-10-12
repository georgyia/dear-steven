import { fetchJson } from '../lib/http.ts';
import { parseIsoDuration, type YouTubeVideo } from './youtube-match.ts';

/** The Diary Of A CEO YouTube channel. Its uploads playlist is the channel id with `UU` for `UC`. */
export const DOAC_CHANNEL_ID = 'UCGq-a57w-aPwyi3pW7XLiHw';

const API = 'https://www.googleapis.com/youtube/v3';

interface PlaylistPage {
  nextPageToken?: string;
  items?: {
    snippet?: { title?: string; description?: string };
    contentDetails?: { videoId?: string; videoPublishedAt?: string };
  }[];
}

interface VideosPage {
  items?: { id?: string; contentDetails?: { duration?: string } }[];
}

/**
 * Lists every upload with its duration. Costs ~1 quota unit per 50 videos for each of the two
 * calls (the free daily quota is 10,000). Titles, dates and descriptions (for chapter timestamps)
 * come from YouTube only for matching and are never stored — what we display comes from the RSS
 * feed, which sidesteps the API's 30-day refresh rule.
 */
export async function listUploads(
  apiKey: string,
  channelId: string = DOAC_CHANNEL_ID,
  onPage?: (count: number) => void,
): Promise<YouTubeVideo[]> {
  const playlistId = `UU${channelId.slice(2)}`;
  const videos: YouTubeVideo[] = [];
  let pageToken = '';
  do {
    const qs = new URLSearchParams({
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: '50',
      key: apiKey,
      ...(pageToken ? { pageToken } : {}),
    });
    const page = await fetchJson<PlaylistPage>(`${API}/playlistItems?${qs}`);
    for (const item of page.items ?? []) {
      const videoId = item.contentDetails?.videoId;
      const publishedAt = item.contentDetails?.videoPublishedAt;
      if (videoId && publishedAt) {
        videos.push({
          videoId,
          title: item.snippet?.title ?? '',
          description: item.snippet?.description ?? '',
          publishedAt,
          durationMs: null,
        });
      }
    }
    onPage?.(videos.length);
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);

  for (let i = 0; i < videos.length; i += 50) {
    const batch = videos.slice(i, i + 50);
    const qs = new URLSearchParams({
      part: 'contentDetails',
      id: batch.map((v) => v.videoId).join(','),
      key: apiKey,
    });
    const page = await fetchJson<VideosPage>(`${API}/videos?${qs}`);
    const durations = new Map(
      (page.items ?? []).map((v) => [v.id, v.contentDetails?.duration ?? '']),
    );
    for (const v of batch) v.durationMs = parseIsoDuration(durations.get(v.videoId) ?? '');
  }
  return videos;
}
