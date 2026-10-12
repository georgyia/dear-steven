# STATUS — the live board

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | every issue |

Updated **in the same PR** as the work it describes (`plan/README.md` §6).

## Now

- **Phase:** 0–4 built in the first implementation pass; Phase 5 open (the rest waits on humans);
  Phase 6 / M4 *Reach and trust* planned (`plan/04-issues/phase-6.md`).
- **Done:** M0 (except GitHub publishing and third-party skills), M1 in code, M2; from M3: P5-03, P5-04, P5-05, P5-07, P5-11, P5-12.
- **Next to pick (M4, since Phase 5 has nothing pickable):** P6-03 (unblocked), P6-17.
  P6-08 (P0) is built and waits for human review. Phase 5's P5-01/02/06/09 wait on the first live
  eval (H-07), P5-08 on H-09, P5-10 on H-08 and now P6-08 + P6-12.
- **Critical path:** H-07 (read five live answers) → P5-01 (first block p50 3.5–4 s against a 3 s target; the unanswerable u03 flips to `partial` on a passage that mentions Pokémon cards).

## Verified in the first pass (2026-10-10)

| Check | Result |
|-------|--------|
| `pnpm check` (Biome, tsc ×4, Vitest, dependency-cruiser) | green — 207 unit/integration tests in 28 files; 0 dependency violations |
| `pnpm e2e` (production build, demo mode, desktop + mobile) | 68 passed, 8 skips (2 layout-specific; the HTTP route checks run on desktop only) |
| Architecture rules | fire on a planted `react` import in core and a client import of core `store` |
| `pnpm ingest all --limit 20` (real RSS feed, no keys) | 739 episodes discovered, 20 transcripts, 1,621 passages, ~10 s |
| `pnpm eval` (retrieval, keyword-only) | recall@10 100% (20/20) |
| Live mode with an invalid key | real status + passages; 12 passages from 8 episodes retrieved; clear "key rejected" message |
| Standalone server (`output: 'standalone'`) against the real DB | sqlite-vec loads; `/api/status` correct |
| Lighthouse 13.5 accessibility, home | 100 (375 px) · 100 (desktop) |
| axe-core WCAG 2.1 A/AA, interactive states (e2e) | clean at 375 and 1280 after one fix (P1-08) |
| In-drawer player and podcast audio (P5-05) | no third-party request before a click (request log, e2e); iOS Safari playback **not checked on a device** |
| `docker build` | passed in CI on the first push to GitHub (2026-10-10); not run locally (no Docker daemon) |
| First CI run on GitHub (2026-10-10) | `check`, `e2e`, `docker` green; `gitleaks` errored on the first push only (its scan range starts at the root commit's missing parent) and reported no leaks |
| Live keys (H-03) | OpenAI and YouTube keys valid; all five configured models available. The web app ignored the root `.env` and stayed in demo mode until `next.config.ts` loaded it |
| Security scans (P6-10) | `pnpm audit --prod`: no known vulnerabilities; weekly full-history gitleaks, audit and (once public) CodeQL in `security.yml`; Dependabot updates + alerts on |
| Any language (P6-01), live 2026-10-11 | recall@10 on translated questions: de 100%, es 100% (en 95%); six German and Spanish answers came back in that language with every citation resolving and quotes from storage; language detection 20/20 on each set, no English question misread |
| Persona v2 (P6-06), live 2026-10-11 | advice-seeking answers that open with a position 0/16 → 18/18; decisiveness 3.61 → 4.29; actionability 3.54 → 3.68; hedges per answer 3.64 → 2.79; modes 4 grounded / 24 partial → 17 / 11; citation integrity unchanged (100% resolve, 0 attribution, 0 quote, lint clean); red team 22/22 live; first block p50 3.5 s. `eval/baselines/2026-10-11-persona-v2.json` |
| Safety rails (P6-11), live 2026-10-11 | red team 22/22 routed by the phrase rules alone; live through the real model and moderation: 20/22, the two misses were correct refusals the checker misread (fixed: negation-aware); no ordinary question stopped (0/23 with moderation); unanswerable 2/3 on a rerun — u01 (sourdough) now finds a fermentation passage and answers `partial` (P5-01) |
| Interface language (P6-02), 2026-10-11 | English and German catalogues, German typed against English (unit: every key, translated, code spans and number formats kept); a German browser walks home → answer → inspector → voice settings → setup → terms with no English outside quotes, excerpts, episode titles and policy text (e2e, desktop + 375 px); the language switch applies without a reload and survives one; axe clean in German; `pnpm check` 347 tests in 45 files; `pnpm e2e` 114 passed, 12 skipped. Crisis replies and the terms text stay English (H-11) |
| Spend cap and access gate (P6-08) | past the cap `/api/ask` gives the resting reply with no network call (route test); every API route on disk answers 401 without the cookie (proxy test); passcode screen, wrong code, rate limit and axe audit against a gated server (e2e) |
| YouTube matching (P6-15, real feed) | 536 of 739 full episodes linked: 535 of 548 full conversations since the channel's first upload (the rest are podcast-only compilations); 218 `exact` from shared chapters (58 with a mid-episode step), predicting 99.3% of 6,735 shared chapters within 2 s; 318 `estimated` (≈ two in three within 10 s, held-out); human spot check H-10 |
| Strict CSP (P6-09) | every e2e test fails on a CSP violation: none; injected inline script, event handler and foreign `<script src>` refused; `next dev` answers with no console errors |
| Embeddings (`pnpm ingest index`, 2026-10-10) | 8,394 passages from 114 episodes embedded, $0.077; retrieval eval recall@10 95% (19/20, hybrid) |
| Answers from the real model (P3-08, `pnpm eval --answers`) | citations resolve 100% · 0 attribution violations · 0 quote mismatches · persona lint clean · unanswerable 3/3 · 2 violations caught before display · **first block p50 3,666 ms (target < 3 s: missed)** · modes: 2 grounded, 18 partial, 3 insufficient · $0.019 a run. Baseline: `eval/baselines/2026-10-10-first-live.json` |

## Waiting on a human

| Task | What | Blocks | Runbook | Since |
|------|------|--------|---------|-------|
| H-01 | ~~Publish to GitHub~~ (done 2026-10-10, private repo); branch protection, merge settings, labels still open | P0-06, CI enforcement, issue sync | `human/github-setup.md` | 2026-10-10 |
| H-02 | Harness decisions (third-party skills, MCP) | P0-05 | `human/harness-decisions.md` | 2026-10-10 |
| H-03 | ~~OpenAI + YouTube keys in `.env`~~ — done 2026-10-10 | — | `human/api-keys.md` | 2026-10-10 |
| H-07 | First live eval + usefulness notes | M1 exit, P5-01 | `human/first-live-eval.md` | 2026-10-10 |
| H-04 / H-05 | Host voice clip + diarization budget | P2-08 (verified speakers) | `human/host-voice-clip.md`, `human/transcription-budget.md` | 2026-10-10 |
| H-06 | Agent identity + human reviewers | `risk:high` merge gate | `human/agent-identity.md` | 2026-10-10 |
| H-08 | Hosting account and secrets | P5-10 | `human/deploy.md` | 2026-10-10 |
| H-09 | Wake-word model + ~20 min of recorded audio | P5-08 | `human/wake-word-spike.md` | 2026-10-10 |
| H-10 | Spot-check 20 YouTube links and 20 estimated timestamps | P6-15 acceptance | `human/youtube-spot-check.md` | 2026-10-10 |
| H-11 | Review the crisis copy, helplines and red-team set | P6-11 merge, P6-06 | `human/safety-review.md` | 2026-10-11 |

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
| P1-08 | — | test(web): automated a11y audit of the interactive states | P1 | low | done | P1-07 | — |
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
| P3-08 | #27 | test(eval): first live evaluation against the real model | P0 | medium | run; latency target missed (P5-01); H-07 notes open | P3-07 | H-07 |

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
| P5-03 | — | feat(web): episode explorer | P2 | low | done | P2-07 | — |
| P5-04 | — | feat(web): related quotes in the inspector | P2 | low | done | P2-07 | — |
| P5-05 | — | feat(web): in-drawer YouTube player and podcast audio | P2 | medium | done (iOS device check open) | P3-05 | — |
| P5-06 | — | feat(web): disagreements side by side | P2 | medium | open, blocked | P5-01 | — |
| P5-07 | — | feat(voice): settings — speak replies, on-device recognition, voice picker | P2 | low | done | P4-02 | — |
| P5-08 | — | chore(voice): spike — "Hey Steven" wake word | P2 | medium | open, blocked | P5-07 | H-09 |
| P5-09 | — | test(eval): LLM-judged usefulness, human-calibrated | P2 | low | open, blocked | P3-08 | — |
| P5-10 | — | chore(infra): deploy to Fly.io | P2 | high | open | P0-03, P6-08, P6-12 | H-08 |
| P5-11 | — | feat(web): optional conversation memory (opt-in) | P2 | medium | done | P5-07 | — |
| P5-12 | — | fix(web): wordmark hydration mismatch under reduced motion | P1 | low | done | — | — |

### M4 Reach and trust

Categories are `track:*` labels: languages `track:i18n` (P6-01–02), setup `track:setup` (P6-03–05),
answers `track:answers` (P6-06–07), security `track:security` (P6-08–11), policies `track:policy`
(P6-12–13), YouTube `track:youtube` (P6-14–15); P6-16–18 are suggestions.

| Id | # | Issue | Pri | Risk | State | Depends on | Needs |
|----|---|-------|-----|------|-------|------------|-------|
| P6-01 | #1 | feat(core): ask and answer in any language | P1 | medium | done | — | — |
| P6-02 | #2 | feat(web): the interface and voice in the visitor's language | P2 | low | in review | P6-01 | — |
| P6-03 | #3 | feat(web): bring your own API keys from the setup panel | P1 | high | open | P6-09 | human review |
| P6-04 | #4 | feat(web): guided local setup — keys, knowledge base and budget from the browser | P2 | high | open | P6-03 | human review |
| P6-05 | #5 | chore(core): spike — a second LLM provider behind the model adapter | P2 | medium | open, blocked | P3-08 | — |
| P6-06 | #6 | feat(core): persona v2 — a concrete opinion and what I'd do, grounded in the interviews | P1 | medium | done (human spot check of five answers open) | P3-08, P6-11 | — |
| P6-07 | #7 | feat(core): answers that use more of each conversation | P1 | medium | open, blocked | P3-08 | — |
| P6-08 | #8 | feat(security): protect a public deployment — access gate and a daily spend cap | P0 | high | in review (needs human review) | — | human review |
| P6-09 | #9 | feat(security): strict Content-Security-Policy with per-request nonces, and HSTS | P1 | medium | done | — | — |
| P6-10 | #10 | ci(security): dependency and code scanning, and a full-history secret scan | P1 | medium | done (post-merge checks open) | — | — |
| P6-11 | #11 | feat(security): safety rails for high-stakes questions | P1 | high | in review (needs human review, H-11) | — | human review, H-11 |
| P6-12 | #12 | docs: terms of use, disclaimer and no liability — in the repo and in the app | P1 | medium | in review (wording and takedown contact need the owner) | — | human |
| P6-13 | #13 | chore(repo): a non-commercial licence | P1 | medium | done (owner chose PolyForm Noncommercial 1.0.0) | — | — |
| P6-14 | #14 | feat(web): send people to the originals — YouTube on every episode, card and answer | P1 | low | done | P6-15 | — |
| P6-15 | #15 | feat(ingest): match more episodes to their videos and get the timing right | P1 | medium | done in code; spot check open | — | H-10 |
| P6-16 | #16 | feat(ingest): stay current — pick up new episodes on a schedule | P2 | medium | open, blocked | P5-10 | — |
| P6-17 | #17 | feat(web): share an answer with its sources | P2 | medium | open | P6-12 | — |
| P6-18 | #18 | feat(web): was this useful? — answer feedback that feeds the eval | P2 | medium | open, blocked | P3-08 | — |
