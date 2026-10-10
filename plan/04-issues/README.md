# 04 — Issue inventory

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | every issue |

Every issue is written here first. GitHub issues are created **from these files**, and the
GitHub number is written back into the `github` field.

| File | Milestone | State |
|------|-----------|-------|
| `phase-0.md` | M0 Foundations | done except P0-05 (needs H-02), P0-06 (needs H-01) |
| `phase-1.md` | M1 Stage + demo mode | done |
| `phase-2.md` | M1 Knowledge core + ingestion | done except P2-08 (real diarization run, needs H-04/H-05) |
| `phase-3.md` | M1 Grounded answers | done except P3-08 (live eval, needs H-03/H-07) |
| `phase-4.md` | M2 Voice | done |
| `phase-5.md` | M3 Depth and polish | open |
| `phase-6.md` | M4 Reach and trust | open — languages, setup, answers, security, policies, YouTube |

Issues built in the first implementation pass (phases 0–4) are recorded briefly: what was in
scope, how each criterion was verified, and where the work lives. Open issues are fully specified.

## 1. Format

Each issue is a level-3 heading `### <id> — <heading>` followed by one metadata comment, then:

```markdown
<!-- issue {"id":"P5-03","title":"…","labels":[…],"milestone":"M3 Depth","depends":["P3-08"],"github":null} -->

#### Context
#### Goal
#### Scope            (In / Out)
#### Acceptance criteria
#### Tests required
#### Security notes
#### Design notes     (UI issues only)
#### Skills to consult
#### Human steps
#### Dependencies
#### Size
```

## 2. Rules

- The heading after `### <id> — ` is the PR title base: a Conventional Commit ≤ ~93 characters.
- Labels: exactly one `type:*`, one `stage:*`, ≥ 1 `track:*`, one `risk:*`, one of `P0`/`P1`/`P2`,
  one `size:*`; `owner:ai` unless a person owns it; `risk:high` always carries `needs:human-review`.
- `depends` lists stable ids; `github` is `null` until created.
- In bodies, refer to files as backticked paths — bodies are rendered on GitHub.

## 3. Changing an issue

Change it here and on GitHub in the same PR (`docs(plan): amend P5-03 …`). If acceptance criteria
of an in-progress issue change, say so on the issue first.
