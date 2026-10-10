# ARCHITECTURE.md — module boundaries

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | every issue |

Binding for agents. The reasoning behind each choice is in `plan/12-adr/`; the original design is
`plan/01-architecture.md`.

## 1. Layout

```
apps/web/                     Next.js 16 app — thin server shell + one client "stage"
  src/app/                    layout, page (server), api/{ask,passages/[id],status,transcribe,speech}
  src/server/                 server-only: store/model handles, SSE, rate limits, demo stream, errors
  src/components/             stage/ composer/ answer/ evidence/ voice/ ui/ vendor/react-bits/
  src/lib/                    stage-machine, conversation reducer, SSE parser, api client, voice/*
  src/styles/                 tokens.css (design tokens), globals.css (Tailwind v4 theme)
  src/brand.ts                every name and line of product copy
  e2e/                        Playwright specs
packages/core/                framework-free domain — every decision lives here
  src/schema/                 zod schemas: answer (model + resolved), ask events, episode, passage
  src/store/                  SQLite: migrations, KnowledgeStore, FTS query builder
  src/retrieval/              hybrid search: FTS5 BM25 + vec0 KNN → RRF → per-episode cap
  src/answer/                 context, prompt, model adapter, stream parser, validate, quotes,
                              resolve (citations), condense, compose (the pipeline)
  src/persona/                persona instructions + lint; thinking copy
  src/ingest/                 pure ingest logic: VTT parser, cue→segment, chunker, guest names
  src/openai/                 client factory, embedder, transcription + speech
  src/youtube/, src/format/   deep links; timestamp/date formatting
  src/config/                 env (server config), models (every model id + price)
packages/ingest/              CLI: commands/* and sources/{rss,youtube-*,openai-*}
eval/                         questions.json + run.ts (recall, citation, attribution, persona)
data/                         (gitignored) dear-steven.db, cache/, voiceprints/, answers.jsonl
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
| The YouTube link and its timing state | `youtube/links.ts` (`resolveMoment`) |
| How transcripts become passages | `ingest/chunk.ts` |
| Which voice path a browser gets | `apps/web/src/lib/voice/capabilities.ts` (UI concern, pure) |
| What the stage shows when | `apps/web/src/lib/stage-machine.ts` |

## 4. Data flow — one question

1. The client `POST /api/ask {question, history}` (≤ 2,000 chars; ≤ 11 earlier turns).
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

## 5. Trust boundaries

| Boundary | Rule |
|----------|------|
| Browser → server | Every body validated with zod; size caps; per-IP token buckets (live answers, transcribe, speech, passages). |
| Server → OpenAI | Key only in server memory (`readConfig`); provider error text never logged or shown (`server/errors.ts`). |
| Transcript text → model | Untrusted data: wrapped in `<sources>`, `<`/`>` neutralised, instructions say to ignore commands inside. |
| Model → browser | Nothing passes without `validateBlock`; citation ids must be retrieved ids; quotes are re-derived from storage. |
| CLI → network | Polite UA, timeouts, retries with backoff; RSS + VTT + YouTube Data API + OpenAI only. Paid stages require `--budget`. |

## 6. Storage (SQLite, `data/dear-steven.db`)

Tables: `episodes`, `segments` (speaker truth), `passages` (+ `passages_fts` FTS5 external
content, `passages_vec` vec0 cosine, both maintained by triggers), `ingestion_runs`, `kb_meta`.
Migrations are numbered SQL in `store/migrations.ts`, tracked by `PRAGMA user_version`. Purging an
episode cascades to segments, passages, FTS rows, vectors and runs (tested).

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
