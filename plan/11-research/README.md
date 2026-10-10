# 11 — Research briefs

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | R-* |

A research brief is a **question that ends in a recorded decision**. Format: Question · Why it
blocks · Options · Recommendation · Decision · Sources (with dates checked). Closing one is a
`docs(plan): R-nn …` PR that also updates any ADR it feeds.

| Id | Question | Decision |
|----|----------|----------|
| R-01 | Which React Bits components, and how? | 14 components vendored as owned source; 3 locally adapted |
| R-02 | Where do transcripts come from, legitimately? | RSS VTT first; paid diarization for speakers; YouTube API for ids only |
| R-03 | What voice is feasible in a browser? | Push-to-talk default; Web Speech → recorder + server STT; stock TTS; wake word deferred |
| R-04 | What stack and storage? | Next.js 16 + one SQLite file (FTS5 + sqlite-vec); OpenAI Responses API |
