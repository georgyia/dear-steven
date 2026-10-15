# 03 — Roadmap

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | every issue |

## 1. Phases and milestones

| Phase | Milestone | Exit | Issues | State |
|-------|-----------|------|--------|-------|
| 0 Foundations | M0 | Workspace, tooling, CI, process docs | P0-* | done (P0-05, P0-06 wait on humans) |
| 1 Stage + demo mode | M1 | Design system, stage, answer renderer, evidence inspector, demo | P1-* | done |
| 2 Knowledge core + ingestion | M1 | SQLite store, VTT/chunker, hybrid retrieval, CLI, eval seed | P2-* | done (P2-05 real run waits on H-04/H-05) |
| 3 Grounded answers | M1 exit | Persona, structured answers, validator, repair, SSE, live wiring | P3-* | done in code; **P3-08 (live eval) waits on H-03/H-07** |
| 4 Voice | M2 | Web Speech + recorder fallback, TTS, choreography | P4-* | done |
| 5 Depth and polish | M3 | Each item evaluated individually | P5-* | open; the rest waits on humans |
| 6 Reach and trust | M4 | Languages, setup in the app, concrete answers, security, policies, YouTube | P6-* | merged 2026-10-13 (`plan/04-issues/phase-6.md`) |
| 7 Conversations | M5 | Talk mode, interviews and practice, design polish, the latest episodes | P7-* | open (`plan/04-issues/phase-7.md`) |
| 8 Summaries and open access | M6 | Three free questions, then your own key kept safely; episode summaries | P8-* | merged 2026-10-14; P8-05 waits on a decision; P8-08 to P8-12 merged 2026-10-16 (`plan/04-issues/phase-8.md`) |
| 9 Spoken conversations | M7 | Talk and interviews spoken hands-free; replies read aloud as soon as they are checked | P9-* | merged 2026-10-15; not yet tried on a real device (`plan/04-issues/phase-9.md`) |
| 10 Launch readiness | M8 | A deployment that can't overspend and says when it can't answer; honest errors, previews, disclosure and privacy notice | P10-* | open (`plan/04-issues/phase-10.md`); the launch steps only a person can take are listed there |

A later-phase issue may be taken only when the current phase has nothing pickable.

## 2. Priority within a milestone

| Label | Meaning |
|-------|---------|
| `P0` | Blocks milestone exit |
| `P1` | Blocks milestone exit |
| `P2` | Does not block exit; may still be a dependency |

## 3. Critical path to "M1 exit, verified with real answers"

```
H-03 (OpenAI key) → pnpm ingest index (embeddings) → H-07 / P3-08 (pnpm eval --answers, judge usefulness)
                 ↘ H-03 (YouTube key) → pnpm ingest match-youtube → video deep links live
```

Everything in code for M1 and M2 is merged; what remains on the path is running it with real
credentials and judging the answers.

## 4. Phase 5 — evaluate individually

Ordered by value for the north star:

1. **P5-01** Tune answers against the live eval (prompt, retrieval breadth) — needs P3-08 results.
2. **P5-02** Rerank / MMR — only if P3-08 shows recall or diversity problems.
3. **P5-03** Episode explorer (browse what's indexed; filter by guest).
4. **P5-04** Related quotes in the inspector.
5. **P5-05** In-drawer YouTube player (click-to-load, nocookie) and in-app audio at the podcast timestamp.
6. **P5-06** Conflicting-perspectives presentation.
7. **P5-07** Settings: speak replies, on-device recognition (Chrome `processLocally`), voice picker.
8. **P5-08** "Hey Steven" wake word (openWakeWord in the browser, opt-in, desktop) — spike first.
9. **P5-09** Expanded eval: LLM-judged usefulness with a human-graded calibration set.
10. **P5-10** Deploy to Fly.io (needs H-08).
11. **P5-11** Optional session memory across visits (explicit opt-in).

## 5. Parallelism

- Ingestion runs (H-03, H-05) proceed in parallel with any Phase 5 UI work.
- Research and docs issues never block code.
