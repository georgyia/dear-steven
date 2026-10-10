# Phase 5 — Depth and polish (M3, each item evaluated on its own)

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | milestone M3 |

**Exit:** every shipped item has an eval result or e2e test showing it helps, not just that it runs.
Take items in order unless one is blocked.

---

### P5-01 — fix(core): tune the answer prompt and retrieval against the live eval

<!-- issue {"id":"P5-01","title":"fix(core): tune the answer prompt and retrieval against the live eval","labels":["type:core","stage:m3","track:core","owner:ai","risk:medium","P1","size:M"],"milestone":"M3 Depth","depends":["P3-08"],"github":null} -->

#### Context
P3-08 produces the first real eval results and a human's usefulness notes.

#### Goal
Every failure or weak score from P3-08 traced to a cause and fixed, or recorded as a known limit.

#### Scope
**In** — persona prompt wording (`persona.ts` + `docs/PERSONA.md`, bump `PERSONA_VERSION`), schema
field descriptions, retrieval knobs (`DEFAULT_RETRIEVAL`), eval questions that turned out ambiguous.
**Out** — rerankers (P5-02), new UI.

#### Acceptance criteria
- [ ] `pnpm eval --answers` exits 0 after the changes (paste the summary line).
- [ ] Each change names the eval question(s) it fixes.
- [ ] No validator rule relaxed to make a test pass.

#### Tests required
`pnpm check`; `pnpm eval`; `pnpm eval --answers` (ask the human to run it if you have no key).

#### Security notes
Prompt changes are `risk:medium`: the validator stays authoritative (SR-04).

#### Skills to consult
`dear-steven-persona`, `dear-steven-architecture`.

#### Human steps
Re-run H-07 for the before/after comparison.

#### Dependencies
P3-08. **Size:** M.

---

### P5-02 — feat(core): cross-encoder rerank and MMR, only if the eval justifies it

<!-- issue {"id":"P5-02","title":"feat(core): cross-encoder rerank and MMR, only if the eval justifies it","labels":["type:spike","stage:m3","track:core","owner:ai","risk:medium","P2","size:M"],"milestone":"M3 Depth","depends":["P3-08"],"github":null} -->

#### Context
OpenAI has no reranker. A local MiniLM cross-encoder (`@huggingface/transformers`) or MMR over
embeddings could raise precision or diversity — or just add latency.

#### Goal
A measured answer: does reranking or MMR improve recall@10 or answer quality enough to keep?

#### Scope
**In** — a spike branch implementing rerank and MMR behind options in `hybridSearch`; eval runs
with and without. **Out** — merging unless the numbers justify it.

#### Acceptance criteria
- [ ] Results table (recall@10, answer eval totals, p50 latency) for: baseline, +MMR, +rerank.
- [ ] Recommendation recorded in a research brief `R-05`; if adopted, an ADR and a follow-up issue.

#### Tests required
Eval runs; unit tests only if merged.

#### Security notes
New dependency (model download at runtime) needs a supply-chain review if adopted.

#### Skills to consult
`dear-steven-architecture`.

#### Human steps
A key to run the answer eval.

#### Dependencies
P3-08. **Size:** M.

---

### P5-03 — feat(web): episode explorer — browse what's indexed, filter by guest

<!-- issue {"id":"P5-03","title":"feat(web): episode explorer — browse what's indexed, filter by guest","labels":["type:ui","stage:m3","track:web","owner:ai","risk:low","P2","size:M"],"milestone":"M3 Depth","depends":["P2-07"],"github":null} -->

#### Context
Users can't see which conversations Dear Steven knows. The status pill only shows a count.

#### Goal
A quiet, editorial list of indexed episodes (date, title, guests, passages, speaker state, video
link state), searchable by guest or title, opened from the status pill or the setup panel.

#### Scope
**In** — `GET /api/episodes` (paginated, ≤ 50 per page, no transcript text) via a new
`KnowledgeStore.listIndexedEpisodes`; a sheet/panel UI using AnimatedList (vendor, R-01 "later")
and GlideSelect for the guest filter; empty state copy.
**Out** — per-episode chat, episode pages, editing metadata.

#### Acceptance criteria
- [ ] Lists exactly the indexed episodes, newest first; filter by guest works.
- [ ] Demo mode lists the three fixture episodes, labelled.
- [ ] Keyboard and screen-reader usable; 375 / 1280 screenshots.

#### Tests required
Store unit test; route test; e2e (open, filter, close).

#### Security notes
Read-only; returns metadata only (SR-07).

#### Design notes
Mono metadata, Fraunces titles, no cards-in-cards. Same inspector surface as the evidence drawer.

#### Skills to consult
`dear-steven-architecture`, `docs/DESIGN.md`.

#### Human steps
None.

#### Dependencies
P2-07. **Size:** M.

---

### P5-04 — feat(web): related quotes in the evidence inspector

<!-- issue {"id":"P5-04","title":"feat(web): related quotes in the evidence inspector","labels":["type:ui","stage:m3","track:web","owner:ai","risk:low","P2","size:M"],"milestone":"M3 Depth","depends":["P2-07"],"github":null} -->

#### Goal
A "Related moments" section in the inspector: up to three passages from **other** episodes that
are semantically close to the cited one, each with episode, timestamp and speaker state.

#### Scope
**In** — `KnowledgeStore.similarPassages(pk, k)` (vec0 KNN on the stored embedding, excluding the
same episode), `GET /api/passages/:id/related`, UI section with chips that open the related
passage in place.
**Out** — new model calls.

#### Acceptance criteria
- [ ] Never shows the same episode; hidden when no embeddings exist.
- [ ] Related passages are labelled as related (not cited) so they are never read as support.

#### Tests required
Store unit test with the fake embedder; e2e in demo mode (fixture related passages).

#### Security notes
Read-only, rate-limited like `/api/passages` (SR-07).

#### Skills to consult
`dear-steven-architecture`, `docs/DESIGN.md`.

#### Dependencies
P2-07. **Size:** M.

---

### P5-05 — feat(web): in-drawer YouTube player and in-app audio at the podcast moment

<!-- issue {"id":"P5-05","title":"feat(web): in-drawer YouTube player and in-app audio at the podcast moment","labels":["type:ui","stage:m3","track:web","owner:ai","risk:medium","P2","size:M"],"milestone":"M3 Depth","depends":["P3-05"],"github":null} -->

#### Context
The Video tab links out. Timing on YouTube is often estimated; the podcast timestamp is exact.

#### Goal
Click-to-load playback inside the inspector: a `youtube-nocookie` embed at the aligned second
(only after the user clicks; nothing loads from Google before), and an "Play the podcast audio
here" option that streams the RSS enclosure from the exact podcast timestamp.

#### Scope
**In** — click-to-load iframe (no third-party script until click), RefineFrame (vendor) for the
thumbnail frame, HTML audio with a `#t=` fragment on the enclosure URL, CSP `frame-src` for
`www.youtube-nocookie.com`.
**Out** — downloading or proxying audio.

#### Acceptance criteria
- [ ] No request to YouTube or the audio host until the user clicks.
- [ ] Estimated alignment is labelled `≈` in the player UI.
- [ ] Works on iOS Safari (gesture-started playback).

#### Tests required
e2e: no third-party requests before click (request log); player appears after click.

#### Security notes
New egress destinations (YouTube, the audio CDN) only on click — record in the threat model.

#### Design notes
The player sits in the Video tab; the conversation never scrolls away.

#### Skills to consult
`dear-steven-security`, `docs/DESIGN.md`.

#### Dependencies
P3-05. **Size:** M.

---

### P5-06 — feat(web): show disagreements between guests side by side

<!-- issue {"id":"P5-06","title":"feat(web): show disagreements between guests side by side","labels":["type:ui","stage:m3","track:web","owner:ai","risk:medium","P2","size:M"],"milestone":"M3 Depth","depends":["P5-01"],"github":null} -->

#### Goal
When an answer presents conflicting views, render them as a compact two-column "perspectives"
block, each side with its own citations — instead of burying the disagreement in prose.

#### Scope
**In** — a new `perspectives` block kind in the model schema (`{ topic, sides: [{ label, segments }] }`),
validator support (each side's segments validated like paragraphs), renderer, demo fixture.
**Out** — debate-style multi-turn generation.

#### Acceptance criteria
- [ ] Each side cites at least one passage from a different episode, or the block is downgraded to a paragraph.
- [ ] The eval set gains two "guests disagree" questions; `pnpm eval --answers` stays green.

#### Tests required
Validator and resolver unit tests; compose test with a scripted model; e2e with a fixture.

#### Security notes
Schema change touches the validator (`risk:medium`; SR-04 tests extended).

#### Skills to consult
`dear-steven-persona`, `dear-steven-architecture`.

#### Dependencies
P5-01. **Size:** M.

---

### P5-07 — feat(voice): settings — speak replies, on-device recognition, voice picker

<!-- issue {"id":"P5-07","title":"feat(voice): settings — speak replies, on-device recognition, voice picker","labels":["type:ui","stage:m3","track:voice","owner:ai","risk:low","P2","size:M"],"milestone":"M3 Depth","depends":["P4-02"],"github":null} -->

#### Goal
A small settings panel: "Always speak replies" (still gesture-gated per session), "On-device
speech recognition" (Chrome `processLocally` where `SpeechRecognition.available` says so), and a
stock-voice picker. Preferences in `localStorage` (try/catch; defaults when unavailable).

#### Scope
**In** — SquishSwitch and GlideSelect (vendor), `lib/voice/preferences.ts`, wiring into
`useVoice` and `speaker.ts`, `SPEECH_VOICE` becomes a default.
**Out** — custom or cloned voices (never).

#### Acceptance criteria
- [ ] Each preference survives a reload and degrades gracefully when storage is blocked.
- [ ] "Always speak" never plays before the first user gesture of a session.

#### Tests required
Unit tests for preferences; e2e for "always speak" gesture gating.

#### Skills to consult
`docs/DESIGN.md`, `plan/11-research/R-03-voice.md`.

#### Dependencies
P4-02. **Size:** M.

---

### P5-08 — spike(voice): "Hey Steven" wake word in the browser

<!-- issue {"id":"P5-08","title":"spike(voice): Hey Steven wake word in the browser","labels":["type:spike","stage:m3","track:voice","owner:ai","risk:medium","P2","size:M"],"milestone":"M3 Depth","depends":["P5-07"],"github":null} -->

#### Context
R-03: openWakeWord can run in the browser via ONNX with a custom model; it needs an always-open
microphone and has real privacy and battery costs.

#### Goal
A time-boxed (2 days) spike answering: can a custom "Hey Steven" model reach usable precision and
recall on desktop Chrome, with the mic indicator visible and auto-off after 2 minutes idle?

#### Scope
**In** — prototype on a branch; record false-accept / false-reject on 20 minutes of mixed audio.
**Out** — merging; mobile.

#### Acceptance criteria
- [ ] Findings in `plan/11-research/R-06-wake-word.md` with numbers and a recommendation.
- [ ] If recommended: an opt-in-only design with a persistent listening indicator, and a follow-up issue.

#### Security notes
Always-on listening is the most privacy-sensitive feature in the product; default off, explicit
opt-in, visible state, auto-off.

#### Dependencies
P5-07. **Size:** M.

---

### P5-09 — test(eval): LLM-judged usefulness with a human-graded calibration set

<!-- issue {"id":"P5-09","title":"test(eval): LLM-judged usefulness with a human-graded calibration set","labels":["type:test","stage:m3","track:eval","owner:ai","risk:low","P2","size:M"],"milestone":"M3 Depth","depends":["P3-08"],"github":null} -->

#### Goal
Track usefulness over time without a human reading every answer: a judge prompt scoring
helpfulness, faithfulness (does each sentence follow from its cited passage?) and persona, first
calibrated against the human's H-07 grades.

#### Scope
**In** — `eval/judge.ts`, a calibration file with the human's grades, agreement metric, a
`--judge` flag on `pnpm eval --answers`.
**Out** — gating CI on the judge.

#### Acceptance criteria
- [ ] Judge agrees with the human grades on ≥ 4 of 5 calibration answers (within ±1).
- [ ] Faithfulness flags at least the deliberately broken answers in a small adversarial set.

#### Security notes
Costs cents per run; operator key only.

#### Dependencies
P3-08. **Size:** M.

---

### P5-10 — chore(infra): deploy to Fly.io with a persistent volume

<!-- issue {"id":"P5-10","title":"chore(infra): deploy to Fly.io with a persistent volume","labels":["type:infra","stage:m3","track:infra","owner:ai","risk:high","needs:human-review","P2","size:S"],"milestone":"M3 Depth","depends":["P0-03"],"github":null} -->

#### Goal
`fly.toml` committed; the image deployed with the knowledge base on a volume; access decided.

#### Scope
**In** — `fly.toml` (one machine, `[mounts]`, `[env]`, health check on `/api/status`), docs update.
**Out** — autoscaling, multi-region.

#### Acceptance criteria
- [ ] `https://<app>.fly.dev/api/status` reports live mode and the right passage count.
- [ ] Access policy recorded in `docs/DEPLOY.md` (public with a low budget, or private).

#### Security notes
Production secret handling and public exposure of a paid API: `risk:high`.

#### Human steps
H-08.

#### Dependencies
P0-03, H-08. **Size:** S.

---

### P5-11 — feat(web): optional conversation memory across visits (explicit opt-in)

<!-- issue {"id":"P5-11","title":"feat(web): optional conversation memory across visits (explicit opt-in)","labels":["type:ui","stage:m3","track:web","owner:ai","risk:medium","P2","size:M"],"milestone":"M3 Depth","depends":["P5-07"],"github":null} -->

#### Goal
A user who opts in can come back to their previous conversation; nothing is kept without opting in.

#### Scope
**In** — browser-local storage only (IndexedDB), a visible "Remember this conversation on this
device" switch, "Forget" with FuseButton (vendor) undo, history replay without re-asking.
**Out** — server-side storage, accounts, sync.

#### Acceptance criteria
- [ ] Off by default; when off, nothing is written.
- [ ] Forget removes everything immediately.

#### Security notes
Personal questions on a shared device: copy must say where it's stored.

#### Dependencies
P5-07. **Size:** M.
