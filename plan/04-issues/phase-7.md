# Phase 7 — Conversations and polish (M5)

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-13 | milestone M5 |

**Exit:** you can do more with Dear Steven than ask it questions. You can just talk to it, and it
can interview you, the way the show interviews its guests, to get to know you or to help you
practise presenting what you know. The interface reads as designed rather than generated, and the
knowledge base keeps up with new episodes without a terminal.

Issues are grouped by category; each category is a label on GitHub.

| Category | Label | Issues |
|----------|-------|--------|
| Conversations | `track:conversation` | P7-05, P7-06, P7-07, P7-08 |
| Design | `track:design` | P7-02, P7-03 |
| Bugs | `bug` | P7-01, P7-04, P7-10 |
| Tests | `type:test` | P7-12 |
| Knowledge base | `track:ingest` | #16 (re-scoped: the latest episodes) |
| Maintenance | `track:infra` | P7-09 |

---

## Bugs

### P7-01 — fix(web): browser extensions that edit the page no longer cause a hydration error

<!-- issue {"id":"P7-01","title":"fix(web): browser extensions that edit the page no longer cause a hydration error","labels":["type:ui","stage:m5","track:web","owner:ai","risk:low","P1","size:S","bug"],"milestone":"M5 Conversations","depends":[],"github":46} -->

#### Context
With Grammarly installed, `next dev` reports a hydration mismatch on `<body>`: the extension adds
`data-new-gr-c-s-check-loaded` and `data-gr-ext-installed` before React hydrates. Other extensions
(Dark Reader, password managers) do the same to `<html>` and `<body>`. The app is fine; the
error overlay is noise that hides real errors.

#### Goal
Attributes added by extensions to `<html>` and `<body>` don't raise a hydration error.

#### Scope
**In** — `suppressHydrationWarning` on `<html>` and `<body>` in the root layout (it applies to
those elements' own attributes only, so real mismatches inside the page still surface).
**Out** — errors logged by extensions themselves (e.g. a wallet's `Error restoring session` from
`moz-extension://…`): not our code.

#### Acceptance criteria
- [ ] A page whose `<body>` gains extension attributes before hydration logs no hydration error.
- [ ] A real mismatch inside the page is still reported.

#### Tests required
E2E: add the Grammarly attributes in an init script before hydration; assert no hydration error.

#### Dependencies
None. **Size:** S.

---

### P7-04 — fix(web): on phones the demo notice no longer hides the first-visit notice

<!-- issue {"id":"P7-04","title":"fix(web): on phones the demo notice no longer hides the first-visit notice","labels":["type:ui","stage:m5","track:web","owner:ai","risk:low","P2","size:S","bug"],"milestone":"M5 Conversations","depends":[],"github":47} -->

#### Context
On a 375 px screen in demo mode, the persistent demo toast sits over the first-visit notice
(P6-12), so a first-time visitor can't read it or press its links. The same overlap makes
`e2e/terms.spec.ts` flaky on mobile (a click timeout on the notice's link).

#### Goal
On every screen size, the first-visit notice is fully visible and usable on the first visit.

#### Scope
**In** — keep the home content clear of the toast stack (reserve its height at the bottom on
small screens, or show the demo toast after the notice is dismissed); make the e2e test assert
the notice is unobstructed.

#### Acceptance criteria
- [ ] At 375 × 760 in demo mode, the notice's link and button can be pressed without scrolling or
  dismissing anything.
- [ ] `terms.spec.ts` passes ten runs in a row on mobile.

#### Tests required
E2E at 375 px: the notice's bounding box doesn't intersect the toast's.

#### Dependencies
None. **Size:** S.

---

### P7-10 — fix(web): with reduced motion, the home screen no longer stays blurred

<!-- issue {"id":"P7-10","title":"fix(web): with reduced motion, the home screen no longer stays blurred","labels":["bug","accessibility","type:ui","track:web","track:design","owner:ai","risk:low","P1","size:S","stage:m5"],"milestone":"M5 Conversations","depends":[],"github":60} -->

#### Context
Found while capturing screenshots for #59 (2026-10-13). With the system's reduce-motion setting
on, the home screen's intro, composer, examples and first-visit notice stayed blurred and offset.
The server renders the full entrance's first frame (it can't know the setting); after hydration
the reduced variant animated only opacity, so the blur and the offset never went away.

#### Goal
With reduce motion on, the home screen settles sharp and in place: a short fade, no movement.

#### Acceptance criteria
- [ ] With `prefers-reduced-motion: reduce`, nothing on the home screen keeps a blur or an
  offset once settled, at 375 and 1280 px.
- [ ] Without it, the entrance is unchanged; no hydration warning either way.

#### Tests required
E2E: the reduced-motion test checks the computed filter and transform of everything in `main`.

#### Dependencies
None. **Size:** S.

---

### P7-12 — test(web): the phone first-visit check waits for the home screen to settle

<!-- issue {"id":"P7-12","title":"test(web): the phone first-visit check waits for the home screen to settle","labels":["type:test","track:web","owner:ai","risk:low","P2","size:S","stage:m5"],"milestone":"M5 Conversations","depends":[],"github":68} -->

#### Context
`stage.spec.ts` › "on a phone, nothing covers the first-visit notice" failed on CI for #67 (an
unrelated change): the trial click on "Terms & disclaimer" timed out after 2 s "waiting for
element to be visible, enabled and stable". The home screen's entrance runs for up to about 1.9 s
(delays plus an 0.8 s rise), and on a slow runner the notice was still moving when the test
measured it and tried its 2-second trial clicks.

#### Goal
The test checks what it means to check (nothing covers the notice, and its controls take a plain
click) once the screen has settled, whatever the runner's speed.

#### Acceptance criteria
- [ ] The test waits until nothing on the home screen is blurred or offset (the same settled
  check as the reduced-motion test) before measuring and clicking.
- [ ] The trial clicks use the normal timeout; a real overlap still fails them.
- [ ] 20 repeats pass locally under parallel load.

#### Tests required
The change is the test: one shared `unsettled` helper used by both the phone check and the
reduced-motion check.

#### Dependencies
None. **Size:** S.

---

## Design

### P7-02 — fix(design): no more "·" separators — structure through layout and wording

<!-- issue {"id":"P7-02","title":"fix(design): no more \"·\" separators — structure through layout and wording","labels":["type:design","stage:m5","track:design","track:i18n","owner:ai","risk:low","P1","size:S"],"milestone":"M5 Conversations","depends":[],"github":48} -->

#### Context
The interface strings items together with middle dots: "↵ ask · ⇧↵ new line · / to type", "Demo
mode · fixture answers", "Chase Hughes · 28:17", "Watch on YouTube · ≈ 40:10". It reads as
machine-made, and it is not how the design system separates information.

#### Goal
No middle dot anywhere a visitor can see it. Separate pieces of information through layout
(spacing, weight, colour, chips) or through normal wording.

#### Scope
**In** — every visible "·" in the app, in both locales: catalogue strings, citation chips, pull-
quote captions, inspector and related-moment meta, the status pill, voice settings, the share
card, demo fixture names, screen-reader labels. Keyboard hints become separate key chips.
**Out** — code comments, the ingest CLI's terminal output, docs.

#### Acceptance criteria
- [ ] No "·" in any rendered page or dialog, in English and German (e2e walks home → answer →
  inspector → dialogs and searches the DOM text).
- [ ] Layout at 375, 768 and 1280 px stays tidy (screenshots in the PR).

#### Tests required
Unit: no catalogue string contains "·". E2E: the DOM walk above.

#### Skills to consult
`docs/DESIGN.md`.

#### Dependencies
None. **Size:** S.

---

### P7-03 — feat(design): a proper quote preview when you hover a source

<!-- issue {"id":"P7-03","title":"feat(design): a proper quote preview when you hover a source","labels":["type:design","stage:m5","track:design","track:web","owner:ai","risk:low","P1","size:S"],"milestone":"M5 Conversations","depends":["P7-02"],"github":49} -->

#### Context
Hovering a citation chip shows a small ivory tooltip: an uppercase mono label and the excerpt in
body text, squeezed so narrow near the edge of the screen that a sentence breaks every few words.

#### Goal
Hovering (or focusing) a source shows a preview worthy of the quote: readable width, the words
set like a quotation, who said it and when, how far to trust it, and where clicking takes you.

#### Scope
**In** — a dedicated preview card: dark surface with the ember hairline used by pull quotes;
speaker and timestamp; verification state ("speaker not verified" for RSS transcripts); the
excerpt in the display serif, at most five lines with a fade; the episode title; a quiet "open
the source" hint. Explicit width `min(22rem, 100vw − 32px)`, flips to stay on screen, keyboard
focus shows it, reduced motion respected.
**Out** — previews for related moments (they are already open in the inspector).

#### Acceptance criteria
- [ ] At every viewport the card is at least 18 rem wide (or the screen width minus 32 px).
- [ ] The excerpt is the stored transcript text, marked `lang="en"`.
- [ ] axe passes with the card open; it opens on keyboard focus.

#### Tests required
E2E: hover and focus open it; width at 375 and 1280; axe.

#### Skills to consult
`docs/DESIGN.md`.

#### Dependencies
P7-02 (the chip itself loses its dot). **Size:** S.

---

## Conversations

### P7-05 — feat(core): talk mode — just talk to Steven

<!-- issue {"id":"P7-05","title":"feat(core): talk mode — just talk to Steven","labels":["type:core","stage:m5","track:core","track:conversation","track:web","owner:ai","risk:medium","P1","size:M"],"milestone":"M5 Conversations","depends":[],"github":50} -->

#### Context
Every message is answered as a considered, sourced answer: paragraphs, a takeaway, cards for each
conversation. Sometimes you just want to talk: a quick back-and-forth, out loud or typed.

#### Goal
A Talk mode where Steven replies like across a table: one to three sentences, warm, often with a
question back, still drawing on a conversation (cited) when it helps.

#### Scope
**In** — `AskRequest.mode` (`ask` default, `talk`); in talk mode the answer model gets a `<style>`
note (short, spoken-style, no takeaway or pull quote, a question back when natural); same
retrieval, validator and safety rails; history carries the chat. UI: a mode switch by the
composer (Ask / Talk / Interview me), a chat layout for Talk (your message, then Steven's reply,
sources as chips only), spoken replies on by default when voice is available.
**Out** — the interview (P7-06).

#### Acceptance criteria
- [ ] Talk replies average under 60 words on a live run of the eval set; integrity numbers
  unchanged (citations resolve, no attribution violations, no quote mismatches).
- [ ] The safety rails apply unchanged (red team passes in talk mode).
- [ ] The mode is kept for the visit and visible; switching never loses the conversation.

#### Tests required
Core: talk guidance reaches the model; compose in talk mode. E2E: switch, chat, voice reply.
Eval: `--mode talk`.

#### Skills to consult
`dear-steven-persona`, `dear-steven-architecture`, `docs/DESIGN.md`.

#### Dependencies
None. **Size:** M.

---

### P7-06 — feat(core): interview mode — Steven interviews you, the way he interviews his guests

<!-- issue {"id":"P7-06","title":"feat(core): interview mode — Steven interviews you, the way he interviews his guests","labels":["type:core","stage:m5","track:core","track:conversation","track:web","owner:ai","risk:medium","P1","size:L"],"milestone":"M5 Conversations","depends":["P7-05"],"github":51} -->

#### Context
The show is famous for its questions: personal, curious, following the emotion, asking for the
story behind the success. Dear Steven only ever answers. The owner wants it to turn round and
interview you, to get to know you.

#### Goal
"Interview me": Steven asks you one question at a time, in the show's style, and each question
builds on what you just said: from who you are, through the story and the turning points, to
what you'd tell someone starting out.

#### Scope
**In** — `packages/core/src/interview`: setup (your name and what you do, optional), turns,
the interviewer prompt, the next-question step (strict JSON: the question, the stage it serves),
an arc of 6–10 questions (opening, story, turning point, depth, challenge, advice, closing);
style examples drawn from real questions in the transcripts as reference only, never quoted or
attributed; the safety rails on every answer you give (a crisis answer ends the interview with
help). `POST /api/interview` (validated, rate-limited, spend cap, demo questions in demo mode).
UI: setup, one question at a time in the display serif, answer by typing or voice, progress,
skip, end. At the end, "What I learned about you": a few lines, each tied to your own words.
**Out** — the practice debrief (P7-07); remembering it (P7-08).

#### Acceptance criteria
- [ ] A live interview of 6 questions where each question after the first refers to something
  in your previous answer (judged on 5 scripted personas, human-spot-checked).
- [ ] Questions are one question each, under 40 words, in the visitor's language.
- [ ] "What I learned about you" quotes only things you actually said (each line's evidence is
  a verbatim span of your answers, checked like transcript quotes).
- [ ] A crisis statement in an answer ends the interview with the crisis reply.

#### Tests required
Core: arc and stage choice, schema validation, evidence check, safety routing. Route tests.
E2E: a demo interview end to end.

#### Security notes
Your answers are personal: they go to OpenAI for the next question and are not stored on the
server. The privacy note (P6-12) gains a line.

#### Skills to consult
`dear-steven-persona`, `dear-steven-architecture`, `docs/DESIGN.md`, `dear-steven-security`.

#### Dependencies
P7-05 (the mode switch). **Size:** L.

---

### P7-07 — feat(core): practise presenting your expertise — a mock interview with a debrief

<!-- issue {"id":"P7-07","title":"feat(core): practise presenting your expertise — a mock interview with a debrief","labels":["type:core","stage:m5","track:core","track:conversation","owner:ai","risk:medium","P1","size:M"],"milestone":"M5 Conversations","depends":["P7-06"],"github":52} -->

#### Context
Being interviewed well is a skill: telling the story, being specific, landing the point. The
show's questions are good practice because they go past the pitch.

#### Goal
Choose "Practise presenting my expertise", say what you're expert in and for which audience, and
Steven runs a tougher interview about it. At the end, a debrief: what came across, where you were
vague, one answer rewritten the way it could land, scores you can improve on.

#### Scope
**In** — a `practice` flavour of the interview: questions that probe the expertise (the origin
story, the counter-intuitive belief, the evidence, the mistake, the one thing to remember); a
debrief step (strict JSON): headline, strengths and improvements each tied to your words, one
better answer, scores for clarity, specificity, story and brevity; every quoted word checked
against your answers. UI: the debrief view; "practise again on the weakest question".
**Out** — recording or scoring voice delivery (pace, filler words).

#### Acceptance criteria
- [ ] On 5 scripted practice runs (one deliberately vague), the debrief ranks the vague one
  lowest on specificity, and every quoted phrase is verbatim from the answers.
- [ ] The rewrite keeps the facts given and adds none (judged, human-spot-checked).

#### Tests required
Core: debrief schema and evidence validation, scoring bounds. E2E: demo debrief.

#### Skills to consult
`dear-steven-persona`, `dear-steven-architecture`.

#### Dependencies
P7-06. **Size:** M.

---

### P7-08 — feat(web): remember what Steven learned about you — opt-in, on this device

<!-- issue {"id":"P7-08","title":"feat(web): remember what Steven learned about you — opt-in, on this device","labels":["type:ui","stage:m5","track:web","track:conversation","owner:ai","risk:medium","P2","size:M"],"milestone":"M5 Conversations","depends":["P7-06"],"github":53} -->

#### Context
"Get to know you" means little if it is forgotten when the interview ends.

#### Goal
After an interview you can keep what Steven learned about you, on this device only, and later
answers take it into account ("Given you run a small agency…"). You can see, edit and forget it.

#### Scope
**In** — opt-in save of the "what I learned" lines (IndexedDB, like conversation memory, nothing
written while off); a short "about you" context sent with questions when on (≤ 600 characters,
shown to you exactly); the persona uses it for relevance only and never attributes it to a guest;
view, edit, forget in the memory control.
**Out** — server-side profiles; sharing it.

#### Acceptance criteria
- [ ] Off by default; nothing written until you choose to keep it; Forget deletes it at once.
- [ ] With it on, a live answer to an advice question uses it (judged on 5 profiles).
- [ ] What is sent is exactly what is shown.

#### Tests required
Unit: storage round trip, re-validation on load. E2E: keep, see, use, forget.

#### Security notes
Personal data in the browser: same rules as conversation memory (SR-17), and the privacy note
says so.

#### Dependencies
P7-06. **Size:** M.

---

## Knowledge base

**#16 (P6-16), re-scoped:** "bring in the latest episodes" no longer waits for a deployment. One
command (`pnpm ingest latest`: discover, free transcripts, passages, embeddings, overviews and
YouTube links for new episodes only, with a dry-run estimate and a budget), a button in the local
setup panel, and an optional schedule (a recipe for cron or a scheduled machine). See
`phase-6.md` › P6-16.

---

## Maintenance

### P7-09 — chore(ci): keep TypeScript and Node's types on the versions the stack needs

<!-- issue {"id":"P7-09","title":"chore(ci): keep TypeScript and Node's types on the versions the stack needs","labels":["type:infra","stage:m5","track:infra","owner:ai","risk:low","P2","size:S"],"milestone":"M5 Conversations","depends":[],"github":54} -->

#### Context
Dependabot's first run proposed TypeScript 7 and `@types/node` 26. The stack pins TypeScript 6
(`next build` needs the classic compiler API, AGENTS.md §3) and runs on Node 22.

#### Goal
Dependabot proposes only updates the stack can take.

#### Scope
**In** — `ignore` rules: TypeScript major updates, `@types/node` above 22; close the two PRs with
the reason.

#### Acceptance criteria
- [ ] Dependabot's next run proposes neither.

#### Dependencies
None. **Size:** S.
