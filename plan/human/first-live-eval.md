# H-07 — First live evaluation

**Unblocks:** M1 exit criterion 4 (P3-08), P5-01 tuning
**Start when:** H-03 is done and `pnpm ingest index` has run

The pipeline is verified with scripted models; this is the first run against the real model.

## Steps

1. `pnpm eval --answers` — 23 questions through the full pipeline (≈ $0.02 a run on 2026-10-10;
   the run prints its own estimate). It prints, per
   question: mode, citation count, time to first block, and any problem; then the totals against
   the thresholds (citations resolve 100%, 0 attribution violations, 0 quote mismatches, persona
   lint clean, unanswerable handled, first block p50 < 3 s). Results land in `eval/results/`.
2. Read five answers in the app (`pnpm dev`): pick q01, q05, q09, q15 and u03. For each, note:
   - Is it useful for a real person with that problem? (1–5)
   - Does every chip's passage actually support its sentence? (yes / which not)
   - Does it sound like a thoughtful host, not a caricature? (1–5)
3. Save your notes (no answers with personal data) in a comment on P3-08.

## Verify

`pnpm eval --answers` exits 0. If it exits 1, the summary line says which threshold failed.

## Fallback

If the answer model id is unavailable on your account, change `MODELS.answer` in
`packages/core/src/config/models.ts` to a model you have (it must support strict structured
outputs and reasoning effort), and note it on P3-08.

## Tell the agent

> H-07 done. eval exit: 0/1. Totals: <paste the summary line>. Usefulness: q01 _/5, q05 _/5, q09 _/5, q15 _/5, u03 handled honestly: yes/no. Notes: …
