# Phase 2 — Knowledge core and ingestion (M1 part 2)

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | milestone M1 |

**Exit:** 20 starter episodes indexed in one command; recall@10 ≥ 0.8 on a 20-question seed set;
chunker / RRF / VTT unit-tested; purge removes an episode completely.

**Verified 2026-10-10:** `pnpm ingest all --limit 20` → 739 episodes discovered, 20 RSS
transcripts, 1,621 passages in ~10 s; `pnpm eval` recall@10 = 100% (20/20, keyword-only).

---

### P2-01 — feat(core): SQLite knowledge store — schema, migrations, FTS5, vec0, KnowledgeStore

<!-- issue {"id":"P2-01","title":"feat(core): SQLite knowledge store — schema, migrations, FTS5, vec0, KnowledgeStore","labels":["type:core","stage:m1","track:core","owner:ai","risk:medium","P0","size:L"],"milestone":"M1 Knowledge","depends":["P0-02"],"github":null} -->

**Result:** `store/{migrations,sqlite,store,fts}.ts` (ADR-002). Tests: idempotent upserts that
keep manual guest names, lookup by id / guid / title, refusal to create the DB from the web,
keyword search, cosine KNN, re-transcribing drops passages and vectors, purge cascades everywhere,
run history and spend, FTS syntax neutralised. **State:** done.

---

### P2-02 — feat(core): VTT parser, cue segments, guest names and turn-aware chunker

<!-- issue {"id":"P2-02","title":"feat(core): VTT parser, cue segments, guest names and turn-aware chunker","labels":["type:core","stage:m1","track:ingest","owner:ai","risk:low","P0","size:M"],"milestone":"M1 Knowledge","depends":["P0-02"],"github":null} -->

**Result:** `ingest/{vtt,segments,guests,chunk}.ts`. Guest-name heuristics measured on all 739
real titles (413 named, spot-checked for false positives). Chunker measured on a real 1,599-cue
transcript: 60 passages, 175–453 tokens, avg 423. **State:** done.

---

### P2-03 — feat(core): hybrid retrieval — BM25 + KNN, reciprocal rank fusion, per-episode cap

<!-- issue {"id":"P2-03","title":"feat(core): hybrid retrieval — BM25 + KNN, reciprocal rank fusion, per-episode cap","labels":["type:core","stage:m1","track:core","owner:ai","risk:low","P0","size:S"],"milestone":"M1 Knowledge","depends":["P2-01"],"github":null} -->

**Result:** `retrieval/{rrf,hybrid}.ts`; keyword-only when no embeddings; 80 candidates per list
(R-04). Tests with a deterministic fake embedder. **State:** done.

---

### P2-04 — feat(ingest): CLI stages — discover, transcribe, chunk, index, match-youtube, status, doctor, align, purge, all

<!-- issue {"id":"P2-04","title":"feat(ingest): CLI stages — discover, transcribe, chunk, index, match-youtube, status, doctor, align, purge, all","labels":["type:service","stage:m1","track:ingest","owner:ai","risk:high","needs:human-review","P0","size:L"],"milestone":"M1 Knowledge","depends":["P2-01","P2-02"],"github":null} -->

**Result:** `packages/ingest/src/{cli,context}.ts`, `commands/*`, `sources/{rss,youtube-api,youtube-match,openai-transcribe,openai-guests}.ts`,
`lib/{http,output,ffmpeg}.ts`. Idempotent, resumable, per-episode run rows; progress bars;
retries with backoff; `--dry-run` cost estimates; `--budget` on diarization. Unit tests for RSS
parsing, durations, YouTube matching, diarization mapping, cost.
**Risk:** high because diarization and embedding spend money — budget gates are SR-13.
**State:** done; diarized run is P2-08.

---

### P2-05 — test(eval): seed question set and retrieval recall

<!-- issue {"id":"P2-05","title":"test(eval): seed question set and retrieval recall","labels":["type:test","stage:m1","track:eval","owner:ai","risk:low","P0","size:S"],"milestone":"M1 Knowledge","depends":["P2-03"],"github":null} -->

**Result:** `eval/questions.json` (20 retrieval questions keyed to stable RSS guids + 3
unanswerable), `eval/run.ts`, `eval/lib/metrics.ts`. Recall@10 = 100% keyword-only. **State:** done.

---

### P2-06 — docs(ingest): INGESTION.md

<!-- issue {"id":"P2-06","title":"docs(ingest): INGESTION.md","labels":["type:docs","stage:m1","track:docs","owner:ai","risk:low","P1","size:S"],"milestone":"M1 Knowledge","depends":["P2-04"],"github":null} -->

**Result:** `docs/INGESTION.md`. **State:** done.

---

### P2-07 — feat(web): status and passages from the real knowledge base

<!-- issue {"id":"P2-07","title":"feat(web): status and passages from the real knowledge base","labels":["type:service","stage:m1","track:web","owner:ai","risk:medium","P0","size:S"],"milestone":"M1 Knowledge","depends":["P2-01","P1-06"],"github":null} -->

**Result:** `server/knowledge.ts` (process-wide store handle), `server/status.ts` (never throws),
`/api/passages/:id` → `buildPassageContext` (passage, neighbouring lines, verified speaker turns).
Standalone build ships the sqlite-vec binary (`outputFileTracingIncludes`), verified by running
`server.js` against the real DB. **State:** done.

---

### P2-08 — chore(ingest): first diarized run on a budget

<!-- issue {"id":"P2-08","title":"chore(ingest): first diarized run on a budget","labels":["type:human-task","stage:m1","track:ingest","needs:human","risk:high","needs:human-review","P2","size:S"],"milestone":"M1 Knowledge","depends":["P2-04"],"github":null} -->

#### Context
Without diarization every citation is episode-level. The pipeline (`transcribe --diarize`) is
built and unit-tested but has never run against OpenAI.

#### Goal
A handful of episodes with verified host and guest segments, checked with `attribute`, visible in
the app as ember and ivory chips.

#### Acceptance criteria
- [ ] ≤ the approved budget spent (recorded by `pnpm ingest status`).
- [ ] `pnpm ingest attribute` shows plausible host shares (≈ 15–45%) and no unexplained flags.
- [ ] One answer in the app shows a verified-guest chip whose passage really is the guest speaking.

#### Human steps
H-04 (host clip), H-05 (budget + run). An agent may fix anything the run reveals in a follow-up PR.

#### Dependencies
P2-04, H-03, H-04, H-05. **Size:** S. **State:** open, needs a human.
