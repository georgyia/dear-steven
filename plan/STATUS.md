# STATUS — the live board

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | every issue |

Updated **in the same PR** as the work it describes (`plan/README.md` §6).

## Now

- **Phase:** M8 *Launch readiness* (`plan/04-issues/phase-10.md`) merged to `main` on
  2026-10-16. That's 13 issues: P10-01 to P10-12, plus P10-13, which merging found. P10-14 to P10-16
  came after: two from the owner trying voice and the interview, one from the diarization batch;
  all three merged the same day (#139, #137, #138). On the merged `main`, vitest has 850 tests. Each PR merged on the
  owner's instruction, without CI (billing), once the same checks passed locally on its exact head
  commit (`--match-head-commit`):
  - lint and typecheck of every package, one at a time;
  - vitest: 820 tests at the end;
  - dependency-cruiser;
  - `playwright test --workers=2`: 247 passed at the end.

  Every run had a memory guard, because the machine has 16 GB and two freezes this week came from
  parallel builds. A run peaked at 2.5 GB. No real device tried yet.
- **What M8 changed:**
  - a production server won't spend the operator's key without a daily cap;
  - `/api/health`;
  - `fly.toml` and a deploy runbook;
  - request bodies capped before they're read;
  - free questions given back when OpenAI fails;
  - no answer without the safety check, but a rejected key reported as such;
  - crisis replies always give a helpline finder;
  - visitor-worded errors;
  - error and 404 pages;
  - the icon and link preview;
  - the AI disclosure in the interview;
  - an accurate privacy notice and a legal notice page, waiting for the operator's details.
- **Merged first (2026-10-16), on the owner's instruction, without CI:** the stack #96 → #104 (the
  security re-check, P8-08 and P8-09, the paid transcription fixes P8-10 to P8-12). The same tree
  passed `pnpm check` (653 tests) and `pnpm e2e` (201 passed, 12 skipped) locally.
- **Paid data, stopped (2026-10-16):** the diarization batch ended when OpenAI refused with the
  account's spend limit, and the owner chose not to spend more for now.
  - 100 conversations are diarized ($73.11 recorded), and 114 have the publisher's transcripts.
    All 214 are chunked, so keyword search covers them.
  - Embeddings (about $0.07) and summaries (about $0.70) for the new ones wait for that decision.
  - `attribute`: 89 ok; 10 have several guests, so guest speech stays unattributed; one host-only
    episode.
- **Next:** M9 *Open to contributors* (`plan/04-issues/phase-11.md`): 21 issues, and none needs a
  paid call. Start with P11-01, the runner pin, before `ubuntu-latest` starts moving on
  2026-10-19.
- **To switch on:** `DEAR_STEVEN_FREE_QUESTIONS=3` on a deployment (`docs/DEPLOY.md`), with
  `DEAR_STEVEN_DAILY_BUDGET_USD` set and the client address configured.
- **Waiting on the owner, before a public launch:**
  - permission from, or a legal view on, using the podcast's transcripts and Steven Bartlett's
    name (none is recorded);
  - the contact address and the operator's details for the legal notice (`CONTACT` and
    `OPERATOR` in `apps/web/src/content/policies.ts`);
  - a lawyer's review of the policies (P6-12);
  - H-11 (crisis copy and helplines; #35 needs it too);
  - H-08 (hosting account and secrets; the runbook is `docs/DEPLOY.md`, with `fly.toml` committed);
  - whether data-processing agreements with OpenAI and the host are in place;
  - GitHub billing, so CI runs again (then re-run it on `main`);
  - H-07 (five live answers) and H-10 (YouTube spot check);
  - spoken Talk and the interview on a real device in Chrome, Safari and Firefox.
- **Waiting on the owner, not blocking launch:** P8-05 (accounts with Supabase; a recommendation
  is on #73), the P6-07 decision (draft #33), P7-11 (how a deployment schedules ingest).

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
| Bring your own key (P6-03), 2026-10-11 | A canary key through `/api/key`, `/api/status`, `/api/ask` and `/api/speech` appears in no response or log line — not even OpenAI's masked echo — while the request runs on it (`Authorization: Bearer <canary>` to api.openai.com); nothing cached or written to the spend ledger; malformed, plain-HTTP, keyless, forced-demo and rate-limited checks refused without a call. A keyless server goes live for that browser; a visitor's key is neither counted against nor stopped by the operator's cap. E2E: paste → test → ask (the request carries the key) → forget (the next one doesn't); tab vs device storage; axe clean. Leak test mutation-checked. No live OpenAI call made |
| Share an answer (P6-17), 2026-10-11 | A link copied from a demo answer opens the same question, quotes and citation ids on a fresh page, labelled shared and demo, the disclosure in view and the fragment cleared (e2e, desktop + 375 px, axe clean); a link with one changed signature character opens nothing and says so; the image card downloads as a 1,080 px PNG with the disclosure drawn in. Server: one changed character, a truncated or other-version token and another deployment's secret all open nothing; a validly signed non-answer and a 1 MB decompression bomb are refused; the secret is saved owner-only and survives a restart; a live answer stops opening once a cited passage leaves the knowledge base (signature, bomb and takedown checks mutation-tested). No OpenAI call |
| Guided local setup (P6-04), 2026-10-11 | Against a server started as `pnpm dev:setup` starts one, a fixture feed and a fake OpenAI (e2e): the link opens the setup panel and leaves the address bar; keys saved to the env file (mode 0600) and never shown again; two episodes fetched, transcribed and chunked with their output streamed; the embedding estimate shown, then a capped run; `pnpm ingest status` on the same database agrees with the panel; axe clean. Routes: 404 without the token, with a wrong one, from a non-loopback Host, a foreign Origin or Fetch Metadata, or through a non-loopback hop, and on the main e2e server (each guard check mutation-tested); a value with a newline refused before the file is touched; over-budget embedding refused with no process started; one stage at a time; closing the page stops the stage. YouTube linking is guarded (needs a key) but not run in e2e (no fake YouTube API). No real OpenAI call |
| Spend cap and access gate (P6-08) | past the cap `/api/ask` gives the resting reply with no network call (route test); every API route on disk answers 401 without the cookie (proxy test); passcode screen, wrong code, rate limit and axe audit against a gated server (e2e) |
| YouTube matching (P6-15, real feed) | 536 of 739 full episodes linked: 535 of 548 full conversations since the channel's first upload (the rest are podcast-only compilations); 218 `exact` from shared chapters (58 with a mid-episode step), predicting 99.3% of 6,735 shared chapters within 2 s; 318 `estimated` (≈ two in three within 10 s, held-out); human spot check H-10 |
| Strict CSP (P6-09) | every e2e test fails on a CSP violation: none; injected inline script, event handler and foreign `<script src>` refused; `next dev` answers with no console errors |
| Embeddings (`pnpm ingest index`, 2026-10-10) | 8,394 passages from 114 episodes embedded, $0.077; retrieval eval recall@10 95% (19/20, hybrid) |
| Talk read aloud as it is checked (P9-01), live 2026-10-14 | time from sending a talk question to the first sound, median of five on the real model: **7.3 s → 3.4 s**. Before, the whole answer (median 3.6 s) and then the whole MP3 of `spoken` (4.1 s); now the first checked block (2.9 s) and then the first PCM bytes of its own text (0.7 s). Every reply was one block. About $0.06 |
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
| P6-01 | #1 | feat(core): ask and answer in any language | P1 | medium | done, merged 2026-10-13 | — | — |
| P6-02 | #2 | feat(web): the interface and voice in the visitor's language | P2 | low | done, merged 2026-10-13 | P6-01 | — |
| P6-03 | #3 | feat(web): bring your own API keys from the setup panel | P1 | high | done, merged 2026-10-13 (merged on the owner's instruction without a separate review) | P6-09 | — |
| P6-04 | #4 | feat(web): guided local setup — keys, knowledge base and budget from the browser | P2 | high | done, merged 2026-10-13 (merged on the owner's instruction without a separate review) | P6-03 | — |
| P6-05 | #5 | chore(core): spike — a second LLM provider behind the model adapter | P2 | medium | open, blocked | P3-08 | — |
| P6-06 | #6 | feat(core): persona v2 — a concrete opinion and what I'd do, grounded in the interviews | P1 | medium | done, merged 2026-10-13; human spot check of five answers open | P3-08, P6-11 | H-07 |
| P6-07 | #7 | feat(core): answers that use more of each conversation | P1 | medium | draft PR #33: acceptance not met on the judge; owner decides | P3-08 | decision |
| P6-08 | #8 | feat(security): protect a public deployment — access gate and a daily spend cap | P0 | high | done, merged 2026-10-13 (merged on the owner's instruction without a separate review) | — | — |
| P6-09 | #9 | feat(security): strict Content-Security-Policy with per-request nonces, and HSTS | P1 | medium | done, merged 2026-10-13 | — | — |
| P6-10 | #10 | ci(security): dependency and code scanning, and a full-history secret scan | P1 | medium | done, merged 2026-10-13 | — | — |
| P6-11 | #11 | feat(security): safety rails for high-stakes questions | P1 | high | done, merged 2026-10-13; crisis copy and helplines still need H-11 | — | H-11 |
| P6-12 | #12 | docs: terms of use, disclaimer and no liability — in the repo and in the app | P1 | medium | done, merged 2026-10-13; wording review and takedown contact still open | — | human |
| P6-13 | #13 | chore(repo): a non-commercial licence | P1 | medium | done, merged 2026-10-13 | — | — |
| P6-14 | #14 | feat(web): send people to the originals — YouTube on every episode, card and answer | P1 | low | done, merged 2026-10-13 | P6-15 | — |
| P6-15 | #15 | feat(ingest): match more episodes to their videos and get the timing right | P1 | medium | done, merged 2026-10-13; spot check open | — | H-10 |
| P6-16 | #16 | feat(ingest): bring in the latest episodes — one command, one button, and a schedule | P1 | medium | moved to M5 (re-scoped 2026-10-13) | — | — |
| P6-17 | #17 | feat(web): share an answer with its sources | P2 | medium | done, merged 2026-10-13 | P6-12 | — |
| P6-18 | #18 | feat(web): was this useful? — answer feedback that feeds the eval | P2 | medium | open, blocked | P3-08 | — |

### M5 Conversations

Categories are labels: conversations `track:conversation` (P7-05–08), design `track:design`
(P7-02–03), bugs `bug` (P7-01, P7-04, P7-10), tests `type:test` (P7-12), knowledge base
`track:ingest` (P6-16, P7-11), maintenance `track:infra` (P7-09).

| Id | # | Issue | Pri | Risk | State | Depends on | Needs |
|----|---|-------|-----|------|-------|------------|-------|
| P7-01 | #46 | fix(web): browser extensions that edit the page no longer cause a hydration error | P1 | low | done | — | — |
| P7-02 | #48 | fix(design): no more "·" separators — structure through layout and wording | P1 | low | done | — | — |
| P7-03 | #49 | feat(design): a proper quote preview when you hover a source | P1 | low | done | P7-02 | — |
| P7-04 | #47 | fix(web): on phones the demo notice no longer hides the first-visit notice | P2 | low | done | — | — |
| P7-10 | #60 | fix(web): with reduced motion, the home screen no longer stays blurred | P1 | low | done | — | — |
| P7-12 | #68 | test(web): the phone first-visit check waits for the home screen to settle | P2 | low | done | — | — |
| P6-16 | #16 | feat(ingest): bring in the latest episodes — one command, one button, and a schedule | P1 | medium | done | — | — |
| P7-05 | #50 | feat(core): talk mode — just talk to Steven | P1 | medium | done | — | — |
| P7-06 | #51 | feat(core): interview mode — Steven interviews you, the way he interviews his guests | P1 | medium | done | P7-05 | — |
| P7-07 | #52 | feat(core): practise presenting your expertise — a mock interview with a debrief | P1 | medium | done | P7-06 | — |
| P7-08 | #53 | feat(web): remember what Steven learned about you — opt-in, on this device | P2 | medium | done | P7-06 | — |
| P7-09 | #54 | chore(ci): keep TypeScript and Node's types on the versions the stack needs | P2 | low | done | — | — |
| P7-11 | #63 | chore(infra): keep a deployment up to date with new episodes on a schedule | P2 | medium | open, blocked | P6-16 | decision |

### M6 Summaries and open access

Categories are labels: security `track:security` (P8-01, P8-02, P8-05), summaries
`track:summaries` (P8-03, P8-04). `risk:high` PRs in M6 merge after green CI on the owner's
instruction (2026-10-13).

| Id | # | Issue | Pri | Risk | State | Depends on | Needs |
|----|---|-------|-----|------|-------|------------|-------|
| P8-01 | #71 | fix(security): your own key, audited and kept encrypted, behind limits that can't be reset | P0 | high | done, merged on the owner's instruction (2026-10-13) | — | — |
| P8-07 | #82 | test(web): the sealed-key tamper test always changes what it tampers with | P1 | low | done | P8-01 | — |
| P8-02 | #72 | feat(security): three free questions on the operator's key, then your own | P1 | high | done, merged on the owner's instruction (2026-10-13) | P8-01 | — |
| P8-03 | #74 | feat(ingest): episode summaries, with every line quoted from the transcript | P1 | medium | done | — | — |
| P8-04 | #75 | feat(web): read an episode's summary in the explorer | P1 | low | done | P8-03 | — |
| P8-05 | #73 | chore(infra): accounts and server-side key storage with Supabase — decide first | P2 | high | open, blocked | P8-02 | decision |
| P8-06 | #81 | chore(ci): give the e2e job room for the servers it now runs | P1 | low | done | — | — |
| P8-08 | #94 | fix(security): the API refuses requests sent from other sites' pages | P0 | high | done, #97, merged on the owner's instruction without CI (2026-10-16) | — | — |
| P8-09 | #95 | fix(security): free questions need a daily cap | P1 | high | done, #98, merged on the owner's instruction without CI (2026-10-16) | — | — |
| P8-10 | #99 | fix(ingest): paid transcription in batches: only episodes with no transcript, and no audio left on disk | P1 | medium | done, #100, merged without CI (2026-10-16) | — | — |
| P8-11 | #101 | fix(ingest): a diarized voice is credited to the guest only when the labels leave no doubt | P0 | medium | done, #102, merged without CI (2026-10-16) | P8-10 | — |
| P8-12 | #103 | fix(ingest): inserted ads are dropped from audio transcripts, and the timing after them closes up | P0 | medium | done, #104, merged without CI (2026-10-16) | P8-11 | — |

### M7 Spoken conversations

Categories are labels: voice `track:voice` (P9-01–03). M7 merged on the owner's instruction
(2026-10-15) without CI, which wasn't starting; the same checks ran locally.

| Id | # | Issue | Pri | Risk | State | Depends on | Needs |
|----|---|-------|-----|------|-------|------------|-------|
| P9-01 | #86 | feat(voice): Steven starts answering out loud as soon as his reply is checked | P1 | medium | done | — | — |
| P9-02 | #87 | feat(voice): talk hands-free — Steven listens, answers out loud, and listens again | P1 | medium | done; no real device or browser tried yet (scripted recognition and a fake mic in e2e) | P9-01 | — |
| P9-03 | #88 | feat(voice): the interview, spoken — Steven asks aloud, you answer aloud, and he moves on when you've finished | P1 | medium | done; no real device or browser tried yet | P9-02 | — |

### M8 Launch readiness

Categories are labels: deployment `track:infra` (P10-01–03), security and safety `track:security`
(P10-04–07), visitor-facing `track:web` (P10-08–11), policies `track:policy` (P10-12). Every M8 PR
merges after local checks on the owner's instruction (2026-10-16), `risk:high` included.

| Id | # | Issue | Pri | Risk | State | Depends on | Needs |
|----|---|-------|-----|------|-------|------------|-------|
| P10-01 | #105 | fix(security): a public deployment won't spend the operator's key without a daily cap | P0 | high | done, #121, merged on the owner's instruction without CI (2026-10-16) | — | — |
| P10-02 | #106 | feat(infra): a health check that fails when the site can't answer | P0 | medium | done, #122, merged on the owner's instruction without CI (2026-10-16) | P10-01 | — |
| P10-03 | #107 | chore(infra): Fly.io configuration and a runbook for the knowledge base | P0 | medium | done, #123, merged on the owner's instruction without CI (2026-10-16) | P10-01, P10-02 | — |
| P10-04 | #108 | fix(security): request bodies are capped before they are read | P1 | medium | done, #126, merged on the owner's instruction without CI (2026-10-16) | — | — |
| P10-05 | #109 | fix(security): a free question isn't used up when OpenAI fails to answer it | P1 | high | done, #127, merged on the owner's instruction without CI (2026-10-16) | — | — |
| P10-06 | #110 | fix(security): no question is answered without its safety check | P1 | high | done, #119, merged on the owner's instruction without CI (2026-10-16) | — | — |
| P10-07 | #111 | fix(security): a crisis reply always says how to find a helpline in any country | P1 | high | done, #120, merged on the owner's instruction without CI (2026-10-16) | — | H-11 reviews the line |
| P10-08 | #112 | fix(web): visitors see errors in their own words; the operator's details go to the log | P1 | low | done, #118, merged on the owner's instruction without CI (2026-10-16) | — | — |
| P10-09 | #113 | feat(web): an error page and a not-found page in Dear Steven's own design | P1 | low | done, #128, merged on the owner's instruction without CI (2026-10-16) | — | — |
| P10-10 | #114 | feat(web): an icon and a link preview that say it's an unofficial AI persona | P2 | low | done, #129, merged on the owner's instruction without CI (2026-10-16) | — | — |
| P10-11 | #115 | fix(web): the interview shows the AI disclosure too, and it says it isn't advice | P1 | low | done, #130, merged on the owner's instruction without CI (2026-10-16) | — | — |
| P10-12 | #116 | docs: a privacy notice that says where data goes, and a legal notice page | P0 | medium | done, #131, merged on the owner's instruction without CI (2026-10-16) | — | operator's details and contact, lawyer (P6-12) |
| P10-13 | #124 | fix(security): a rejected key is reported as such, not as a failed safety check | P1 | high | done, #125, merged on the owner's instruction without CI (2026-10-16); found while merging P10-08 onto P10-06 | P10-06 | — |
| P10-14 | #133 | fix(voice): you aren't cut off mid-thought: listening carries on when the browser stops | P1 | medium | done, #139, merged on the owner's instruction without CI (2026-10-16); found by the owner trying it | — | real-device check |
| P10-15 | #134 | fix(core): the interview asks in the language you chose, unless you clearly answer in another | P1 | low | done, #137, merged on the owner's instruction without CI (2026-10-16); found by the owner trying it | — | — |
| P10-16 | #135 | fix(ingest): a failed episode's paid audio counts toward the budget, and an outage stops the run | P1 | medium | done, #138, merged on the owner's instruction without CI (2026-10-16); found in the diarization batch | — | — |

### M9 Open to contributors

Categories are labels: CI and supply chain `track:infra` (P11-01, P11-05, P11-19, P11-20), security
and privacy `track:security` (P11-02, P11-04, P11-10, P11-11), contributors `track:docs` (P11-03,
P11-12, P11-18, P11-21), knowledge base `track:ingest` (P11-06, P11-07, P11-14, P11-15), free
features `track:web` / `track:core` (P11-08, P11-09, P11-13), tests (P11-16, P11-17). Written on
the owner's request (2026-10-17); nothing here needs a paid call. Normal merge policy: no
`risk:high` among them.

| Id | # | Issue | Pri | Risk | State | Depends on | Needs |
|----|---|-------|-----|------|-------|------------|-------|
| P11-01 | #141 | ci: pin the runner to Ubuntu 24.04 before ubuntu-latest moves to 26.04 | P0 | low | open; good first issue | — | — |
| P11-02 | #145 | docs(security): SECURITY.md for private reports, and a checklist for going public | P1 | medium | open | — | owner: the settings (H-12) |
| P11-03 | #149 | docs: CONTRIBUTING.md, a code of conduct, and issue forms for people | P1 | low | open; good first issue | P11-02 | — |
| P11-04 | #146 | fix(security): cross-origin isolation headers and a deny-by-default Permissions-Policy | P1 | medium | open | — | — |
| P11-05 | #142 | ci(security): the container's base image pinned by digest, kept current, and scanned | P1 | medium | open | — | GitHub billing to run in CI |
| P11-06 | #153 | feat(ingest): correct an episode's guest names by hand, and re-check its speaker labels | P1 | medium | open | — | — |
| P11-07 | #154 | feat(ingest): backup and restore commands that check what they copy | P1 | medium | open | — | — |
| P11-08 | #157 | feat(web): find the moment — search what was said across every conversation | P1 | medium | open; help wanted | — | — |
| P11-09 | #158 | feat(core): quotes-only replies when no answer model is available | P1 | medium | open | — | — |
| P11-10 | #147 | fix(security): the answer log is owner-only, rotated daily and kept 30 days at most | P2 | medium | open | — | — |
| P11-11 | #148 | chore(infra): structured server logs with a request id, and proof nothing personal is logged | P2 | medium | open | — | — |
| P11-12 | #150 | chore(repo): checks that fit a 16 GB laptop, one step at a time | P2 | low | open; good first issue | — | — |
| P11-13 | #159 | feat(web): export a conversation as Markdown, every citation a link to its moment | P2 | low | open; good first issue, help wanted | — | — |
| P11-14 | #155 | feat(ingest): a retried diarization reuses the chunks it already paid for | P2 | medium | open | P10-16 | — |
| P11-15 | #156 | chore(ingest): spike — free semantic search with a local embedding model | P2 | medium | open; help wanted | — | — |
| P11-16 | #160 | test(web): visual regression screenshots of the main screens | P2 | low | open; help wanted | — | — |
| P11-17 | #161 | test(core): property-based tests for quote matching and the search query builder | P2 | low | open; good first issue | — | — |
| P11-18 | #151 | docs: a guide to adding an interface language, and catalogue tests for any number of them | P2 | low | open; good first issue, help wanted | — | — |
| P11-19 | #143 | chore(deps): move to the OpenAI SDK v7, every call path checked | P2 | medium | open | — | optional: a few cents for a live smoke run |
| P11-20 | #144 | chore(deps): move to motion 14, with reduced motion unchanged | P2 | low | open | — | — |
| P11-21 | #152 | docs: research — what it would take to run this for another show | P2 | medium | open | — | owner decision |
