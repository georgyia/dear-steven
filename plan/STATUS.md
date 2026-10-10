# STATUS — the live board

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | every issue |

Updated **in the same PR** as the work it describes (`plan/README.md` §6).

## Now

- **Phase:** 0–4 built in the first implementation pass; Phase 5 open.
- **Done:** M0 (except GitHub publishing and third-party skills), M1 in code, M2.
- **Next to pick:** P1-08 (automated a11y audit of interactive states) — no human needed.
  Then P5-03 / P5-04 / P5-07, which don't depend on live results.
- **Critical path:** H-03 → `pnpm ingest index` → H-07 / P3-08 → P5-01.

## Verified in the first pass (2026-10-10)

| Check | Result |
|-------|--------|
| `pnpm check` (Biome, tsc ×4, Vitest, dependency-cruiser) | green — 179 unit/integration tests in 23 files; 0 dependency violations |
| `pnpm e2e` (production build, demo mode, desktop + mobile) | 30 passed, 2 layout-specific skips |
| Architecture rules | fire on a planted `react` import in core and a client import of core `store` |
| `pnpm ingest all --limit 20` (real RSS feed, no keys) | 739 episodes discovered, 20 transcripts, 1,621 passages, ~10 s |
| `pnpm eval` (retrieval, keyword-only) | recall@10 100% (20/20) |
| Live mode with an invalid key | real status + passages; 12 passages from 8 episodes retrieved; clear "key rejected" message |
| Standalone server (`output: 'standalone'`) against the real DB | sqlite-vec loads; `/api/status` correct |
| Lighthouse 13.5 accessibility, home | 100 (375 px) · 100 (desktop) |
| `docker build` | not run locally (Docker daemon not running); runs in CI (`docker` job) |
| Answers from the real model | **not yet run** — P3-08 / H-07 |

## Waiting on a human

| Task | What | Blocks | Runbook | Since |
|------|------|--------|---------|-------|
| H-01 | Publish to GitHub, branch protection, labels | P0-06, CI enforcement, issue sync | `human/github-setup.md` | 2026-10-10 |
| H-02 | Harness decisions (third-party skills, MCP) | P0-05 | `human/harness-decisions.md` | 2026-10-10 |
| H-03 | OpenAI (+ optional YouTube) keys in `.env` | live answers, embeddings, video links, P3-08 | `human/api-keys.md` | 2026-10-10 |
| H-07 | First live eval + usefulness notes | M1 exit, P5-01 | `human/first-live-eval.md` | 2026-10-10 |
| H-04 / H-05 | Host voice clip + diarization budget | P2-08 (verified speakers) | `human/host-voice-clip.md`, `human/transcription-budget.md` | 2026-10-10 |
| H-06 | Agent identity + human reviewers | `risk:high` merge gate | `human/agent-identity.md` | 2026-10-10 |
| H-08 | Hosting account and secrets | P5-10 | `human/deploy.md` | 2026-10-10 |

## Decisions waiting (`needs:decision`)

- P0-05: which third-party skills to install (H-02).

## Board

### M0 Foundations

| Id | # | Issue | Pri | Risk | State | Depends on | Needs |
|----|---|-------|-----|------|-------|------------|-------|
| P0-01 | — | docs(plan): adopt the agent engineering kit as the process layer | P0 | low | done (GitHub sync after H-01) | — | — |
| P0-02 | — | chore(repo): workspace, Next.js 16, core and ingest skeletons, toolchain | P0 | medium | done | — | — |
| P0-03 | — | ci: check, e2e, docker, gitleaks and PR-title workflows | P0 | medium | done (first run after H-01) | P0-02 | — |
| P0-04 | — | chore(repo): labels, issue and PR templates | P1 | low | done | P0-01 | — |
| P0-05 | — | chore(harness): install and audit third-party skills | P2 | medium | open, blocked | P0-01 | H-02 |
| P0-06 | — | chore(repo): publish to GitHub and enable branch protection | P1 | medium | open | P0-03, P0-04 | H-01 |

### M1 Stage, knowledge, answers

| Id | # | Issue | Pri | Risk | State | Depends on | Needs |
|----|---|-------|-----|------|-------|------------|-------|
| P1-01 | — | feat(design): design tokens, fonts and global styles | P0 | low | done | P0-02 | — |
| P1-02 | — | feat(design): vendor the React Bits component set | P0 | medium | done | P1-01 | — |
| P1-03 | — | feat(web): the stage — home, state machine, status, setup, about | P0 | low | done | P1-02 | — |
| P1-04 | — | feat(web): answer renderer | P0 | low | done | P1-03 | — |
| P1-05 | — | feat(web): evidence inspector — panel and sheet | P0 | low | done | P1-04 | — |
| P1-06 | — | feat(web): demo mode | P0 | low | done | P1-04 | — |
| P1-07 | — | test(web): e2e, responsive, reduced motion, accessibility | P0 | low | done | P1-05, P1-06 | — |
| P1-08 | — | test(web): automated a11y audit of the interactive states | P1 | low | **open** | P1-07 | — |
| P2-01 | — | feat(core): SQLite knowledge store | P0 | medium | done | P0-02 | — |
| P2-02 | — | feat(core): VTT, segments, guest names, chunker | P0 | low | done | P0-02 | — |
| P2-03 | — | feat(core): hybrid retrieval | P0 | low | done | P2-01 | — |
| P2-04 | — | feat(ingest): CLI stages | P0 | high | done | P2-01, P2-02 | human review |
| P2-05 | — | test(eval): seed set and retrieval recall | P0 | low | done | P2-03 | — |
| P2-06 | — | docs(ingest): INGESTION.md | P1 | low | done | P2-04 | — |
| P2-07 | — | feat(web): status and passages from the real knowledge base | P0 | medium | done | P2-01, P1-06 | — |
| P2-08 | — | chore(ingest): first diarized run on a budget | P2 | high | open | P2-04 | H-04, H-05 |
| P3-01 | — | docs(core): persona specification and its code twin | P0 | medium | done | — | — |
| P3-02 | — | feat(core): answer schema, prompt, model adapter, block parser | P0 | medium | done | P3-01 | — |
| P3-03 | — | feat(core): citation validator, quotes, repair, downgrade | P0 | high | done | P3-02 | human review |
| P3-04 | — | feat(core): compose pipeline | P0 | high | done | P3-03, P2-03 | human review |
| P3-05 | — | feat(web): live /api/ask over SSE with real passages | P0 | high | done | P3-04, P2-07 | human review |
| P3-06 | — | feat(web): rate limits and input validation | P0 | high | done | P3-05 | human review |
| P3-07 | — | test(eval): answer metrics | P0 | low | done | P3-04, P2-05 | — |
| P3-08 | — | test(eval): first live evaluation against the real model | P0 | medium | open | P3-07 | H-03, H-07 |

### M2 Voice

| Id | # | Issue | Pri | Risk | State | Depends on | Needs |
|----|---|-------|-----|------|-------|------------|-------|
| P4-01 | — | feat(voice): microphone — Web Speech, recorder fallback, /api/transcribe | P0 | medium | done | P3-05 | — |
| P4-02 | — | feat(voice): spoken replies — TextToSpeech, Listen, Written / Spoken | P0 | medium | done | P4-01 | — |
| P4-03 | — | test(voice): voice e2e with a fake microphone | P0 | low | done | P4-02 | — |

### M3 Depth and polish

| Id | # | Issue | Pri | Risk | State | Depends on | Needs |
|----|---|-------|-----|------|-------|------------|-------|
| P5-01 | — | fix(core): tune prompt and retrieval against the live eval | P1 | medium | open, blocked | P3-08 | — |
| P5-02 | — | spike: rerank and MMR, only if the eval justifies it | P2 | medium | open, blocked | P3-08 | — |
| P5-03 | — | feat(web): episode explorer | P2 | low | open | P2-07 | — |
| P5-04 | — | feat(web): related quotes in the inspector | P2 | low | open | P2-07 | — |
| P5-05 | — | feat(web): in-drawer YouTube player and podcast audio | P2 | medium | open | P3-05 | — |
| P5-06 | — | feat(web): disagreements side by side | P2 | medium | open, blocked | P5-01 | — |
| P5-07 | — | feat(voice): settings — speak replies, on-device recognition, voice picker | P2 | low | open | P4-02 | — |
| P5-08 | — | spike(voice): "Hey Steven" wake word | P2 | medium | open | P5-07 | — |
| P5-09 | — | test(eval): LLM-judged usefulness, human-calibrated | P2 | low | open, blocked | P3-08 | — |
| P5-10 | — | chore(infra): deploy to Fly.io | P2 | high | open | P0-03 | H-08 |
| P5-11 | — | feat(web): optional conversation memory (opt-in) | P2 | medium | open | P5-07 | — |
