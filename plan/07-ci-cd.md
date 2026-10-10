# 07 — CI/CD

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | ai | 2026-10-10 | `.github/workflows/ci.yml` |

## 1. Checks (`.github/workflows/ci.yml`)

| Job | Runs | Blocks merge |
|-----|------|--------------|
| `check` | `pnpm check` (Biome, tsc ×4, Vitest, dependency-cruiser) + `next build` | yes |
| `e2e` | Playwright, desktop + mobile, production build in demo mode | yes |
| `docker` | `docker build` of the production image | yes |
| `gitleaks` | secret scan over the full history | yes |
| `pr-title` | commitlint on the PR title (PRs only) | yes |

No job needs a secret. CI never calls OpenAI or YouTube: demo mode and scripted models cover the
pipeline; the live eval is a human step (H-07).

## 2. Hygiene

- `permissions: contents: read` by default; nothing writes.
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
