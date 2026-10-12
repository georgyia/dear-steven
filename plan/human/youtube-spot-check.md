# H-10 — YouTube link spot check

**Unblocks:** P6-15 acceptance (the human checks), P6-14 (links shown everywhere)
**Start when:** `pnpm ingest match-youtube` has run (it needs `YOUTUBE_API_KEY`; free quota)

The matcher pairs podcast episodes with their YouTube videos by date, running time, the guest's
name and shared chapter titles, and times them against each other. Only you can tell whether a
link opens the right video at the right second. About 20 minutes.

## Steps

1. Open `data/reports/youtube-match.md` (written by every `match-youtube` run; not committed).
2. **Right video?** For the 20 links in the first table, open each one and fill in yes / no. It
   should be the same conversation as the podcast episode, even if the titles differ (the show
   retitles its videos).
3. **Right second?** For the 20 links in the second table, open each one. The video should be
   saying the quoted words within ten seconds of where it starts. Fill in yes / no and, for a no,
   roughly how far off it is.
4. Skim the "Low confidence" table. Fix any wrong one by hand:
   `pnpm ingest align "<part of the title>" --video <id> [--offset <seconds>]`.

## Verify

`pnpm ingest status` shows the `youtube` line with the coverage you expect.

## Tell the agent

> H-10 done. Right video: _/20. Within 10 s: _/20 (misses: #_, about _ s off). Fixed by hand: _.
