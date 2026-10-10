# 06 — Workflow (labels, risk, human gates)

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | every issue |

`docs/WORKFLOW.md` is the daily loop. This document defines the **taxonomy** and gates.

## 1. Label taxonomy

Source of truth: `.github/labels.json` (`scripts/sync-labels.sh` creates them with `gh`).

| Group | Labels | Rule |
|-------|--------|------|
| **Type** | `type:core`, `type:service`, `type:ui`, `type:design`, `type:infra`, `type:docs`, `type:test`, `type:security`, `type:research`, `type:spike`, `type:human-task` | exactly one |
| **Stage** | `stage:m0`, `stage:m1`, `stage:m2`, `stage:m3`, `stage:research`, `stage:harness` | exactly one |
| **Track** | `track:web`, `track:core`, `track:ingest`, `track:design`, `track:voice`, `track:docs`, `track:infra`, `track:security`, `track:eval` | one or more |
| **Who** | `owner:ai` (default), `needs:human`, `needs:human-review`, `needs:decision` | `owner:ai` on every issue except `type:human-task` |
| **Risk** | `risk:low`, `risk:medium`, `risk:high` | exactly one; `risk:high` ⇒ `needs:human-review` |
| **Priority** | `P0`, `P1`, `P2` | exactly one |
| **Size** | `size:S`, `size:M`, `size:L` | exactly one |
| **State** | `blocked` | waiting on a dependency or a human |

### Risk definition (mechanical)

| Label | When |
|-------|------|
| `risk:low` | No security surface |
| `risk:medium` | Logging, dependencies, containers, CI, rate limits, request validation, prompt changes |
| `risk:high` | API keys or their handling, anything that **spends money** (diarization, bulk embedding), data leaving the machine to a new destination, CI secrets, the citation validator or quote matcher (the integrity of "who said what") |

"It is only a refactor" does **not** lower the label if the files touch those surfaces. The
validator is `risk:high` because a regression there makes the product lie.

## 2. Commit scopes

`web core ingest design voice eval docs plan ci infra deps repo harness security`
(`commitlint.config.js`). Research / human-task closing PRs use `docs(plan): …`.

## 3. Human tasks and blocked issues

- Human tasks are `type:human-task` + `needs:human` issues, or lines in another issue's **Human
  steps**, each linking a runbook in `plan/human/`.
- An AI issue waiting on a person carries `blocked` and names the task (`blocked by H-07`).
  The agent moves on.
- Decisions (`needs:decision`) are asked once, with options and a recommendation.

## 4. Reviewer roles

| Role | When | Tools |
|------|------|-------|
| Author self-review | every PR | `docs/REVIEW-CHECKLIST.md` (+ security checklist on `risk:*`) |
| Second-agent review | every PR | clean-code-reviewer, clean-code-reviewer-correctness |
| Security reviewer | every `risk:high` | `dear-steven-security` skill, differential review |
| Design reviewer | `type:ui` / `type:design` | `docs/DESIGN.md` + screenshots at 375 / 768 / 1280 |
| Persona reviewer | prompt, persona, fixtures, copy | `docs/PERSONA.md`, `pnpm eval` |
| **Human** | every `risk:high` | approving review from an account in `.github/human-reviewers.json` (H-06) |

## 5. Releases

- `main` is always deployable; milestone tags (`m1`, `m2`, …) on the merge that closes a milestone.
- Deploys are manual (`fly deploy`) until P5-10.
