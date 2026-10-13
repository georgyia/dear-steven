# INGESTION.md — building the knowledge base

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-13 | `packages/ingest`, P2-* issues, P6-16 |

Everything here runs on your machine with `pnpm ingest <command>` and writes one SQLite file,
`data/dear-steven.db` (gitignored). Every stage is idempotent and resumable: re-running skips work
that is done, and `--force` redoes it. Each run is recorded in `ingestion_runs`.

## 1. The fast path

```bash
pnpm ingest all --limit 20     # discover → RSS transcripts → chunk → embed (if key) → YouTube (if key)
pnpm ingest status             # what's indexed, what failed, what to run next
```

Or from the browser: `pnpm dev:setup` starts the app on this machine only and prints a link with
a one-time token. Its setup panel saves the keys to `.env`, fetches transcripts (discover →
transcribe → chunk), embeds after showing the estimate and asking for a cap, and links videos —
running these same commands, with their output as they go. Paid diarization stays here.

Measured on 2026-10-10: discovering the feed (739 full episodes) and indexing the newest 20 RSS
transcripts (1,621 passages) takes about 10 seconds; embedding them costs about $0.015.

### Keeping up with new episodes

```bash
pnpm ingest latest --dry-run          # what is new, and what embedding it would cost
pnpm ingest latest --budget 0.05      # bring it in; stops before paying if over the budget
```

`latest` reads the feed, then runs the stages for new episodes only: anything published in the
last 14 days (`--days N`) or since the newest episode you already have, never the back catalogue.
Transcripts and video links are free; embeddings run only with `--budget`, and only if the exact
estimate fits under it; summaries of the new episodes (below) then take what is left of it. Without a key or a budget the new episodes are still found by keyword. A
second run with nothing new fetches the feed and nothing else. The setup panel's "Bring in new
episodes" button runs this same command.

To keep up on a schedule, run it daily from cron (`crontab -e`) on the machine that holds `data/`:

```cron
# 06:30 every day: bring in new episodes, embedding for at most five cents
30 6 * * * cd /path/to/dear-steven && pnpm ingest latest --budget 0.05 >> data/latest.log 2>&1
```

On macOS, a launchd agent works too; cron is the shortest recipe. The deployed image (`docs/DEPLOY.md`)
ships the web app only, not this CLI: for a Fly deployment, schedule `latest` here, upload the
updated `data/dear-steven.db` to the volume afterwards, and restart the machine (`fly machine
restart`): the running app keeps the file it opened. A scheduled job inside the deployment is #63.

The explorer marks episodes published in the last 7 days as new.

## 2. Sources, in order of preference

| Source | What it gives | Cost | Notes |
|--------|---------------|------|-------|
| Official RSS feed (Flightcast, resolved via Apple Podcasts id `1291423644`) | titles, descriptions, dates, durations, audio URLs, `podcast:transcript` VTT links | free | The rights holder publishes it for clients to fetch. 162 of 895 items carry a VTT (114 full episodes + 48 bonus clips) as of 2026-10-10. No speaker labels. |
| OpenAI `gpt-4o-transcribe-diarize` on the RSS audio | speaker-labelled transcript with the host's voice enrolled | ~$0.36 / audio hour | The only way to get verified host/guest statements. Human-approved, budget-capped. |
| YouTube Data API (uploads playlist) | `videoId` + duration, for deep links | free quota (~120 units for the channel) | Titles/descriptions shown in the app come from RSS, not YouTube. |
| YouTube auto-captions | — | — | Not used: ToS-grey, blocked from cloud IPs, unstable. |

## 3. Stages

| Command | Does | Needs |
|---------|------|-------|
| `discover [--include-bonus] [--guests llm] [--feed <url>]` | Parse the RSS feed and upsert episodes. Bonus "Most Replayed" clips are skipped by default. Guest names come from titles (`extractGuestNames`); `--guests llm` fills the gaps from descriptions (names must appear verbatim in the listing). | network; key for `--guests llm` |
| `match-youtube [--refresh]` | Match full episodes to full-length uploads (Shorts and clips skipped) one-to-one, scoring publication date (±4 days), running time, the guest's surname, title words and shared chapter titles. `exact` only when shared chapters measure the offset, including where it changes mid-episode; otherwise `estimated` (shown as `≈`). Writes `data/reports/youtube-match.md`: unmatched and low-confidence matches, and a spot-check sample (H-10). | `YOUTUBE_API_KEY` |
| `transcribe --from vtt [--limit N] [--episode <ref>] [--force]` | Fetch the publisher's VTT (3 at a time), parse, store cue-level segments (speaker `unknown`, attribution `none`). Never overwrites a diarized transcript without `--force`. | network |
| `transcribe --diarize --budget <usd> --host-clip <file> …` | Download audio (cached in `data/cache/audio/`), split into ≤ 1,380 s mono chunks with ffmpeg, diarize each with the host clip enrolled as "Steven". Stops before an episode would exceed the budget; records the cost per run. | key, ffmpeg, a 2–10 s clip of the host (`plan/human/host-voice-clip.md`) |
| `attribute` | QA report for diarized episodes: host share, guest count, flags (enrolment failure, multi-guest panels). | — |
| `chunk [--force] [--episode <ref>]` | Speaker-turn-aware passages of ~350–500 tokens with a short overlap, plus a deterministic context prefix (`title · guests · date`). Keyword search works from here. | — |
| `index [--dry-run] [--budget <usd>]` | Embed passages lacking a current embedding (`text-embedding-3-small`, 1,536 dims) in batches of 128. `--dry-run` prints tokens and cost; with `--budget`, nothing is embedded if the estimate is over it. | key |
| `summarise --dry-run \| --budget <usd> [--limit N] [--episode <ref>] [--force]` | A summary of each indexed episode (P8-03): an overview, its topics, its most interesting moments and its best questions and answers. Prints the estimate first, spends nothing without `--budget`, and stops before an episode would take it over. Episodes already summarised are skipped unless `--force`. About half a cent an episode. | key |
| `latest [--days 14] [--dry-run \| --budget <usd>] [--feed <url>]` | Discover, then transcribe, chunk, embed and summarise (within the budget) and link only the new episodes. Prints the list and an estimate first. Safe to schedule. | network; key and `--budget` to embed and summarise |
| `status [--episodes]` | Counts per stage, recent failures, recorded spend, the next command. | — |
| `doctor [--online]` | Checks Node, keys, ffmpeg, SQLite + sqlite-vec, the feed. | — |
| `align <episode> [--video <id>] [--offset <s>] [--exact \| --unknown]` | Hand-correct a video link or its timing. | — |
| `purge <episode \| all> --yes` | Remove an episode (or everything) with its segments, passages, vectors, runs and cached audio. Without `--yes` it only says what it would delete. | — |

`<episode>` is an episode id (`ep_…`), an RSS guid, or a unique fragment of the title.

## 4. How passages are made

1. **Segments** are the unit of truth: VTT cues, or diarized speaker segments. Each records start
   and end in milliseconds, `speaker` (`host | guest | unknown`), `speaker_name`, and
   `attribution_method` (`diarization | manual | none`). Only `diarization` and `manual` count as
   evidence of who spoke.
2. **Units**: consecutive segments by the same verified speaker form a turn; unverified cues are
   their own units. A turn longer than 520 tokens is split at segment boundaries.
3. **Packing**: units are packed to ~420 tokens (max 520), never splitting a unit, with up to 70
   tokens of trailing overlap. A short final passage folds into the previous one.
4. Passage text is **raw transcript only** (turns separated by newlines). Speaker labels are added
   at prompt time from the segments, so quotes are always matched against what was said.

### Summaries (P8-03)

`pnpm ingest summarise --dry-run` prints what summarising every indexed episode would cost;
`--budget <usd>` runs it. One call per episode reads its whole transcript and returns:

- an overview, machine-written and labelled so;
- its topics, each where it starts;
- its most interesting moments;
- its best questions and answers.

Every moment, question and answer is then located in its passage (`locateQuote`), and only the
stored span is kept, timed at the caption it starts in. An item that can't be located, was
shortened with "…", or (for an exchange) doesn't follow its question is dropped, never repaired.
The overview may not quote, may use only numbers and names the conversation does, and may not
say who said what. If it fails, it gets one cheap second try without the transcript; failing
that, it is left out.

RSS transcripts don't say who speaks, so summaries never name a speaker. Re-chunking an episode
drops its summary (its passages changed). `pnpm ingest status` counts summaries;
`pnpm eval:summaries` re-checks them all and has a judge read ten against their transcripts
(`eval/baselines/2026-10-13-summaries.json`). The first full run, 114 episodes, cost about $0.42.

## 5. Behaviour with an empty or partial knowledge base

- No database file: the status pill says "No conversations indexed yet"; questions get an
  in-persona reply pointing at `pnpm ingest all`, without calling the model.
- Passages but no embeddings: keyword search only; the pill says "embeddings pending".
- Partial coverage: answers may say "from the conversations I have" and carry a caveat.

## 6. Data hygiene and rights

- `data/` is gitignored: no transcripts, audio, embeddings or captions are ever committed.
- The app shows short attributed quotations and links back to the episode; it never serves a
  whole transcript (`/api/passages/:id` returns one passage and a few neighbouring lines).
- Takedown: `pnpm ingest purge <episode> --yes`.

## 7. Known limitations (tracked in `plan/11-research/R-02`)

- FlightCast transcripts cover recent episodes only; the back catalogue needs diarization.
- RSS ↔ YouTube alignment is measured (`exact`) only where both descriptions list chapters —
  218 of 536 matched episodes on 2026-10-10, mostly 2024 onwards. Elsewhere it is estimated from the
  length difference or nearby measured episodes, which lands within ten seconds about two times in
  three; the UI shows `≈`. Better needs captions or audio alignment (out of scope for P6-15).
- Multi-guest panels keep guest speech anonymous unless labelled manually.
- Guest names from titles: 413 of 739 full episodes are named by the heuristic; the rest need
  `--guests llm` or remain unnamed (chips then show a shortened title).
