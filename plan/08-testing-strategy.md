# 08 — Testing strategy

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | every issue; test reviewer |

Tests prove claims. Each layer names the claim it protects. A fluent answer is not a correct
answer, so usefulness, retrieval, citations and persona are measured **separately**.

## 1. Layers

| Layer | Claim it protects | Where |
|-------|-------------------|-------|
| Unit | Each decision is correct in isolation: VTT parsing, guest names, chunking, FTS query safety, RRF, quote location, validation rules, downgrade, mode, stage machine, SSE parsing, conversation reducer, YouTube links, voice-path choice | `packages/*/src/**/*.test.ts`, `apps/web/src/**/*.test.ts` |
| Store integration | Migrations, triggers and cascades really keep FTS5/vec0 in sync; purge removes everything | `packages/core/src/store/store.test.ts` (real SQLite file) |
| Pipeline | Retrieve → stream → validate → repair → downgrade → final, with a scripted model: event order, stable citation ids, stored quote spans, honest modes, empty KB, malformed output | `packages/core/src/answer/compose.test.ts` |
| Fixture integrity | Demo answers are valid, labelled, never use the host chip or video links, quotes are verbatim | `apps/web/src/lib/demo-fixtures.test.ts` |
| E2E | A person can do what the product promises, with no keys, on desktop and mobile, with reduced motion, by voice, with a blocked mic | `apps/web/e2e/*.spec.ts` |
| Accessibility | WCAG 2.1 A/AA holds in every interactive state, at 375 and 1280 | `apps/web/e2e/a11y.spec.ts` (axe-core); Lighthouse on home |
| Architecture fitness | Core stays framework-free; client never imports server core; no cycles | `pnpm arch` |
| Retrieval eval | Relevant episodes are found (recall@10 ≥ 0.8) | `pnpm eval` |
| Answer eval | With the real model: citations resolve, quotes byte-match, no attribution violations, persona lint clean, unanswerable → insufficient, first block p50 < 3 s | `pnpm eval --answers` (H-07) |
| Usefulness | Does it actually help? | Human judgement on the eval set (H-07); LLM-judged later (P5-09) |

## 2. Conventions

- Tests assert behaviour through public functions; no reaching into private state.
- Time is injected (`now`), sleeps are injected (`streamDemoAnswer(…, sleep)`), randomness avoided.
- Fixture names are fictional (historical figures in core tests, "Demo Guest" in the UI).
- E2E runs against a production build in forced demo mode (`DEAR_STEVEN_DEMO=1`), never the network.
- Browser APIs that need external services (Web Speech) are replaced by scripted stand-ins in the
  page; Chromium's fake microphone covers MediaRecorder.
- A flaky test is a bug: quarantine with an issue; never `retry` to green (`retries: 0`).

## 3. Deliberately not tested

Pixel-exact layout and animation timing; OpenAI's model behaviour beyond the eval suite; YouTube
Data API responses beyond the matcher's unit tests; Safari and Firefox engines in CI (Chromium
only — the decision table in `voice/capabilities.ts` is unit-tested instead).
