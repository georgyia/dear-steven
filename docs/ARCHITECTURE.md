# ARCHITECTURE.md — module boundaries

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | every issue |

Binding for agents. The reasoning behind each choice is in `plan/12-adr/`; the original design is
`plan/01-architecture.md`.

## 1. Layout

```
apps/web/                     Next.js 16 app — thin server shell + one client "stage"
  src/app/                    layout, page (server), terms, legal, api/{ask,interview,passages/[id],status,health,transcribe,speech}
                              not-found, error, global-error: the 404 and crash pages (P10-09)
                              icon.svg, apple-icon, mark: the icon; layout: the link preview (P10-10)
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
  src/summary/                conversation summaries: the prompt, every quote located in its
                              passage, checks on the machine-written overview
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

Client-safe core entry points: `schema` (types only), `limits`, `copy`, `format`, `youtube`,
`speech` (what is said aloud for a block, P9-01) and `language`.

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
| What a conversation's summary may say, and the exact words it quotes | `summary/summary.ts` (`checkSummary`, `writtenProblems`) |
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
7. Spoken replies (P9-01). In Talk, each `block.done` is read aloud as it arrives: its own text
   (`speakable`, `@dear-steven/core/speech`), never the model's separate `spoken` field, which
   only Ask still reads, at the end. `/api/speech` streams 24 kHz PCM as OpenAI synthesises it;
   the browser plays it as it arrives on the Web Audio clock and fetches the next part while one
   plays (`lib/voice/speech-queue.ts`, `speaker.ts`).
8. Talk out loud (P9-02): `useSpokenConversation` takes turns. On your turn `listenForTurn`
   opens the mic: with speech recognition, its words drive the pause; without it, a level gate
   on the recording does (`turn-taking.ts`: `turnVerdict`, `LevelGate`), the recording restarts
   every 4 s of quiet, and nothing is uploaded unless you spoke. Your words go to `/api/ask` as
   any question does; when the reply has been read (`whenQuiet`), it's your turn again. The mic is
   closed on his turn, when paused and when off (`spoken-conversation.ts`, SR-10). The interview
   (P9-03) runs the same loop with a longer pause: each answer is one interview step, the next
   question is read aloud, and Skip, End and Retry are his turn (`act`). It ends with the
   interview.

SSE events: `status` · `sources` · `block.start` · `block.done` · `final` · `error`
(`packages/core/src/schema/ask.ts`). The plan's `block.delta` became `block.start`: no partial,
unvalidated text is ever streamed.

Outside the question flow, the episode explorer ("Browse the N conversations" in the setup panel)
reads `GET /api/episodes?q=&offset=`: metadata only (title, guests, date, passage count, speaker
and video states), 30 per page, searched by title or guest (`KnowledgeStore.browseIndexed`). Each
conversation's summary (P8-04) comes from `GET /api/episodes/:id/summary`: the stored summary
(P8-03) with a citation for every item, built by `summaryView` in core; a moment opens the
evidence drawer like an answer's citation, and closing it returns to the summary. The inspector's "Related moments"
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
| Browser → server | Only this site's own pages: anything but a read that comes from another site's page (Fetch Metadata, or an `Origin` that isn't this host) is refused in `src/proxy.ts` before any route runs (`server/cross-site.ts`, P8-08). Every body validated with zod, read only up to its size cap in bytes (`server/body.ts`, P10-04); per-client token buckets (live answers, transcribe, speech, passages + episode list, key checks), keyed by the address the deployment can trust (`server/client-address.ts`, P8-01). A visitor's own OpenAI key (P6-03) comes only in the `x-openai-key` header, over HTTPS, checked against `VisitorKeySchema`; every route builds its configuration from the request (`server/request-config.ts`). In the browser it is kept sealed (`lib/visitor-key.ts`). On the operator's key with `DEAR_STEVEN_FREE_QUESTIONS` set, ask and interview count each visitor's free questions first (`server/free-questions.ts`, P8-02). |
| Server → OpenAI | The operator's key only in server memory (`readConfig`); a visitor's key only for their own request — never cached, logged or stored, and not counted against the operator's cap; provider error text never logged or shown (`server/errors.ts`). |
| Browser storage → page | Untrusted on read: stored answers are re-validated, links rebuilt from ids, unknown fields dropped. |
| Share link → page | A share token (P6-17) opens only through `POST /api/share`, and only if this deployment signed it (`server/share.ts`, HMAC under `data/share-secret`); the answer inside is then re-validated and re-linked like a stored one, and (unless it is a demo fixture) must still be sourced in the knowledge base as it is now (`stillSourced`). A link can't say anything this copy didn't write, nor outlive a takedown. |
| Transcript text → model | Untrusted data: wrapped in `<sources>`, `<`/`>` neutralised, instructions say to ignore commands inside. |
| Model → browser | Nothing passes without `validateBlock`; citation ids must be retrieved ids; quotes are re-derived from storage. |
| Browser → YouTube / podcast host | Only after the user presses play: the youtube-nocookie player and the https RSS enclosure, which passes through the publisher's ad-measurement redirects on its way to the host (said in the privacy notice, `content/policies.ts`). CSP `frame-src` / `media-src` fence everything else. |
| CLI → network | Polite UA, timeouts, retries with backoff; RSS + VTT + YouTube Data API + OpenAI only. Paid stages require `--budget`. |
| Setup panel → this machine | Guided local setup (P6-04) exists only on a server `pnpm dev:setup` started: bound to 127.0.0.1, with a one-time token from the terminal. `/api/setup*` answer 404 unless the Host is loopback, Origin and Fetch Metadata (when sent) say same-origin, every forwarding hop is loopback and the token matches (`server/setup.ts`). Keys go to the env file atomically (owner-only) and are never sent back; the stages run as the ingest CLI itself (`process.execPath packages/ingest/src/cli.ts …`), one at a time, so the web app decides nothing about ingestion. Embedding runs only under a budget its estimate fits, which the CLI enforces again (`index --budget`); paid diarization stays in the terminal. |

## 6. Storage

### Server: SQLite, `data/dear-steven.db`

Tables: `episodes`, `segments` (speaker truth), `passages` (+ `passages_fts` FTS5 external
content, `passages_vec` vec0 cosine, both maintained by triggers), `ingestion_runs`, `kb_meta`,
`episode_summaries` (one `ConversationSummary` an episode, as JSON, validated on the way in and
out; dropped when the episode's passages are rebuilt). Migrations are numbered SQL in
`store/migrations.ts`, tracked by `PRAGMA user_version`. Purging an episode cascades to segments,
passages, FTS rows, vectors, summaries and runs (tested).

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
| Production server, operator's key, no `DEAR_STEVEN_DAILY_BUDGET_USD` | The key is held back (`operatorKeyHeldBack` in core config, P10-01): demo mode with reason `no_daily_cap`, said once in the log; a visitor's own key still runs live. |
| No database file | Status "no conversations indexed yet"; ask returns the in-persona empty reply. |
| Database unreadable | Status pill "Knowledge base unavailable", setup panel shows the error. |
| No embeddings yet | Keyword-only search; status "embeddings pending". |
| OpenAI 401 / 429 / 5xx | `error` event with an actionable message for whoever owns the key: a visitor's own key is theirs to fix; on the operator's, the visitor reads what happened and the server log says what to fix (P10-08). Nothing unvalidated shown. |
| Moderation fails, and fails again (P10-06) | Not answered: an `upstream` error saying the safety check couldn't run (an interview step: `502`), no answer model call, one log line `moderation unavailable`. A phrase-rule match still gets its fixed reply. With no moderator at all (demo), the phrase rules decide alone. A refused or held-back key (401, 403, 429) is not asked again and fails as the answer call would, worded for whoever owns the key (P10-13). |
| Model output malformed | `error` event; blocks already shown were validated. |
| Repair call fails | Deterministic downgrade still applies. |
| Mic denied / unsupported | Explained in a toast; typing unaffected; retry works. A spoken conversation ends. |
| Spoken conversation: a reply fails, or listening fails | The conversation pauses with the message, mic off; Keep talking carries on. Out of free questions it ends, with Use your own key. |
| Web Speech network error | Switches to server transcription when available. |
| Server TTS fails | Falls back to `speechSynthesis`, part by part: one refused part is read by the browser, in its place. |
| Browser storage blocked | Voice settings apply for the visit; the settings say they won't be kept. |
| On-device recognition missing | The switch is disabled; it is never probed outside Google Chrome. |
