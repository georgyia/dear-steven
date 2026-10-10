# Phase 1 — Design system, stage shell, demo mode (M1 part 1)

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | milestone M1 |

**Exit:** the visual identity and interaction architecture exist and are usable with no API keys;
Lighthouse a11y ≥ 95; works at 375 / 768 / 1280; reduced motion verified; Playwright covers
load → ask (demo) → open chip → navigate citations → Esc.

---

### P1-01 — feat(design): design tokens, fonts and global styles

<!-- issue {"id":"P1-01","title":"feat(design): design tokens, fonts and global styles","labels":["type:design","stage:m1","track:design","owner:ai","risk:low","P0","size:S"],"milestone":"M1 Stage","depends":["P0-02"],"github":null} -->

**Result:** `apps/web/src/styles/tokens.css` (ink / ivory / ember / steel / oxblood, shape, layout,
motion), Tailwind v4 `@theme inline` mapping in `globals.css`, Fraunces (opsz, SOFT, italic) +
Geist + Geist Mono via `next/font/google`, the lamp gradient, ember focus rings.
**Verified:** contrast ≥ 4.5:1 for every text token on every ink (`--ivory-2` lightened, see
`docs/DESIGN.md`). **State:** done.

---

### P1-02 — feat(design): vendor the React Bits component set

<!-- issue {"id":"P1-02","title":"feat(design): vendor the React Bits component set","labels":["type:design","stage:m1","track:design","owner:ai","risk:medium","P0","size:M"],"milestone":"M1 Stage","depends":["P1-01"],"github":null} -->

**Result:** 14 components in `components/vendor/react-bits/` with a licence header each and
`LICENSE.md`; local changes to PromptBar, BlurText, WarmTooltip, VoicePill recorded in headers (R-01).
New deps justified: `motion@12.43.0` (required by 7 components), `@hugeicons/*` (required by 4).
**State:** done.

---

### P1-03 — feat(web): the stage — home, state machine, status pill, setup and about panels

<!-- issue {"id":"P1-03","title":"feat(web): the stage — home, state machine, status pill, setup and about panels","labels":["type:ui","stage:m1","track:web","owner:ai","risk:low","P0","size:L"],"milestone":"M1 Stage","depends":["P1-02"],"github":null} -->

**Result:** `Stage`, `HomeView`, `ConversationView`, `AmbientLayer` (Threads + Noise, still frame
on mobile / reduced motion), `Wordmark` (BlurText), `StatusPill` (+ LatticeLoader while
embeddings are pending), `SetupDialog` (StatusMark checklist), `AboutDialog` (the four kinds of
statement), composer docking via shared layout animation, `lib/stage-machine.ts` (+17 tests),
`/api/status`. **State:** done.

---

### P1-04 — feat(web): answer renderer — blocks, segments, chips, pull quote, takeaway, episode cards

<!-- issue {"id":"P1-04","title":"feat(web): answer renderer — blocks, segments, chips, pull quote, takeaway, episode cards","labels":["type:ui","stage:m1","track:web","owner:ai","risk:low","P0","size:M"],"milestone":"M1 Stage","depends":["P1-03"],"github":null} -->

**Result:** `TurnView`, `ThoughtTrace` (ThoughtLine fed by status events), `AnswerBlocks`
(synthesis set softer), `CitationChip` (three speaker states, WarmTooltip preview, full
accessible name), `PullQuote` (ember hairline draws down), takeaway card, `EpisodeCards`
(SpotlightCard), writing placeholder, caveats, error with retry, "Answer complete." live region.
**State:** done.

---

### P1-05 — feat(web): evidence inspector — desktop panel and mobile sheet

<!-- issue {"id":"P1-05","title":"feat(web): evidence inspector — desktop panel and mobile sheet","labels":["type:ui","stage:m1","track:web","owner:ai","risk:low","P0","size:M"],"milestone":"M1 Stage","depends":["P1-04"],"github":null} -->

**Result:** `EvidenceDrawer` (420px panel; column and composer shift left), `EvidenceSheet`
(native modal `<dialog>`, drag handle), `PassageView` (speaker badge, Quote / Context / Video tabs
via RubberSegment, relevance note, copy-with-attribution toast), `[` / `]` / `Esc`, focus moves to
the heading on open and returns on close. **State:** done.

---

### P1-06 — feat(web): demo mode — labelled fixtures through the real event protocol

<!-- issue {"id":"P1-06","title":"feat(web): demo mode — labelled fixtures through the real event protocol","labels":["type:service","stage:m1","track:web","owner:ai","risk:low","P0","size:S"],"milestone":"M1 Stage","depends":["P1-04"],"github":null} -->

**Result:** `lib/demo-fixtures.ts` (three topics + an honest insufficient fallback; fictional
"Demo Guest" episodes marked "(fixture)"; no host attribution; no video links), `server/demo.ts`
(paced SSE), persistent demo notice, per-answer demo eyebrow, `/api/passages/:id` fixture
context. Tests prove the fixtures are valid, labelled and quote verbatim. **State:** done.

---

### P1-07 — test(web): end-to-end, responsive, reduced-motion and accessibility checks

<!-- issue {"id":"P1-07","title":"test(web): end-to-end, responsive, reduced-motion and accessibility checks","labels":["type:test","stage:m1","track:web","owner:ai","risk:low","P0","size:M"],"milestone":"M1 Stage","depends":["P1-05","P1-06"],"github":null} -->

**Result:** `e2e/stage.spec.ts` (desktop + mobile): demo notice, setup panel, about panel, `/`
focus, no horizontal scroll, streamed answer, honest insufficient answer, stop mid-answer, chip
tooltip, inspector cycling with `[`/`]`, Esc, panel beside (not over) the column, bottom sheet on
mobile, reduced motion. Lighthouse 13.5 accessibility on the home page: **100** at 375 px and **100** at desktop. The interactive states (answer, inspector, sheet, dialogs) are covered by e2e but have not had an automated a11y audit yet — follow-up P1-08.
**State:** done.

---

### P1-08 — test(web): automated accessibility audit of the interactive states

<!-- issue {"id":"P1-08","title":"test(web): automated accessibility audit of the interactive states","labels":["type:test","stage:m1","track:web","owner:ai","risk:low","P1","size:S"],"milestone":"M1 Stage","depends":["P1-07"],"github":null} -->

#### Context
Lighthouse can only load a URL, so it audited the home page (100 / 100). The streamed answer, the
evidence inspector, the mobile sheet and the dialogs need an audit after interaction.

#### Goal
axe-core (the engine behind Lighthouse's accessibility score) runs inside the Playwright suite on
each interactive state, at 375 px and 1280 px, and fails on any WCAG 2.1 A/AA violation.

#### Scope
**In** — `@axe-core/playwright` as a dev dependency (justify in the PR); an `e2e/a11y.spec.ts`
covering home, answer, inspector (desktop panel and mobile sheet), setup and about dialogs; fixes
for anything it finds.
**Out** — manual screen-reader testing (a separate, human pass).

#### Acceptance criteria
- [ ] Zero WCAG 2.1 A/AA violations in every state at both widths.
- [ ] The spec runs in CI as part of `e2e`.

#### Tests required
The new spec.

#### Security notes
None — a test-only dependency.

#### Skills to consult
`docs/DESIGN.md` §7.

#### Human steps
None.

#### Dependencies
P1-07. **Size:** S. **State:** open.
