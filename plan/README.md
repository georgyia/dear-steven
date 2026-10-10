# plan/ — the committed planning artefact

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | every issue |

This folder is the **one committed planning artefact** in the repository. It says what we build
next, in what order, and why. `docs/` is the product documentation (what exists today); `plan/`
describes what open issues will change. When they disagree, `docs/` is current reality and
`plan/` is the intended change.

> **Ask Steven a real question and get a thoughtful first-person answer whose every claim you can click through to the exact moment it was said.**

Nothing in this folder relaxes that sentence.

## 1. Reading order

Before you pick an issue, read `AGENTS.md`, then:

| # | Document | Read it when |
|---|----------|--------------|
| 1 | `00-vision.md` | Always — exit criteria every issue serves |
| 2 | `docs/ARCHITECTURE.md` (current), `01-architecture.md` (as approved) | Always — boundaries and trust |
| 3 | `03-roadmap.md` | To see where your issue sits on the critical path |
| 4 | `04-issues/<phase>.md` | Full text of your issue |
| 5 | `09-security/SECURE-CODING.md` | Any `risk:medium` or `risk:high` issue |
| 6 | `10-harness.md` | Skills your labels mandate |
| 7 | `06-workflow.md` | Before your first branch |
| 8 | ADRs and research briefs your issue links | Before code that depends on them |

## 2. Folder map

```
plan/
  README.md                 this file
  STATUS.md                 live board: phase, issue, state, blocker, human-waiting
  00-brief.md               the original prompt, verbatim
  00-vision.md              definition, exit criteria, non-goals
  01-architecture.md        the architecture plan as approved, with departures listed
  03-roadmap.md             phases, milestones, dependency graph, critical path
  04-issues/                every issue, in the form agents + gh consume
  05-human-tasks.md         every step only a person can take
  06-workflow.md            labels, risk, review gates
  07-ci-cd.md               pipelines, required checks, secrets
  08-testing-strategy.md    what is tested where
  09-security/              threat model, secure coding, review checklist
  10-harness.md             skills, MCP, subagents, hooks; label → skill matrix
  11-research/              questions that ended in decisions (R-01 … R-04)
  12-adr/                   architecture decision records (ADR-001 … ADR-004)
  human/                    runbooks for human tasks
```

## 3. Document header and status legend

Every document opens with **Status**, **Owner**, **Updated**, **Feeds**.

| Status | Meaning |
|--------|---------|
| `draft` | Written, not yet relied on. The named decision owner must confirm. |
| `reviewed` | Checked against code and other documents. Safe to build on. |
| `adopted` | Binding. An issue that contradicts it must amend the document first. |

| Owner | Meaning |
|-------|---------|
| `ai` | An agent maintains it inside the issue that needs the change. |
| `human` | Only a human changes the decision. Agents may fix typos and links. |

## 4. Issue ids and GitHub numbers

Issues are written once in `04-issues/` with a stable id (`P3-04`, `R-02`). The id never changes;
the GitHub number is written back after creation (`github` field). Refer by both in prose
(`P3-04 (#31)`). Until the repository is on GitHub (H-01), the `github` fields stay `null`.

## 5. How an agent uses this folder

1. Open `STATUS.md`. Find the lowest-numbered open issue whose dependencies are closed and which
   has no unresolved `needs:human` or `needs:decision`.
2. Read the full text in `04-issues/`. If it links a `draft` ADR, check the decision owner has
   confirmed it; if not, the issue is blocked — say so on the issue.
3. Load the skills `10-harness.md` mandates for the issue's labels.
4. On `risk:*`, read `09-security/` and the requirement ids in **Security notes**.
5. Work the issue as `docs/WORKFLOW.md` describes.

## 6. How to update STATUS.md

`STATUS.md` changes **in the same PR** as the work it describes. Closing an issue moves its row to
`done` with the PR number. A blocker goes in the blocker column and, if a person must act, under
**Waiting on a human** with a runbook link. An agent never marks a `needs:human` item done on a
person's behalf.

## 7. Changing the plan

- **A fact changed:** update the research brief, then dependent docs, in one `docs(plan): …` PR.
- **A decision changes:** a new ADR supersedes the old one. Never edit an ADR into a different decision.
- **Acceptance criteria wrong:** say so on the issue, amend `04-issues/` and GitHub in the same PR,
  then implement the amended version.

## 8. Naming rule

No file in this folder ends in `.plan.md`. That suffix is reserved for local scratch (gitignored).
