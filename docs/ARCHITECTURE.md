# ARCHITECTURE.md — module boundaries

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | every issue |

Binding for agents. The reasoning behind each choice is in `plan/12-adr/`; the original design is
`plan/01-architecture.md`.

## 1. Layout

```
apps/web/                     Next.js 16 app — thin server shell + one client "stage"
  src/app/                    layout, page (server), api/{ask,interview,passages/[id],status,transcribe,speech}
  src/server/                 server-only: store/model handles, SSE, rate limits, demo stream, errors
  src/components/             stage/ composer/ answer/ interview/ evidence/ voice/ ui/ vendor/react-bits/
  src/lib/                    stage-machine, conversation reducer, SSE parser, api client, voice/*
  src/styles/                 tokens.css (design tokens), globals.css (Tailwind v4 theme)
  src/brand.ts                the product, host and show names
  src/i18n/                   message catalogues (en, de), I18nProvider, useI18n
  e2e/                        Playwright specs
packages/core/                framework-free domain — every decision lives here
  src/schema/                 zod schemas: answer (model + resolved), ask events, episode, passage
  src/store/                  SQLite: migrations, KnowledgeStore, FTS query builder
  src/retrieval/              hybrid search: FTS5 BM25 + vec0 KNN → RRF → per-episode cap
  src/answer/                 context, prompt, model adapter, stream parser, validate, quotes,
                              resolve (citations), condense, compose (the pipeline)
  src/persona/                persona instructions + lint; thinking copy; talk style
  src/interview/              interview mode: the arc, the interviewer prompt, question checks,
                              "what I learned" with its evidence located in the visitor's words
  src/ingest/                 pure ingest logic: VTT parser, cue→segment, chunker, guest names
  src/openai/                 client factory, embedder, transcription + speech
  src/youtube/, src/format/   deep links; timestamp/date formatting
  src/config/                 env (server config), models (every model id + price)
packages/ingest/              CLI: commands/* and sources/{rss,youtube-*,openai-*}
eval/                         questions.json + run.ts (recall, citation, attribution, persona)
data/                         (gitignored) dear-steven.db, cache/, voiceprints/, answers.jsonl,
                              spend.json, share-secret
docs/                         what exists today          plan/  what we build next
```

## 2. Hard boundaries

| From | Must not import | Enforced by |
|------|-----------------|-------------|
| `packages/core` | `next`, `react`, `react-dom`, `motion`, `apps/*`, `packages/ingest` | `pnpm arch` |
| `packages/ingest` | `apps/*` | `pnpm arch` |
| `apps/web/src/components/**` (client) | core `store`, `retrieval`, `answer`, `ingest`, `openai`, `config` | `pnpm arch` |
| any module | itself, circularly | `pnpm arch` |
| client bundle | zod (use `@dear-steven/core/limits`, `/copy`, `/format`, `/youtube`, types) | review |

Client-safe core entry points: `schema` (types only), `limits`, `copy`, `format`, `youtube`.

## 3. Where each decision is made

| Decision | Single locus |
|----------|--------------|
| Which passages answer a question | `packages/core/src/retrieval/hybrid.ts` |
| What the model is told (persona, rules, sources) | `persona/persona.ts`, `answer/prompt.ts`, `answer/context.ts` |
| Whether a block may be shown | `answer/validate.ts` (`validateBlock`, `downgradeBlock`) |
| Whether a quote is real, and its exact text | `answer/quotes.ts` (`locateQuote`) |
| Who a citation's speaker is | `answer/resolve.ts` (`CitationRegistry`) + `answer/citations.ts` (`speakerOf`) |
| The answer's final mode | `answer/resolve.ts` (`finalMode`) |
| The next interview question, and what was learned | `interview/interview.ts` (`interviewStep`, `questionProblems`, `checkLearned`), `interview/arc.ts` |
| The YouTube link and its timing state | `youtube/links.ts` (`resolveMoment`) |
| How transcripts become passages | `ingest/chunk.ts` |
| Which voice path a browser gets | `apps/web/src/lib/voice/capabilities.ts` (UI concern, pure) |
| What the stage shows when | `apps/web/src/lib/stage-machine.ts` |

## 4. Data flow — one question

1. The client `POST /api/ask {question, history, mode?}` (≤ 2,000 chars; ≤ 11 earlier turns;
   `mode` is `ask` or `talk`, P7-05: talk adds a style note to the model input, nothing else;
   `about`, P7-08: what the visitor kept about themselves, ≤ 600 chars, for relevance only).
2. The route validates with zod, rate-limits (live only), and calls `composeAnswer`. The
   response is `text/event-stream`.
3. `composeAnswer`: empty knowledge base → in-persona "nothing loaded" reply, no model call.
   Otherwise: condense a follow-up into a standalone query → `hybridSearch` (top 12, ≤ 3 per
   episode) → build context (short ids p1…p12, segments, verified speakers).
4. The model streams strict JSON (`ModelAnswerSchema`). `BlockStream` reports each block as it
   completes; `validateBlock` checks it; a clean block is resolved (citation ids c1, c2…, stored
   quote spans) and sent as `block.done`. After the first failing block, later blocks are held so
   order never changes.
5. At the end: failing blocks get **one** repair call; anything still failing is downgraded
   deterministically (speaker claims → episode-level, uncited → synthesis, fabricated
   conversations removed, unmatched quotes dropped) with a caveat. `final` carries the
   authoritative blocks, citations (with relevance notes), episodes, spoken summary, caveats, mode.
6. The client reducer (`lib/conversation.ts`) places blocks by index; the stage machine drives
   visuals. Chips open the drawer, which fetches `/api/passages/:id` for context.

SSE events: `status` · `sources` · `block.start` · `block.done` · `final` · `error`
(`packages/core/src/schema/ask.ts`). The plan's `block.delta` became `block.start`: no partial,
unvalidated text is ever streamed.

Outside the question flow, the episode explorer ("Browse the N conversations" in the setup panel)
reads `GET /api/episodes?q=&offset=`: metadata only (title, guests, date, passage count, speaker
and video states), 30 per page, searched by title or guest (`KnowledgeStore.browseIndexed`). The inspector's "Related moments"
reads `GET /api/passages/:id/related`: up to three passages from other episodes nearest the cited
one by its stored embedding (`buildRelatedMoments`, no model call; empty until embeddings exist).

## 4a. Data flow — an interview (P7-06)

The client keeps the interview and `POST`s it whole to `/api/interview` at every step
(`InterviewRequestSchema`: setup, ≤ 10 turns, `next` or `finish`; ≤ 48 KB). The route validates,
answers from fixtures in demo mode, rate-limits live steps (`interview` bucket), respects the daily
cap, and calls `interviewStep`: the safety rails on the latest answer, then one model call for
the next question (checked; retried once; else a fixed question) or for what was learned (each
line's evidence located in the visitor's own words). JSON in, JSON out; nothing is stored.

## 5. Trust boundaries

| Boundary | Rule |
|----------|------|
| Browser → server | Every body validated with zod; size caps; per-IP token buckets (live answers, transcribe, speech, passages + episode list, key checks). A visitor's own OpenAI key (P6-03) comes only in the `x-openai-key` header, over HTTPS, checked against `VisitorKeySchema`; every route builds its configuration from the request (`server/request-config.ts`). |
| Server → OpenAI | The operator's key only in server memory (`readConfig`); a visitor's key only for their own request — never cached, logged or stored, and not counted against the operator's cap; provider error text never logged or shown (`server/errors.ts`). |
| Browser storage → page | Untrusted on read: stored answers are re-validated, links rebuilt from ids, unknown fields dropped. |
| Share link → page | A share token (P6-17) opens only through `POST /api/share`, and only if this deployment signed it (`server/share.ts`, HMAC under `data/share-secret`); the answer inside is then re-validated and re-linked like a stored one, and (unless it is a demo fixture) must still be sourced in the knowledge base as it is now (`stillSourced`). A link can't say anything this copy didn't write, nor outlive a takedown. |
| Transcript text → model | Untrusted data: wrapped in `<sources>`, `<`/`>` neutralised, instructions say to ignore commands inside. |
| Model → browser | Nothing passes without `validateBlock`; citation ids must be retrieved ids; quotes are re-derived from storage. |
| Browser → YouTube / podcast host | Only after the user presses play: the youtube-nocookie player and the https RSS enclosure. CSP `frame-src` / `media-src` fence everything else. |
| CLI → network | Polite UA, timeouts, retries with backoff; RSS + VTT + YouTube Data API + OpenAI only. Paid stages require `--budget`. |
| Setup panel → this machine | Guided local setup (P6-04) exists only on a server `pnpm dev:setup` started: bound to 127.0.0.1, with a one-time token from the terminal. `/api/setup*` answer 404 unless the Host is loopback, Origin and Fetch Metadata (when sent) say same-origin, every forwarding hop is loopback and the token matches (`server/setup.ts`). Keys go to the env file atomically (owner-only) and are never sent back; the stages run as the ingest CLI itself (`process.execPath packages/ingest/src/cli.ts …`), one at a time, so the web app decides nothing about ingestion. Embedding runs only under a budget its estimate fits, which the CLI enforces again (`index --budget`); paid diarization stays in the terminal. |

## 6. Storage

### Server: SQLite, `data/dear-steven.db`

Tables: `episodes`, `segments` (speaker truth), `passages` (+ `passages_fts` FTS5 external
content, `passages_vec` vec0 cosine, both maintained by triggers), `ingestion_runs`, `kb_meta`.
Migrations are numbered SQL in `store/migrations.ts`, tracked by `PRAGMA user_version`. Purging an
episode cascades to segments, passages, FTS rows, vectors and runs (tested).

Beside it: `spend.json` (today's estimated spend) and `share-secret` (the key share links are
signed with, created on first use, owner-only).

### Browser (opt-in only)

- Voice settings: `localStorage` (`lib/voice/preferences.ts`), defaults when storage is blocked.
- Conversation memory (P5-11): IndexedDB `dear-steven-memory`, written only after the user
  switches "Remember this conversation" on; finished turns only (question + validated final
  answer). Looking for a memory never creates the database; Forget or switching off deletes it.
  On restore the data is untrusted: answers are re-validated against `FinalAnswerSchema` and
  every link is rebuilt from ids by `linksAt` (`lib/memory.ts`).

## 7. Fail modes

| Failure | Behaviour |
|---------|-----------|
| No `OPENAI_API_KEY` | Demo mode: labelled fixtures; voice uses the browser only. |
| No database file | Status "no conversations indexed yet"; ask returns the in-persona empty reply. |
| Database unreadable | Status pill "Knowledge base unavailable", setup panel shows the error. |
| No embeddings yet | Keyword-only search; status "embeddings pending". |
| OpenAI 401 / 429 / 5xx | `error` event with an actionable message; nothing unvalidated shown. |
| Model output malformed | `error` event; blocks already shown were validated. |
| Repair call fails | Deterministic downgrade still applies. |
| Mic denied / unsupported | Explained in a toast; typing unaffected; retry works. |
| Web Speech network error | Switches to server transcription when available. |
| Server TTS fails | Falls back to `speechSynthesis`. |
| Browser storage blocked | Voice settings apply for the visit; the settings say they won't be kept. |
| On-device recognition missing | The switch is disabled; it is never probed outside Google Chrome. |
