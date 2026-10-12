# 07 — CI/CD

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | `.github/workflows/ci.yml` |

## 1. Checks (`.github/workflows/ci.yml`)

| Job | Runs | Blocks merge |
|-----|------|--------------|
| `check` | `pnpm check` (Biome, tsc ×4, Vitest, dependency-cruiser), `pnpm audit --prod --audit-level=high`, `next build` | yes |
| `e2e` | Playwright, desktop + mobile, production build in demo mode | yes |
| `docker` | `docker build` of the production image | yes |
| `gitleaks` | secret scan of the commits the PR adds (or the push) | yes |
| `pr-title` | commitlint on the PR title (PRs only) | yes |

Scheduled and on-demand (`.github/workflows/security.yml`, Mondays 04:17 UTC and `workflow_dispatch`):

| Job | Runs | Notes |
|-----|------|-------|
| `gitleaks (full history)` | gitleaks over every commit | also covers the first push, which the push-triggered scan can't diff against |
| `pnpm audit` | production dependencies, high and above | new advisories appear without a commit |
| `CodeQL` | `javascript-typescript`, `security-extended` queries | skipped while the repository is private: code scanning there needs GitHub Advanced Security |

Dependabot (`.github/dependabot.yml`) opens weekly update PRs for npm (every workspace package) and
GitHub Actions, grouped, titled `chore(deps): …` / `ci(deps): …` so they pass `pr-title`.
Dependabot security alerts are on in the repository settings.

No job needs a secret. CI never calls OpenAI or YouTube: demo mode and scripted models cover the
pipeline; the live eval is a human step (H-07).

## 2. Hygiene

- `permissions: contents: read` by default; a job that needs more says so (`gitleaks`: `pull-requests:
  read` to list a PR's commits; `CodeQL`: `security-events: write` to upload results).
- Third-party actions pinned by full commit SHA (version in a trailing comment).
- No `pull_request_target`. Untrusted strings (the PR title) reach shells via `env:` only.
- `concurrency` cancels superseded runs per ref.
- pnpm store cached by `actions/setup-node`; Playwright browsers installed per run.

## 3. Environments

| Environment | Secrets | Used by |
|-------------|---------|---------|
| CI | none | every job |
| Local | `.env` (gitignored) | developer, ingest CLI, `pnpm eval --answers` |
| Production | `OPENAI_API_KEY` as a platform secret | the container (`docs/DEPLOY.md`) |

Never paste secret values into issues or PRs — only names and runbook links.

## 4. Not yet enforced (needs H-01)

Branch protection (required checks, squash-only, no direct pushes) is a GitHub setting a human
enables once the repository exists. Until then these are conventions.
