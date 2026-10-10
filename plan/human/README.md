# human/ — runbooks

| Status | Owner | Updated | Feeds |
|--------|-------|---------|-------|
| adopted | human | 2026-10-10 | H-* |

One runbook per human task. Each says what it unblocks, the steps, how to verify, the fallback,
and exactly what to tell the agent afterwards.

**Never paste a secret into an issue, PR, commit or chat.** Runbooks say where each secret goes
(`.env` locally, platform secrets in production). Ids, URLs and choices are not secrets — post them
so the agent can use them.

| Id | Runbook |
|----|---------|
| H-01 | `github-setup.md` |
| H-02 | `harness-decisions.md` |
| H-03 | `api-keys.md` |
| H-04 | `host-voice-clip.md` |
| H-05 | `transcription-budget.md` |
| H-06 | `agent-identity.md` |
| H-07 | `first-live-eval.md` |
| H-08 | `deploy.md` |
| H-09 | `wake-word-spike.md` |
