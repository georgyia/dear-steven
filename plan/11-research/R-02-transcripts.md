# R-02 — Where do transcripts come from, and what are we allowed to do with them?

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | human | 2026-10-10 | P2-04, P2-05, ADR-004, docs/INGESTION.md |

## Question

How do we discover episodes, get timestamped transcripts (ideally with speakers), map them to
YouTube, and stay on the right side of the rights holder?

## Findings (verified 2026-10-10)

- Apple Podcasts lookup for id `1291423644` returns the publisher's feed:
  `https://rss2.flightcast.com/xmsftuzjjykcmqwolaqn6mdn` (Flightcast). 895 items: 739 `full`,
  156 `bonus`. **162 items carry a `podcast:transcript type="text/vtt"`** (114 full + 48 bonus),
  mostly 2025–2026, plus one 2020 and one 2024 episode.
- The VTTs are clean sentence-level cues with millisecond timestamps (e.g. 1,599 cues for an
  88-minute episode) and **no speaker labels** (no `<v>` tags).
- Enclosures are MP3 behind tracking redirects (`pdst.fm` → … → `episode.flightcast.com`).
- Only a handful of descriptions link to YouTube; titles and dates are the matching signal.
- OpenAI `gpt-4o-transcribe-diarize` supports `known_speaker_names` / `known_speaker_references`
  (2–10 s clips, up to 4 speakers) with `response_format: diarized_json` (SDK v6 types).
- YouTube auto-captions via scraping tools are ToS-grey and blocked from cloud IPs.

## Options

1. RSS VTT only (free, no speakers).
2. RSS VTT + paid diarization of selected episodes (speakers verified).
3. Scrape YouTube captions.

## Decision

Option 2, VTT-first, with diarization as a human-approved, budget-capped step (H-04, H-05).
Option 3 rejected. Rights position: no transcripts, audio or embeddings in the repository; each
installation builds its own index from the public feed; the app shows short attributed quotes with
links to the original and never serves whole transcripts; `ingest purge` honours takedowns.
Quotation for criticism, review and research (e.g. UK CDPA s.30; the US fair-use reasoning in
*Authors Guild v. Google*) informs the short-quote-plus-link design — this is a design posture,
not legal advice.

## Open dependencies

Flightcast transcript back-fill; RSS↔YouTube timing drift (dynamic ad insertion, different
intros); multi-guest panels; OpenAI pricing and model churn.

## Sources

- Apple iTunes Lookup API; the Flightcast feed; one VTT fetched (`01M26N4N40D24TJPZ6V4N7JMTY.vtt`) — 2026-10-10
- `openai@6.49.0` type definitions (`resources/audio/transcriptions.d.ts`) — 2026-10-10
