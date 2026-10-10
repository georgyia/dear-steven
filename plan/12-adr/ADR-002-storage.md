# ADR-002 — One SQLite file for metadata, transcripts, keyword and vector search

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | human | 2026-10-10 | P2-01, P2-03 |

**Decision owner:** human (approved with the plan; ORM change confirmed in this ADR) · **Supersedes:** —

## Context

Realistic corpus: 20k–60k passages (≈ 80 per episode measured on 20 episodes; ~740 full episodes). We need
metadata, cue-level transcripts, BM25 keyword search and vector KNN, locally, with zero infrastructure.

## Options

1. **SQLite** (better-sqlite3) with FTS5 + sqlite-vec `vec0`.
2. Postgres + pgvector (a server to run).
3. LanceDB / a dedicated vector DB plus a separate metadata store.

## Decision

Option 1, in `data/dear-steven.db`. Tables: `episodes`, `segments`, `passages`, `passages_fts`
(external-content FTS5, porter tokenizer), `passages_vec` (`float[1536]`, cosine), `ingestion_runs`,
`kb_meta`, kept in sync by triggers. Hybrid retrieval = BM25 top-80 + KNN top-80 → RRF (k = 60) →
≤ 3 per episode → 12.

**Departure from the plan: no Drizzle.** The plan proposed Drizzle for tables and migrations with
raw SQL for the virtual tables. In practice three of the seven tables are virtual or
trigger-maintained and the important queries are raw SQL anyway; numbered SQL migrations tracked
by `PRAGMA user_version` (40 lines) plus typed row mappers in `KnowledgeStore` are simpler and
remove a dependency and its codegen.

## Consequences

- Brute-force KNN is fine to ~100k passages (~100 ms at 100k × 1,536).
- One writer at a time (the CLI); the web reads. WAL mode + busy timeout.
- Every read/write goes through `KnowledgeStore`; the schema is a core implementation detail.

## Revisit when

Passages exceed ~200k (escape hatch: LanceDB for vectors), or we need multiple writers.
