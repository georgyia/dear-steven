# INGESTION.md — building the knowledge base

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | `packages/ingest`, P2-* issues |

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
| `summarise --dry-run \| --budget <usd> [--limit N] [--episode <ref>] [--force]` | Paid (P6-07): a 3–5 sentence, machine-written overview of each indexed conversation, stored in `episodes.summary` and shown to the answer model as `generated="true"` — never cited, quoted or shown as anyone's words. Stops before the budget would be passed. 114 episodes cost $0.28 on 2026-10-11. | key |
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
