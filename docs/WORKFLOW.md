# WORKFLOW.md — how agents work in this repository

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | every PR |

## The loop

1. **Pick the issue.** Lowest-numbered open issue in the current milestone whose dependencies are
   closed and which has no unresolved `needs:human` / `needs:decision` (`plan/STATUS.md`).
   Comment `taking`.
2. **Load context.** `AGENTS.md` → the docs it points at → the issue body → the skills mandated
   for the issue's labels (`plan/10-harness.md`).
3. **Branch.**
   ```bash
   git checkout main && git pull
   git checkout -b <type>/<issue-number>-<slug>     # e.g. feat/41-episode-explorer
   ```
   Prefixes: `feat/`, `fix/`, `chore/`, `docs/`, `test/`, `refactor/`.
4. **Implement — in scope only.** Conventional Commits. Follow `docs/ARCHITECTURE.md`,
   `docs/DESIGN.md` and `docs/PERSONA.md`.
5. **Verify.** `pnpm check` green. UI: run the app at 375 / 768 / 1280 and under reduced motion;
   `pnpm e2e`. Answers or retrieval: `pnpm eval` (and `--answers` when the issue says so — it
   costs cents and needs a key; ask first if you don't have one). `risk:*`: the negative tests the
   issue lists.
6. **Push and open a PR** titled with the issue heading + `(#n)`, body from the PR template,
   including `Closes #n`, Security impact, and Risk label justification.
7. **Self-review** against `docs/REVIEW-CHECKLIST.md` (and the security checklist on `risk:*`) —
   post as PR comments. Then request a second agent's review.
8. **Human review** on every `risk:high` PR (`needs:human-review`).
9. **Iterate** until approved and CI is green. Squash-merge, delete the branch, confirm the issue
   closed, comment `changed: … / next: …`, and make sure `plan/STATUS.md` was updated **in the
   same PR**.

## Rules

- One issue per PR. No drive-by refactors — open a follow-up issue instead.
- New dependencies must be justified in the PR description. Default answer is no.
- The committed planning artefact is `plan/`. Local scratch may use `*.plan.md` (gitignored).
- Never push directly to `main`.
- Wrong acceptance criteria → say so on the issue and get them amended first.
- Anything that spends money (diarization, large embedding runs, `pnpm eval --answers` at scale)
  is a human step with a runbook in `plan/human/`.

## What is enforced, and how

| Rule | Mechanism | Status |
|------|-----------|--------|
| Lint, format, typecheck, unit tests | `pnpm check` in CI (`check` job) | enforced in CI |
| Core is framework-free; client never imports server core; no cycles | dependency-cruiser in `pnpm check` | enforced in CI |
| E2E (desktop + mobile, demo mode) | `e2e` job | enforced in CI |
| No secrets committed | gitleaks job | enforced in CI |
| PR title is a Conventional Commit with an allowed scope | `pr-title` job (commitlint) | enforced in CI |
| Squash-only, delete branch on merge, required checks, no direct pushes | GitHub settings | **human step H-01** (`plan/human/github-setup.md`) |
| `risk:high` needs a human approval | convention + `needs:human-review` | **convention** until H-01/H-05 |

## Commit format

```
feat(web): episode explorer (#41)

- what changed and why

Closes #41
```

Scopes: `web core ingest design voice eval docs plan ci infra deps repo harness security`
(`commitlint.config.js`). The **PR title** becomes the squash commit title — CI lints the title.
