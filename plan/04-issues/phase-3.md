# Phase 3 — Grounded first-person answers (M1 exit)

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | milestone M1 |

**Exit:** on the eval set, 100% of rendered citations resolve; 0 speaker-attribution violations
after validation; quotes byte-match stored spans; persona lint passes; unanswerable →
`insufficient` without citations; p50 time-to-first-block < 3 s. Code complete and verified with
scripted models; the live verification is P3-08.

---

### P3-01 — docs(core): persona specification and its code twin

<!-- issue {"id":"P3-01","title":"docs(core): persona specification and its code twin","labels":["type:docs","stage:m1","track:core","owner:ai","risk:medium","P0","size:S"],"milestone":"M1 Answers","depends":[],"github":null} -->

**Result:** `docs/PERSONA.md`; `persona/persona.ts` (`PERSONA_INSTRUCTIONS`, `PERSONA_VERSION`,
`PERSONA_LINT`), `persona/copy.ts` (thinking copy, empty-KB reply). **State:** done.

---

### P3-02 — feat(core): answer schema, prompt, model adapter and streaming block parser

<!-- issue {"id":"P3-02","title":"feat(core): answer schema, prompt, model adapter and streaming block parser","labels":["type:core","stage:m1","track:core","owner:ai","risk:medium","P0","size:M"],"milestone":"M1 Answers","depends":["P3-01"],"github":null} -->

**Result:** `schema/answer.ts` (model + resolved schemas), `answer/{context,prompt,model,stream}.ts`
(sources rendered with short ids and verified speaker labels; strict JSON via `zodTextFormat`;
`AnswerModel` + OpenAI Responses implementation with `prompt_cache_key`; `BlockStream` releases
blocks as they complete — tested at chunk sizes 1, 7, 64). **State:** done.

---

### P3-03 — feat(core): deterministic citation validator, quote matcher, repair and downgrade

<!-- issue {"id":"P3-03","title":"feat(core): deterministic citation validator, quote matcher, repair and downgrade","labels":["type:core","stage:m1","track:core","owner:ai","risk:high","needs:human-review","P0","size:L"],"milestone":"M1 Answers","depends":["P3-02"],"github":null} -->

**Result:** `answer/{validate,quotes,resolve,citations}.ts`. Rules: unknown ids dropped; sourced
claims need a citation; `guest`/`host` need verified segments; synthesis carries no citations;
KB-known guests not in the sources and conversations not in the sources are flagged; a named
conversation must match the cited episode; quotes located exactly or ≥ 85% LCS and shown from
storage. One repair pass; deterministic downgrade with caveats; `finalMode`. 13 validator tests,
6 quote tests. **Risk:** high — this is the integrity of who said what (SR-04). **State:** done.

---

### P3-04 — feat(core): compose pipeline — retrieve, stream, validate, repair, final

<!-- issue {"id":"P3-04","title":"feat(core): compose pipeline — retrieve, stream, validate, repair, final","labels":["type:core","stage:m1","track:core","owner:ai","risk:high","needs:human-review","P0","size:M"],"milestone":"M1 Answers","depends":["P3-03","P2-03"],"github":null} -->

**Result:** `answer/{compose,condense}.ts`; held blocks keep order; stable citation ids from first
block to final; empty KB short-circuits without a model call; malformed output → error with
nothing unchecked shown. 10 pipeline tests with a scripted model. **State:** done.

---

### P3-05 — feat(web): live /api/ask over SSE with real passages in the UI

<!-- issue {"id":"P3-05","title":"feat(web): live /api/ask over SSE with real passages in the UI","labels":["type:service","stage:m1","track:web","owner:ai","risk:high","needs:human-review","P0","size:M"],"milestone":"M1 Answers","depends":["P3-04","P2-07"],"github":null} -->

**Result:** `/api/ask` (zod, 64 KB cap, rate limit, demo / empty / live branches), `server/sse.ts`
(abort propagates to the model), `server/errors.ts` (no provider text in logs or responses),
drawer context with verified speaker turns, YouTube deep links with `≈` / unknown states.
Verified live up to the model call with an invalid key: real status, 12 passages from 8 episodes,
and a clear "key rejected" message. **State:** done.

---

### P3-06 — feat(web): rate limits and input validation on every paid route

<!-- issue {"id":"P3-06","title":"feat(web): rate limits and input validation on every paid route","labels":["type:security","stage:m1","track:security","owner:ai","risk:high","needs:human-review","P0","size:S"],"milestone":"M1 Answers","depends":["P3-05"],"github":null} -->

**Result:** `server/rate-limit.ts` token buckets (ask 8 / 6 per min, transcribe and speech 10 / 10,
passages 120 / 120); demo is unlimited (it costs nothing). SR-01, SR-02, SR-07, SR-09.
**State:** done.

---

### P3-07 — test(eval): answer metrics — citations, quotes, attribution, persona, latency

<!-- issue {"id":"P3-07","title":"test(eval): answer metrics — citations, quotes, attribution, persona, latency","labels":["type:test","stage:m1","track:eval","owner:ai","risk:low","P0","size:S"],"milestone":"M1 Answers","depends":["P3-04","P2-05"],"github":null} -->

**Result:** `pnpm eval --answers` with thresholds and `checkAnswer` (citations resolve, quotes
byte-match, attribution backed by verified segments, persona lint, unanswerable handled, TTFB
p50). **State:** done; first run is P3-08.

---

### P3-08 — test(eval): first live evaluation against the real model

<!-- issue {"id":"P3-08","title":"test(eval): first live evaluation against the real model","labels":["type:test","stage:m1","track:eval","needs:human","risk:medium","P0","size:S"],"milestone":"M1 Answers","depends":["P3-07"],"github":27} -->

#### Context
Every part of the answer pipeline is verified with scripted models. Nobody has yet seen
`gpt-6-luna` answer through it.

#### Goal
M1 exit criterion 4 met with the real model, and a human judgement of usefulness on five answers.

#### Scope
**In** — run `pnpm eval --answers` after `pnpm ingest index`; fix whatever fails (prompt wording,
schema descriptions, retrieval breadth) in follow-up PRs, each re-running the eval.
**Out** — new features.

#### Acceptance criteria
- [ ] `pnpm eval --answers` exits 0: citations resolve 100%, 0 attribution violations, 0 quote
      mismatches, persona lint clean, 3/3 unanswerable handled, first-block p50 < 3 s.
- [ ] H-07 usefulness notes posted on this issue.
- [ ] Any model-id change recorded in `packages/core/src/config/models.ts` and ADR-003.

#### Tests required
The eval run itself; `pnpm check` for any fix.

#### Security notes
Costs a few cents; uses the operator's key from `.env` only.

#### Skills to consult
`dear-steven-persona`.

#### Human steps
H-03, H-07.

#### Dependencies
P3-07. **Size:** S. **State:** open, needs a human.
