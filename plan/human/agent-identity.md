# H-06 — Separate GitHub identity for agents

**Unblocks:** the `risk:high` human-approval gate

## Why

If agents and humans share one GitHub user, "human approval" is meaningless. Agents open PRs as
their own identity; humans are listed in `.github/human-reviewers.json`.

## Steps

1. Create a machine user or GitHub App used only by agents; give it write access to the repo.
2. Authenticate agent sessions as that identity (`gh auth login`, git `user.name` / `user.email`).
3. Put human GitHub usernames in `.github/human-reviewers.json`.
4. Branch protection: require one approving review for PRs labelled `risk:high` (or for all PRs).

## Tell the agent

> H-06 done. Agent identity: `<login>`. Human reviewers file updated: yes.
