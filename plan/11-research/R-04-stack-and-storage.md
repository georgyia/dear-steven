# R-04 — What stack and storage for one developer?

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | ADR-001, ADR-002, ADR-003 |

## Question

Which framework, storage and model API give a polished UI, streaming, and trustworthy retrieval
without infrastructure?

## Findings (checked 2026-10-10)

- npm latest: next 16.4.0, react 19.3.0, typescript **7.0.2** (Go-native; its package exposes only
  `./unstable/*` APIs, no classic `typescript` module — `next build` type-checking needs 6.x),
  motion 14.1 (React Bits targets `^12.23`), openai 7.32 (v6 line at 6.49), better-sqlite3
  13.0.3, sqlite-vec 0.1.9, zod 4.6.5, vitest 5.0.3, @playwright/test 1.64.0, @biomejs/biome 2.5.15.
- sqlite-vec 0.1.9 + FTS5 work with better-sqlite3 13 on Node 22 (darwin-arm64 verified;
  `distance_metric=cosine` supported). vec0 inserts need BigInt rowids.
- sqlite-vec locates its binary with `import.meta.resolve` at runtime; Next's standalone tracing
  misses it without `outputFileTracingIncludes`.
- Node 22.18+ strips TypeScript natively: the CLI runs as `node src/cli.ts` with `.ts` imports.
- Retrieval on the real corpus (20 episodes, 1,621 passages): keyword search 2–7 ms per query;
  with 40 candidates per list one dominant episode filled the pool (a "Dana White" question
  returned only 3 passages after the per-episode cap) — 80 candidates fixed it.
- `openai/helpers/zod` `zodTextFormat` emits strict-mode-compatible JSON schema from zod 4.

## Decision

See ADR-001 (Next.js 16), ADR-002 (one SQLite file, no ORM), ADR-003 (OpenAI Responses API via
SDK v6, no AI SDK). Versions pinned exactly in `package.json`s.

## Sources

- `npm view <pkg> version time` — 2026-10-10; local smoke tests — 2026-10-10
