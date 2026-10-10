# Phase 0 — Foundations (M0)

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | milestone M0 |

**Exit:** workspace builds; `pnpm check` green on a fresh clone; CI defined; process docs in
place; an agent can take the next issue from `plan/STATUS.md` without asking questions.

---

### P0-01 — docs(plan): adopt the agent engineering kit as the project's process layer

<!-- issue {"id":"P0-01","title":"docs(plan): adopt the agent engineering kit as the project's process layer","labels":["type:docs","stage:m0","track:docs","owner:ai","risk:low","P0","size:L"],"milestone":"M0 Foundations","depends":[],"github":null} -->

#### Context
The kit (`agent-engineering-kit/`, gitignored) defines AGENTS.md, `docs/` = what exists, `plan/` =
what's next, fully specified issues, ADRs, research briefs and human runbooks.

#### Goal
The project's own, filled-in versions — not a copy of the kit.

#### Scope
**In** — `AGENTS.md`; `docs/{PRODUCT,ARCHITECTURE,PERSONA,DESIGN,INGESTION,WORKFLOW,REVIEW-CHECKLIST,DEPLOY}.md`;
`plan/` (README, STATUS, brief, vision, architecture record, roadmap, issues, human tasks, workflow,
CI/CD, testing, security, harness, research R-01…R-04, ADR-001…004, runbooks).
**Out** — product code.

#### Acceptance criteria
- [x] Every kit section the project needs has a filled-in file (no `[PLACEHOLDER]`s remain).
- [x] `prompt.md` moved to `plan/00-brief.md`; the approved plan recorded as `plan/01-architecture.md` with departures listed.
- [x] Every human step has a runbook in `plan/human/`.
- [ ] GitHub issues created from `plan/04-issues/` with numbers written back — **after H-01**.

#### Tests required
`pnpm check`; manual link check across `plan/`.

#### Security notes
Docs only.

#### Skills to consult
`docs/REVIEW-CHECKLIST.md`.

#### Human steps
H-01 before GitHub issues can be created.

#### Dependencies
None. **Size:** L. **State:** done (GitHub sync pending H-01).

---

### P0-02 — chore(repo): pnpm workspace, Next.js 16, core and ingest skeletons, toolchain

<!-- issue {"id":"P0-02","title":"chore(repo): pnpm workspace, Next.js 16, core and ingest skeletons, toolchain","labels":["type:infra","stage:m0","track:infra","owner:ai","risk:medium","P0","size:M"],"milestone":"M0 Foundations","depends":[],"github":null} -->

#### Scope and result
`pnpm-workspace.yaml` (apps/*, packages/*, eval; `onlyBuiltDependencies` for better-sqlite3,
esbuild, sharp, biome); exact-pinned versions (R-04); `tsconfig.base.json` (strict,
`allowImportingTsExtensions`, `erasableSyntaxOnly`); Biome 2.5; Vitest 5 projects; Playwright 1.64;
dependency-cruiser rules; commitlint; `.gitignore` (`.env*`, `data/`, kit, `*.plan.md`);
`.env.example`; `pnpm check` = lint + typecheck + test + arch.

#### Acceptance criteria
- [x] `pnpm install && pnpm check` green on a fresh clone.
- [x] dependency-cruiser fails on a planted `react` import in core and on a client import of
      core `store` (verified by planting both).

#### Security notes
Dependencies and install scripts: pnpm 10 blocks install scripts except the allow-list.
**Size:** M. **State:** done.

---

### P0-03 — ci: check, e2e, docker, gitleaks and PR-title workflows

<!-- issue {"id":"P0-03","title":"ci: check, e2e, docker, gitleaks and PR-title workflows","labels":["type:infra","stage:m0","track:infra","owner:ai","risk:medium","P0","size:S"],"milestone":"M0 Foundations","depends":["P0-02"],"github":null} -->

#### Scope and result
`.github/workflows/ci.yml` with jobs `check`, `e2e`, `docker`, `gitleaks`, `pr-title`; actions
pinned by SHA; `permissions: contents: read`; no secrets; concurrency groups (`plan/07-ci-cd.md`).

#### Acceptance criteria
- [x] Workflow written per `plan/07-ci-cd.md`.
- [ ] First green run on GitHub — **after H-01**.

**Size:** S. **State:** done (first run pending H-01).

---

### P0-04 — chore(repo): labels, issue and PR templates

<!-- issue {"id":"P0-04","title":"chore(repo): labels, issue and PR templates","labels":["type:infra","stage:m0","track:docs","owner:ai","risk:low","P1","size:S"],"milestone":"M0 Foundations","depends":["P0-01"],"github":null} -->

#### Scope and result
`.github/labels.json` (taxonomy in `plan/06-workflow.md`), `scripts/sync-labels.sh`,
`ISSUE_TEMPLATE/{task,human-task,research,spike}.md`, `PULL_REQUEST_TEMPLATE.md` (Security impact,
risk justification, screenshots, STATUS checkbox).

#### Acceptance criteria
- [x] Every label used in `plan/04-issues/` exists in `labels.json`.

**Size:** S. **State:** done.

---

### P0-05 — chore(harness): install and audit third-party skills

<!-- issue {"id":"P0-05","title":"chore(harness): install and audit third-party skills","labels":["type:infra","stage:harness","track:docs","owner:ai","needs:decision","risk:medium","P2","size:M"],"milestone":"M0 Foundations","depends":["P0-01"],"github":null} -->

#### Context
`plan/10-harness.md` lists third-party skills (testing, clean code, supply-chain, frontend design,
React best practices). Project skills (`dear-steven-*`) are already in `.agents/skills/`.

#### Goal
The skills H-02 approves are installed under `.agents/skills/`, symlinked into `.claude/skills/`,
audited, and the skill matrix updated to name them without "once installed".

#### Scope
**In** — install approved skills; read every file before committing; symlinks; update `plan/10-harness.md`.
**Out** — MCP servers needing tokens (separate decision in H-02).

#### Acceptance criteria
- [ ] Each installed skill's scripts were read; none fetch the network or write outside the repo
      unexpectedly (note findings in the PR).
- [ ] Every `type:*` row of the matrix names at least one present skill.
- [ ] `ls -la .claude/skills` shows a symlink per skill.

#### Tests required
`pnpm check`; symlink listing in the PR.

#### Security notes
Third-party skills are code that agents execute instructions from: supply-chain review required.

#### Skills to consult
`dear-steven-security`.

#### Human steps
H-02 (which skills; yes/no on MCP servers).

#### Dependencies
P0-01, H-02. **Size:** M. **State:** open, blocked by H-02.

---

### P0-06 — chore(repo): publish to GitHub and enable branch protection

<!-- issue {"id":"P0-06","title":"chore(repo): publish to GitHub and enable branch protection","labels":["type:human-task","stage:m0","track:infra","needs:human","risk:medium","P1","size:S"],"milestone":"M0 Foundations","depends":["P0-03","P0-04"],"github":null} -->

#### Goal
The repository exists on GitHub with CI green, labels synced, branch protection on, and GitHub
issues created from `plan/04-issues/` with numbers written back.

#### Acceptance criteria
- [ ] First CI run green.
- [ ] `main` protected: required checks `check`, `e2e`, `docker`, `gitleaks`, `pr-title`; squash only.
- [ ] Issues created; `github` fields filled in a `docs(plan): sync GitHub numbers` PR.

#### Human steps
`plan/human/github-setup.md` (H-01), then an agent creates the issues.

**Size:** S. **State:** open, needs H-01.
