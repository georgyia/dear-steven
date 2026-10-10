# H-01 — GitHub repository and branch protection

**Unblocks:** CI enforcement, GitHub issues synced from `plan/04-issues/`
**Start when:** you're happy with the local repository

## Steps

1. Create an empty repository (public or private) — no README, no licence (both exist locally).
2. Make the first commit locally and push:
   ```bash
   git add -A && git commit -m "chore(repo): initial import"
   git branch -M main && git remote add origin git@github.com:<you>/dear-steven.git && git push -u origin main
   ```
   Check first that `git status` shows no `data/`, `.env` or `agent-engineering-kit/` (all gitignored).
3. Labels: `bash scripts/sync-labels.sh` (needs `gh auth login`).
4. Settings → General → Pull Requests: allow **squash merging only**; **automatically delete head branches**.
5. Settings → Branches → add a rule for `main`: require a pull request; require status checks
   `check`, `e2e`, `docker`, `gitleaks`, `pr-title`; block force pushes and deletions.
6. Optional: create the GitHub issues from `plan/04-issues/` and write the numbers back into each
   issue's `github` field (an agent can do this once `gh` is authenticated — ask on P0-01).

## Verify

- A PR with a title like `fix: x` fails `pr-title`; `fix(web): x` passes.
- The first CI run is green.

## Fallback

Without branch protection (e.g. a free private repo), the rules in `docs/WORKFLOW.md` remain
conventions; say so in `plan/STATUS.md`.

## Tell the agent

> H-01 done. Repo: `<owner>/<name>`. Branch protection: yes/no. Labels synced: yes/no.
