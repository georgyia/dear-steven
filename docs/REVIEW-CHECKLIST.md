# REVIEW-CHECKLIST.md

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | every PR |

Run through this as the author (post it as a PR comment) and again as the reviewer.

## Scope
- [ ] The PR implements exactly one issue, and everything in that issue.
- [ ] Nothing outside the issue's "in scope" list was touched.
- [ ] No unrelated refactors, renames or dependency bumps.
- [ ] New dependencies (if any) are justified in the PR description.

## Correctness
- [ ] Each acceptance criterion is demonstrably met (say how, per criterion).
- [ ] Edge cases named in the issue / product docs behave correctly (empty knowledge base, demo
      mode, no embeddings, unverified speakers, missing video, mic denied).
- [ ] Domain logic is not re-derived in the UI or API layer — it lives in `packages/core`.
- [ ] Time, randomness and ids are injected where determinism is required.

## Evidence and persona (anything that touches answers, prompts, fixtures or copy)
- [ ] No path lets unvalidated model text reach the browser.
- [ ] Quotes on screen are stored transcript spans; citations name retrieved passages only.
- [ ] Host/guest claims still require verified speaker segments.
- [ ] No fixture, prompt, test or doc puts invented words in Steven Bartlett's mouth.
- [ ] Persona rules in `docs/PERSONA.md` and `persona.ts` agree; version bumped if the prompt
      changed; `pnpm eval` run (and `--answers` if the issue requires it).

## Design system (UI issues)
- [ ] Tokens only — no raw colours outside `tokens.css` (canvas/WebGL exceptions commented).
- [ ] Colour carries meaning, and is never the only signal.
- [ ] Motion explains a state change and respects `prefers-reduced-motion`.
- [ ] Keyboard reachable; visible focus; screen-reader names make sense.
- [ ] Checked at 375 / 768 / 1280; screenshots in the PR.

## Code quality
- [ ] Names use product vocabulary (`docs/PRODUCT.md`).
- [ ] Functions do one thing; no dead or commented-out code.
- [ ] Types are precise — no `any`, no unchecked casts across a trust boundary.
- [ ] No duplicated logic that belongs in a shared package.

## Tests
- [ ] Core changes have tests, including failure paths.
- [ ] Tests assert behaviour, not implementation details.
- [ ] `pnpm check` is green locally and in CI; `pnpm e2e` green for UI changes.

## Integrity
- [ ] Copy and claims match reality (no "verified" without diarization, no "connected" without a key).
- [ ] No secrets, transcripts, audio or `data/` in the diff.
- [ ] `plan/STATUS.md` updated in this PR.
