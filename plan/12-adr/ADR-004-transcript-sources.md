# ADR-004 — Transcript sources: RSS VTT first, paid diarization by approval, no caption scraping

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | human | 2026-10-10 | P2-04, P2-05 |

**Decision owner:** human · **Supersedes:** —

## Context

See R-02. Speaker attribution is the cardinal integrity risk: the persona speaks in the first
person, so a guest's words must never be presented as the host's.

## Decision

1. The official RSS feed is the backbone (metadata + free VTT transcripts).
2. VTT segments carry `speaker: unknown`, `attribution_method: none` → citations are
   episode-level; the validator forbids `host`/`guest` claims on them.
3. Verified speakers come only from diarization (host voice enrolled) or manual/publisher labels,
   gated by `--budget` and a human runbook.
4. YouTube Data API for video ids and durations only; display text comes from RSS.
5. No YouTube caption scraping in the pipeline.
6. No podcast content in the repository; `ingest purge` for takedowns.

## Consequences

Until episodes are diarized, answers credit conversations, not people. The UI makes this a
first-class state (dashed chip, "speaker not verified") rather than hiding it.

## Revisit when

The publisher adds speaker labels to its VTTs, or diarization pricing changes materially.
