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
| SR-07 | `/api/passages/:id`, `/api/passages/:id/related`, `/api/episodes` | Path/SQL injection; bulk transcript extraction | id regex `^[A-Za-z0-9_-]{1,80}$`; zod-validated query (`q` ≤ 100 chars, `LIKE` wildcards escaped); prepared statements; one passage + a few lines, ≤ 3 related passages, or episode metadata only (30 per page); one shared rate-limit bucket | route (`e2e/api.spec.ts`); store tests |
| SR-08 | FTS5 query from user text | FTS syntax injection / errors | `toFtsQuery` quotes every term, drops operators | `store.test.ts` (`neutralises FTS5 syntax`) |
| SR-09 | `/api/transcribe` | Large or non-audio uploads | ≤ 8 MB; audio MIME allow-list; never stored | route |
| SR-10 | Microphone | Listening without consent | Mic opened only on press/toggle; released on stop; Permissions-Policy `microphone=(self)` | e2e (voice), `next.config.ts` |
| SR-11 | TTS | Audio playing unbidden; a voice that imitates a real person | Speech only after a spoken question, a Listen click, or — with "always speak" opted in — a typed or clicked question in a visit that already has user activation; the speech route accepts only `STOCK_VOICES`, never a custom or cloned voice id | e2e (`typed questions are never read aloud`, voice settings); `schema/ask.test.ts` |
| SR-12 | YouTube links | Link injection via a malformed video id | 11-char id allow-list; otherwise no link | `links.test.ts` |
| SR-13 | Ingest CLI | Unbounded spend | Paid stages need `--budget`; stop before exceeding; dry-run for embeddings | `transcribe.ts`, `index.ts` |
| SR-14 | Repository | Committed secrets or podcast data | `.gitignore` (`.env*`, `data/`); gitleaks in CI | CI `gitleaks` |
| SR-15 | Response headers | Clickjacking, MIME sniffing, injected frames or plugins | `X-Frame-Options: DENY`, `nosniff`, strict referrer; CSP `frame-src` youtube-nocookie only, `media-src 'self' https:`, `object-src 'none'`, `base-uri`/`form-action 'self'`, `frame-ancestors 'none'`. `script-src` not yet restricted (needs per-request nonces for Next's inline scripts) | `next.config.ts`; `e2e/api.spec.ts` |
| SR-17 | Conversation memory (IndexedDB) | Personal questions kept on a shared device without consent; a tampered store injecting links or markup | Off by default and nothing written while off (not even an empty database); written only after an explicit switch; Forget / switch-off deletes the database at once; where it is kept is said next to the switch and in "How this works"; on restore, answers are re-validated (`FinalAnswerSchema`) and links rebuilt from ids (`linksAt`) | `e2e/memory.spec.ts`; `memory.test.ts`; `links.test.ts` |
| SR-16 | In-drawer player and podcast audio | The user's IP and referrer reach Google and the audio host (and any tracking redirect in the enclosure URL) without consent; mixed or odd-scheme media | Nothing requested before a click; privacy-enhanced youtube-nocookie embed; enclosures used only when https; disclosed in "How this works" | `e2e/media.spec.ts` (request log); `links.test.ts`; `citations.test.ts` |

## Out of scope

Multi-tenant isolation (there are no tenants), authentication (none — see `docs/DEPLOY.md` on
private deployment), DoS beyond per-client rate limits.
