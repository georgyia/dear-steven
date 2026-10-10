# Threat model

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| reviewed | ai | 2026-10-10 | every `risk:*` issue |

Dear Steven is a single-operator app with no accounts. The assets worth protecting are the
operator's **OpenAI budget**, the **integrity of attribution** (the product must not put words in
anyone's mouth), the **operator's keys**, and the **user's voice and questions**.

## Entry points and requirements

| Id | Entry point | Threat | Requirement | Proven by |
|----|-------------|--------|-------------|-----------|
| SR-01 | `POST /api/ask` | Oversized / malformed bodies, prompt stuffing | zod strict schema; ≤ 64 KB body; ≤ 2,000-char question; ≤ 11 history turns | `AskRequestSchema` (core), route |
| SR-02 | `POST /api/ask`, `/api/transcribe`, `/api/speech` | Budget drain by scripted requests | Per-client token buckets on every paid route (live mode); demo is free and unlimited | `server/rate-limit.ts`; e2e (demo unlimited) |
| SR-03 | Transcript text in the prompt | Prompt injection via a passage ("ignore previous instructions…") | Sources wrapped and marked untrusted; `<`/`>` neutralised so text can't close tags; validator independent of model obedience | `answer/context.ts`; validator tests |
| SR-04 | Model output | Fabricated citations, quotes, guests, conversations, host claims | Nothing streamed before `validateBlock`; ids must be retrieved; quotes re-derived from storage; downgrade after one repair | `validate.test.ts`, `compose.test.ts`, `quotes.test.ts` |
| SR-05 | Server logs / error events | Leaking keys or provider messages (which can echo masked keys) | `describeFailure` maps errors to fixed messages; logs only status codes | `server/errors.test.ts` |
| SR-06 | Client bundle | Keys or server modules shipped to the browser | `readConfig` server-only; dependency-cruiser forbids client → server core; `server-only` guards | `pnpm arch` |
| SR-07 | `/api/passages/:id` | Path/SQL injection; bulk transcript extraction | id regex `^[A-Za-z0-9_-]{1,80}$`; prepared statements; returns one passage + a few lines; rate-limited | route; store tests |
| SR-08 | FTS5 query from user text | FTS syntax injection / errors | `toFtsQuery` quotes every term, drops operators | `store.test.ts` (`neutralises FTS5 syntax`) |
| SR-09 | `/api/transcribe` | Large or non-audio uploads | ≤ 8 MB; audio MIME allow-list; never stored | route |
| SR-10 | Microphone | Listening without consent | Mic opened only on press/toggle; released on stop; Permissions-Policy `microphone=(self)` | e2e (voice), `next.config.ts` |
| SR-11 | TTS | Audio playing unbidden | Speech only after a spoken question or a Listen click | e2e (`typed questions are never read aloud`) |
| SR-12 | YouTube links | Link injection via a malformed video id | 11-char id allow-list; otherwise no link | `links.test.ts` |
| SR-13 | Ingest CLI | Unbounded spend | Paid stages need `--budget`; stop before exceeding; dry-run for embeddings | `transcribe.ts`, `index.ts` |
| SR-14 | Repository | Committed secrets or podcast data | `.gitignore` (`.env*`, `data/`); gitleaks in CI | CI `gitleaks` |
| SR-15 | Response headers | Clickjacking, MIME sniffing | `X-Frame-Options: DENY`, `nosniff`, strict referrer | `next.config.ts` |

## Out of scope

Multi-tenant isolation (there are no tenants), authentication (none — see `docs/DEPLOY.md` on
private deployment), DoS beyond per-client rate limits.
