# 12 — Architecture decision records

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | architecture issues |

An ADR records one decision, the options considered, and what follows. ADRs are never edited into
a different decision: a changed mind is a **new** ADR that supersedes the old one.

| ADR | Decision | Status |
|-----|----------|--------|
| ADR-001 | Next.js 16 App Router as a thin server shell; one client stage; one deployable unit | adopted |
| ADR-002 | One SQLite file: better-sqlite3 + FTS5 + sqlite-vec; hand-written migrations, no ORM | adopted |
| ADR-003 | OpenAI Responses API with strict structured output via the SDK; no AI SDK | adopted |
| ADR-004 | Transcript sources: RSS VTT first, paid diarization by approval, no caption scraping | adopted |

Template: Status table · Decision owner · Supersedes / superseded by · Context · Options ·
Decision · Consequences · Revisit when.
