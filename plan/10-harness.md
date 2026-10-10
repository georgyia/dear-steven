# 10 — Harness: skills, MCP servers, subagents, hooks

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | every issue (skill matrix) |

Agents load every matching row of the skill matrix before writing code.

## 1. Layout

```
.agents/skills/<name>/SKILL.md     committed source of truth
.claude/skills/<name> -> symlink   Claude Code
```

Cursor / Codex / Copilot read `.agents/skills/` directly.

## 2. Skills present

| Skill | Contents | Mandatory on |
|-------|----------|--------------|
| `dear-steven-security` | Distilled `09-security/` rules; the five things that matter here | every `risk:*`; keys, limits, validator, CI, Docker |
| `dear-steven-architecture` | Boundaries; how to add a feature end to end; conventions | `type:core`, `type:ui`, `type:service` |
| `dear-steven-persona` | The four kinds of statement; never-fabricate rules; prompt-change procedure | persona, schema, validator, fixtures, copy |

Third-party skills (testing, clean code, supply chain, frontend design, React best practices) are
**not installed yet** — that is H-02 / P0-05. Until then, the matrix rows that name them fall
back to `docs/REVIEW-CHECKLIST.md` and `plan/08-testing-strategy.md`.

## 3. Skill matrix — labels → skills

| Label | Skills |
|-------|--------|
| `type:ui`, `type:design`, `track:design` | `dear-steven-architecture`, `docs/DESIGN.md`; + frontend-design, web-design-guidelines, vercel-react-best-practices once installed |
| `type:core`, `track:core`, `track:ingest` | `dear-steven-architecture`; + clean-typescript, testing-best-practices once installed |
| `track:voice` | `dear-steven-architecture`, `docs/DESIGN.md` §5, `plan/11-research/R-03` |
| `track:eval`, anything touching answers | `dear-steven-persona` |
| `type:test` | `plan/08-testing-strategy.md`; + webapp-testing once installed |
| `type:infra`, `type:docs` | naming + comments conventions in `docs/REVIEW-CHECKLIST.md` |
| `risk:medium`, `risk:high`, `type:security` | `dear-steven-security` (**mandatory**) |
| any new dependency | supply-chain check in `09-security/SECURE-CODING.md` §9 |
| any PR review | `docs/REVIEW-CHECKLIST.md` |

## 4. MCP servers

None configured. Candidates are listed in `human/harness-decisions.md` (Playwright, Context7,
GitHub). Agents use the `gh` CLI, the Playwright runner, and `node_modules/next/dist/docs/`.

## 5. Subagents

| Subagent | Trigger | Output |
|----------|---------|--------|
| security reviewer | `risk:high` PRs | Checklist with evidence; verdict; never replaces the human |
| design reviewer | UI PRs | Screenshots at 375 / 768 / 1280, reduced motion, a11y findings |
| persona reviewer | prompt / fixtures / copy | Lint results, `pnpm eval` output, PERSONA.md conformance |

## 6. Local gates

| Gate | Mechanism | Status |
|------|-----------|--------|
| `pnpm check` before push | convention (CI enforces) | convention |
| Secret scan | gitleaks in CI | enforced in CI |
| PR title lint | commitlint in CI | enforced in CI |

Pre-commit hooks (lefthook) are deliberately not installed yet: one more binary for a one-person
project. Revisit if CI catches the same mistake twice.

## 7. Rules enforced mechanically

| Rule | Mechanism |
|------|-----------|
| Core imports nothing framework-specific; client never imports server core; no cycles | dependency-cruiser (`pnpm arch`) |
| No secrets committed | gitleaks (CI) |
| PR title is a Conventional Commit with an allowed scope | commitlint (CI) |
| Formatting and lint | Biome (`pnpm check`) |
